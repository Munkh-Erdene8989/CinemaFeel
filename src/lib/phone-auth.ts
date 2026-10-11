import { randomInt, randomUUID } from "crypto";
import { adminAuth, adminDb } from "./firebase-admin";
import { callbackUrl, createVerifySession, getVerifySession, normalizeMnPhone, toE164, verifyConfigured, VerifyMnError } from "./verify-mn";

const TTL_MS = 5 * 60 * 1000;

type PhoneSession = {
  phone: string;
  e164: string;
  text: string;
  verifySessionId: string;
  demo: boolean;
  expiresAt: number;
  createdAt: number;
  status: "PENDING" | "VERIFIED" | "EXPIRED";
};

function code() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
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

export async function startPhoneLogin(rawPhone: string, origin: string) {
  const phone = normalizeMnPhone(rawPhone);
  if (!phone) return { ok: false as const, status: 400, error: "8 оронтой утасны дугаар оруулна уу." };

  const lockRef = adminDb().collection("phoneLocks").doc(phone);
  const lock = await lockRef.get();
  if (lock.exists && Date.now() - Number(lock.data()?.createdAt ?? 0) < 60_000) {
    return { ok: false as const, status: 429, error: "Шинэ код авахын тулд 1 минут хүлээнэ үү." };
  }

  const sessionId = randomUUID();
  const demo = !verifyConfigured();
  const expiresAt = Date.now() + TTL_MS;
  let text = code();
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
        text = code();
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
    verifySessionId,
    demo,
    expiresAt: Date.parse(remoteExpires) || expiresAt,
    createdAt: Date.now(),
    status: "PENDING",
  };
  await adminDb().collection("phoneSessions").doc(sessionId).set(session);
  await lockRef.set({ createdAt: Date.now() });

  return {
    ok: true as const,
    sessionId,
    displayInstruction,
    code: text,
    smsUri,
    shortcode,
    expiresAt: remoteExpires,
    demo,
  };
}

async function loadSession(sessionId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return null;
  const snap = await adminDb().collection("phoneSessions").doc(sessionId).get();
  if (!snap.exists) return null;
  return { ref: snap.ref, data: snap.data() as PhoneSession };
}

export async function phoneLoginStatus(sessionId: string) {
  const loaded = await loadSession(sessionId);
  if (!loaded) return { ok: false as const, status: 404, error: "Сесс олдсонгүй. Дахин эхлүүлнэ үү." };
  const { ref, data } = loaded;
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
  if (!loaded?.data.demo) return { ok: false as const, status: 404, error: "Сесс олдсонгүй." };
  if (Date.now() > loaded.data.expiresAt) {
    await loaded.ref.set({ status: "EXPIRED" }, { merge: true });
    return { ok: true as const, status: "EXPIRED" as const };
  }
  await loaded.ref.set({ status: "VERIFIED" }, { merge: true });
  const token = await issueToken(loaded.data.e164);
  return { ok: true as const, status: "VERIFIED" as const, token };
}
