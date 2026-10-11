import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";
import { resendConfigured, sendNewReleaseEmail, type ReleaseMail } from "./mail";

export type AnnouncementResult = {
  notified: number;
  notifyError?: string;
  notifyPending?: string;
};

function httpUrl(value: unknown) {
  const url = String(value ?? "").trim();
  return /^https?:\/\//i.test(url) ? url : "";
}

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

async function recipientEmails() {
  const snap = await adminDb().collection("users").get();
  const seen = new Set<string>();
  for (const item of snap.docs) {
    const data = item.data();
    if (data.status === "Түр зогссон") continue;
    const email = String(data.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    seen.add(email);
  }
  return [...seen];
}

async function announce(seriesId: string, origin: string): Promise<AnnouncementResult> {
  const settings = await adminDb().collection("settings").doc("app").get();
  if (settings.exists && settings.data()?.notifications === false) return { notified: 0 };

  const ref = adminDb().collection("series").doc(seriesId);
  const snap = await ref.get();
  if (!snap.exists) return { notified: 0 };
  const data = snap.data() ?? {};
  if (data.announcedAt || data.releaseEmail === "sent") return { notified: 0 };
  if (data.releaseEmail !== "pending") return { notified: 0 };
  if (data.status !== "Нийтлэгдсэн") return { notified: 0 };

  const cover = httpUrl(data.cover);
  if (!cover) {
    return { notified: 0, notifyPending: "Хөндлөн зураг оруулсны дараа бүртгэлтэй хэрэглэгчдэд имэйл илгээгдэнэ." };
  }
  if (!resendConfigured()) return { notified: 0, notifyError: "Имэйл илгээх тохиргоо дутуу байна." };

  const emails = await recipientEmails();
  if (!emails.length) {
    await ref.set({ announcedAt: Date.now(), releaseEmail: "sent" }, { merge: true });
    return { notified: 0 };
  }

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
    const sent = await sendNewReleaseEmail(emails, mail, seriesId);
    if (!sent.ok) {
      await ref.set({ announcedAt: FieldValue.delete(), releaseEmail: "pending" }, { merge: true });
      return { notified: 0, notifyError: sent.error || "Шинэ контентийн имэйл илгээгдсэнгүй." };
    }
  } catch (error) {
    await ref.set({ announcedAt: FieldValue.delete(), releaseEmail: "pending" }, { merge: true });
    console.error("new content email failed", error);
    return { notified: 0, notifyError: "Шинэ контентийн имэйл илгээгдсэнгүй." };
  }

  return { notified: emails.length };
}

export async function announceIfReady(seriesId: string, origin: string): Promise<AnnouncementResult> {
  try {
    return await announce(seriesId, origin);
  } catch (error) {
    console.error("new content email failed", error);
    return { notified: 0, notifyError: "Шинэ контентийн имэйл илгээгдсэнгүй." };
  }
}
