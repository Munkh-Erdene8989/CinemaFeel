import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";
import { announcementAudience, marketingFromSettings } from "./marketing";
import { isMature, releaseEmailImage } from "./mature";
import { resendConfigured, sendNewReleaseEmail, type ReleaseMail } from "./mail";
import { sendReleaseEmails, sendReleaseSms, supportedMnMobile, wesendConfigured } from "./wesend";

export type AnnouncementResult = {
  notified: number;
  emailed?: number;
  smsed?: number;
  notifyError?: string;
  notifyPending?: string;
};

function publicSite(origin: string) {
  try {
    const url = new URL(origin);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return "https://cinemafeel.dev";
    return origin.replace(/\/$/, "");
  } catch {
    return "https://cinemafeel.dev";
  }
}

function watchLink(origin: string, shareCode: string, seriesId: string) {
  const base = publicSite(origin);
  if (shareCode) return `${base}/s/${shareCode}`;
  return `${base}/watch/${seriesId}/1`;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function recipients() {
  const snap = await adminDb().collection("users").get();
  const emails = new Set<string>();
  const phones = new Set<string>();
  let skippedPhones = 0;
  for (const item of snap.docs) {
    const data = item.data();
    if (data.status === "Түр зогссон") continue;
    const email = String(data.email ?? "").trim().toLowerCase();
    if (emailPattern.test(email)) {
      emails.add(email);
      continue;
    }
    const phone = supportedMnMobile(String(data.phone ?? ""));
    if (phone) phones.add(phone);
    else if (String(data.phone ?? "").trim()) skippedPhones += 1;
  }
  return { emails: [...emails], phones: [...phones], skippedPhones };
}

async function announce(seriesId: string, origin: string): Promise<AnnouncementResult> {
  const settings = await adminDb().collection("settings").doc("app").get();
  const stored = settings.data();
  if (settings.exists && stored?.notifications === false) return { notified: 0 };
  const channels = marketingFromSettings(stored);

  const ref = adminDb().collection("series").doc(seriesId);
  const snap = await ref.get();
  if (!snap.exists) return { notified: 0 };
  const data = snap.data() ?? {};
  if (data.announcedAt || data.releaseEmail === "sent") return { notified: 0 };
  if (data.releaseEmail !== "pending") return { notified: 0 };
  if (data.status !== "Нийтлэгдсэн") return { notified: 0 };

  const mature = isMature(data);
  const cover = releaseEmailImage(data);
  if (!cover) {
    return {
      notified: 0,
      notifyPending: mature
        ? "Постер оруулсны дараа бүртгэлтэй хэрэглэгчдэд имэйл илгээгдэнэ."
        : "Хөндлөн зураг оруулсны дараа бүртгэлтэй хэрэглэгчдэд мэдэгдэл илгээгдэнэ.",
    };
  }

  const audience = await recipients();
  const routed = announcementAudience({
    emails: audience.emails,
    phones: audience.phones,
    emailEnabled: channels.emailEnabled,
    smsEnabled: channels.smsEnabled,
    mature,
  });
  if (audience.skippedPhones && !mature && channels.smsEnabled) console.warn("new content notice skipped unsupported phones", audience.skippedPhones);
  if (routed.suppressed) return { notified: 0, notifyPending: "Маркетингийн имэйл эсвэл SMS унтраалттай тул мэдэгдэл илгээгдсэнгүй." };
  if (!routed.emails.length && !routed.phones.length) {
    await ref.set({ announcedAt: Date.now(), releaseEmail: "sent" }, { merge: true });
    return { notified: 0 };
  }
  const canEmail = resendConfigured() || wesendConfigured();
  if (routed.emails.length && !canEmail) return { notified: 0, notifyError: "Имэйл илгээх тохиргоо дутуу байна." };
  if (routed.phones.length && !wesendConfigured()) return { notified: 0, notifyError: "SMS илгээх тохиргоо дутуу байна." };

  const claimed = await adminDb().runTransaction(async (tx) => {
    const current = await tx.get(ref);
    if (!current.exists || current.data()?.announcedAt || current.data()?.releaseEmail !== "pending") return false;
    tx.set(ref, { announcedAt: Date.now(), releaseEmail: "sent" }, { merge: true });
    return true;
  });
  if (!claimed) return { notified: 0 };

  const mail: ReleaseMail = {
    title: String(data.title ?? ""),
    description: String(data.description ?? ""),
    genre: String(data.genre ?? ""),
    year: Number(data.year ?? 0),
    episodes: Number(data.episodes ?? 0),
    cover,
    link: watchLink(origin, String(data.shareCode ?? ""), seriesId),
    free: Number(data.price ?? 0) === 0 || data.access === "free",
  };

  try {
    let emailed = 0;
    if (routed.emails.length) {
      const sent = resendConfigured()
        ? await sendNewReleaseEmail(routed.emails, mail, seriesId, undefined, channels.mailFromName)
        : await sendReleaseEmails(routed.emails, mail, seriesId, channels.mailFromName);
      if (!sent.ok) {
        await ref.set({ announcedAt: FieldValue.delete(), releaseEmail: "pending" }, { merge: true });
        return { notified: 0, notifyError: sent.error || "Шинэ контентийн имэйл илгээгдсэнгүй." };
      }
      emailed = routed.emails.length;
    }
    if (routed.phones.length) {
      const sent = await sendReleaseSms(routed.phones, mail.title, mail.link, seriesId);
      if (!sent.ok) {
        await ref.set({ announcedAt: FieldValue.delete(), releaseEmail: "pending" }, { merge: true });
        return { notified: 0, notifyError: sent.error || "Шинэ контентийн SMS илгээгдсэнгүй." };
      }
    }
    return {
      notified: emailed + routed.phones.length,
      emailed: emailed || undefined,
      smsed: routed.phones.length || undefined,
    };
  } catch (error) {
    await ref.set({ announcedAt: FieldValue.delete(), releaseEmail: "pending" }, { merge: true });
    console.error("new content notice failed", error);
    return { notified: 0, notifyError: "Шинэ контентийн мэдэгдэл илгээгдсэнгүй." };
  }
}

export async function announceIfReady(seriesId: string, origin: string): Promise<AnnouncementResult> {
  try {
    return await announce(seriesId, origin);
  } catch (error) {
    console.error("new content email failed", error);
    return { notified: 0, notifyError: "Шинэ контентийн мэдэгдэл илгээгдсэнгүй." };
  }
}
