import { randomInt, randomUUID } from "crypto";
import { adminAuth, adminDb } from "./firebase-admin";
import { hashPhoneOtp, PHONE_SMS_COOLDOWN_MS, phoneDeliveryPlan, phoneOtpMatches } from "./phone-login";
import { sendOtpSms, supportedMnMobile, wesendConfigured, wesendOutOfCredit } from "./wesend";
import { callbackUrl, createVerifySession, getVerifySession, normalizeMnPhone, toE164, verifyConfigured, VerifyMnError } from "./verify-mn";

const TTL_MS = 5 * 60 * 1000;
const OTP_ATTEMPTS = 5;

type PhoneSession = {
  phone: string;
  e164: string;
  text: string;
  codeHash?: string;
  channel?: "otp" | "mo";
  verifySessionId: string;
  demo: boolean;
  expiresAt: number;
  createdAt: number;
  status: "PENDING" | "VERIFIED" | "EXPIRED";
  attempts?: number;
};

function moCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function otpCode() {
  return String(randomInt(0, 10_000)).padStart(4, "0");
}

function notFound(error: unknown) {
  return (error as { code?: string }).code === "auth/user-not-found";
}

function alreadyExists(error: unknown) {
  const codeName = (error as { code?: string }).code;
  return codeName === "auth/phone-number-already-exists" || codeName === "auth/uid-already-exists";
}

async function ensurePhoneUser(e164: string) {
  try {
    return await adminAuth().getUserByPhoneNumber(e164);
  } catch (error) {
    if (!notFound(error)) throw error;
  }
  const settings = await adminDb().collection("settings").doc("app").get();
  const registrationOpen = settings.exists ? settings.data()?.registration !== false : true;
  if (!registrationOpen) {
    throw new VerifyMnError("Шинэ бүртгэл хаалттай байна.", 403);
  }
  try {
    return await adminAuth().createUser({ phoneNumber: e164 });
  } catch (error) {
    if (alreadyExists(error)) return adminAuth().getUserByPhoneNumber(e164);
    throw error;
  }
}

async function issueToken(e164: string) {
  const user = await ensurePhoneUser(e164);
  return adminAuth().createCustomToken(user.uid);
}

async function claimSmsSlot(phone: string) {
  const lockRef = adminDb().collection("phoneLocks").doc(phone);
  const claimed = await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(lockRef);
    if (snap.exists && Date.now() - Number(snap.data()?.createdAt ?? 0) < PHONE_SMS_COOLDOWN_MS) return false;
    tx.set(lockRef, { createdAt: Date.now() });
    return true;
  });
  return { lockRef, claimed };
}

export async function startPhoneLogin(rawPhone: string, origin: string) {
  const phone = normalizeMnPhone(rawPhone);
  if (!phone) return { ok: false as const, status: 400, error: "8 оронтой утасны дугаар оруулна уу." };

  const { lockRef, claimed } = await claimSmsSlot(phone);
  if (!claimed) return { ok: false as const, status: 429, error: "Шинэ код авахын тулд 1 минут хүлээнэ үү." };

  const release = () => lockRef.delete();
  const sessionId = randomUUID();
  const sessionRef = adminDb().collection("phoneSessions").doc(sessionId);
  const expiresAt = Date.now() + TTL_MS;
  let outOfCredit = false;

  try {
    if (wesendConfigured()) {
      if (!supportedMnMobile(phone)) {
        await release();
        return { ok: false as const, status: 422, error: "Утасны дугаар руу SMS илгээх боломжгүй." };
      }
      const code = otpCode();
      await sessionRef.set({
        phone,
        e164: toE164(phone),
        text: "",
        codeHash: hashPhoneOtp(phone, code),
        channel: "otp",
        verifySessionId: "",
        demo: false,
        expiresAt,
        createdAt: Date.now(),
        status: "PENDING",
        attempts: 0,
      } satisfies PhoneSession);
      const sent = await sendOtpSms(phone, code, sessionId);
      if (sent.ok) {
        await lockRef.set({ createdAt: Date.now() }).catch(() => undefined);
        return {
          ok: true as const,
          delivery: "otp" as const,
          sessionId,
          expiresAt: new Date(expiresAt).toISOString(),
          demo: false as const,
          fallback: false as const,
        };
      }
      await sessionRef.delete();
      if (!wesendOutOfCredit(sent.code)) {
        await release();
        return { ok: false as const, status: 502, error: sent.error };
      }
      outOfCredit = true;
    }

    const plan = phoneDeliveryPlan({
      wesendReady: wesendConfigured(),
      outOfCredit,
      verifyReady: verifyConfigured(),
    });
    if (plan === "blocked") {
      await release();
      return { ok: false as const, status: 402, error: "WeSend кредит хүрэлцэхгүй байна." };
    }
    if (plan === "otp") {
      await release();
      return { ok: false as const, status: 502, error: "Код илгээж чадсангүй. Дахин оролдоно уу." };
    }

    const demo = plan === "demo";
    const fallback = wesendConfigured();
    let text = moCode();
    let verifySessionId = "demo";
    let smsUri = "";
    let shortcode = "144773";
    let displayInstruction = `DEMO горим: SMS илгээхгүй. ${phone} дугаарын код ${text}. Доорх товчоор баталгаажуулна уу.`;
    let remoteExpires = new Date(expiresAt).toISOString();

    if (!demo) {
      const callback = callbackUrl(origin, sessionId);
      let created;
      try {
        created = await createVerifySession({ phone, text, callback });
      } catch (error) {
        if (error instanceof VerifyMnError && error.status === 409) {
          text = moCode();
          created = await createVerifySession({ phone, text, callback });
        } else {
          throw error;
        }
      }
      verifySessionId = created.sessionId;
      smsUri = created.smsUri;
      shortcode = created.shortcode || shortcode;
      displayInstruction = created.displayInstruction;
      remoteExpires = created.expiresAt || remoteExpires;
    }

    const session: PhoneSession = {
      phone,
      e164: toE164(phone),
      text,
      channel: "mo",
      verifySessionId,
      demo,
      expiresAt: Date.parse(remoteExpires) || expiresAt,
      createdAt: Date.now(),
      status: "PENDING",
      attempts: 0,
    };
    await sessionRef.set(session);
    return {
      ok: true as const,
      delivery: "mo" as const,
      sessionId,
      displayInstruction,
      code: text,
      smsUri,
      shortcode,
      expiresAt: remoteExpires,
      demo,
      fallback,
    };
  } catch (error) {
    await release();
    throw error;
  }
}

async function loadSession(sessionId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return null;
  const snap = await adminDb().collection("phoneSessions").doc(sessionId).get();
  if (!snap.exists) return null;
  return { ref: snap.ref, data: snap.data() as PhoneSession };
}

export async function verifyPhoneOtp(sessionId: string, rawCode: string) {
  const code = rawCode.trim();
  if (!/^\d{4}$/.test(code)) return { ok: false as const, status: 400, error: "4 оронтой код оруулна уу." };
  const loaded = await loadSession(sessionId);
  if (!loaded || loaded.data.channel !== "otp") return { ok: false as const, status: 404, error: "Сесс олдсонгүй. Дахин эхлүүлнэ үү." };
  const { ref, data } = loaded;
  if (Date.now() > data.expiresAt || data.status === "EXPIRED") {
    if (data.status !== "EXPIRED") await ref.set({ status: "EXPIRED" }, { merge: true });
    return { ok: false as const, status: 400, error: "Кодын хугацаа дууссан. Шинэ код авна уу." };
  }
  if (data.status === "VERIFIED") {
    const token = await issueToken(data.e164);
    return { ok: true as const, status: "VERIFIED" as const, token };
  }
  if (Number(data.attempts ?? 0) >= OTP_ATTEMPTS) return { ok: false as const, status: 429, error: "Оролдлого хэтэрлээ. Шинэ код авна уу." };
  if (!data.codeHash || !phoneOtpMatches(data.codeHash, data.phone, code)) {
    await ref.set({ attempts: Number(data.attempts ?? 0) + 1 }, { merge: true });
    return { ok: false as const, status: 400, error: "Код буруу байна." };
  }
  await ref.set({ status: "VERIFIED", codeHash: "" }, { merge: true });
  const token = await issueToken(data.e164);
  return { ok: true as const, status: "VERIFIED" as const, token };
}

export async function phoneLoginStatus(sessionId: string) {
  const loaded = await loadSession(sessionId);
  if (!loaded) return { ok: false as const, status: 404, error: "Сесс олдсонгүй. Дахин эхлүүлнэ үү." };
  const { ref, data } = loaded;
  if (data.channel === "otp") {
    if (Date.now() > data.expiresAt || data.status === "EXPIRED") {
      if (data.status !== "EXPIRED") await ref.set({ status: "EXPIRED" }, { merge: true });
      return { ok: true as const, status: "EXPIRED" as const };
    }
    if (data.status !== "VERIFIED") return { ok: true as const, status: "PENDING" as const };
    const token = await issueToken(data.e164);
    return { ok: true as const, status: "VERIFIED" as const, token };
  }
  if (Date.now() > data.expiresAt + 10 * 60 * 1000) {
    return { ok: true as const, status: "EXPIRED" as const };
  }

  let verified = data.status === "VERIFIED";
  if (!verified && !data.demo) {
    try {
      const remote = await getVerifySession(data.verifySessionId);
      if (remote.sessionStatus === "VERIFIED") verified = true;
      else if (remote.sessionStatus === "EXPIRED" || Date.now() > data.expiresAt) {
        await ref.set({ status: "EXPIRED" }, { merge: true });
        return { ok: true as const, status: "EXPIRED" as const };
      } else {
        return { ok: true as const, status: "PENDING" as const };
      }
    } catch (error) {
      if (error instanceof VerifyMnError && error.status === 404) {
        return { ok: false as const, status: 404, error: "Сесс олдсонгүй. Дахин эхлүүлнэ үү." };
      }
      return { ok: true as const, status: "PENDING" as const };
    }
  }

  if (!verified) {
    if (Date.now() > data.expiresAt) {
      await ref.set({ status: "EXPIRED" }, { merge: true });
      return { ok: true as const, status: "EXPIRED" as const };
    }
    return { ok: true as const, status: "PENDING" as const };
  }

  if (data.status !== "VERIFIED") await ref.set({ status: "VERIFIED" }, { merge: true });
  const token = await issueToken(data.e164);
  return { ok: true as const, status: "VERIFIED" as const, token };
}

export async function confirmDemoPhone(sessionId: string) {
  if (verifyConfigured()) return { ok: false as const, status: 403, error: "Demo горим идэвхгүй." };
  const loaded = await loadSession(sessionId);
  if (!loaded?.data.demo || loaded.data.channel === "otp") return { ok: false as const, status: 404, error: "Сесс олдсонгүй." };
  if (Date.now() > loaded.data.expiresAt) {
    await loaded.ref.set({ status: "EXPIRED" }, { merge: true });
    return { ok: true as const, status: "EXPIRED" as const };
  }
  await loaded.ref.set({ status: "VERIFIED" }, { merge: true });
  const token = await issueToken(loaded.data.e164);
  return { ok: true as const, status: "VERIFIED" as const, token };
}
