import { FieldValue } from "firebase-admin/firestore";
import { creatorCornerTitle, creatorPath } from "./creator-site";
import { adminDb } from "./firebase-admin";
import { creatorNoticeMessage, creatorWelcomeMessage, resendConfigured, sendResendEmails } from "./mail";
import { sendWesendEmails, wesendConfigured } from "./wesend";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicSite() {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
  if (!configured) return "https://cinemafeel.dev";
  try {
    const url = new URL(configured);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return "https://cinemafeel.dev";
    return configured;
  } catch {
    return "https://cinemafeel.dev";
  }
}

async function deliver(recipients: string[], message: { subject: string; html: string; text: string }, category: string, key: string) {
  if (!recipients.length) return { ok: true as const };
  if (resendConfigured()) return sendResendEmails(recipients, message, category, key);
  if (wesendConfigured()) return sendWesendEmails(recipients, message, key);
  return { ok: false as const, error: "Имэйл илгээх тохиргоо дутуу байна." };
}

export async function sendCreatorWelcome(input: {
  creatorId: string;
  email: string;
  name: string;
  username: string;
  password: string;
  ready: boolean;
}) {
  const email = input.email.trim().toLowerCase();
  if (!emailPattern.test(email)) return { ok: false as const, error: "И-мэйл хаяг буруу байна." };
  const message = creatorWelcomeMessage({
    name: input.name,
    username: input.username,
    password: input.password,
    loginLink: `${publicSite()}/admin/login`,
    ready: input.ready,
  });
  const sent = await deliver([email], message, "creator_welcome", `creator-welcome-${input.creatorId}-${Date.now()}`);
  if (!sent.ok) return sent;
  await adminDb().collection("admins").doc(input.creatorId).set({ welcomeEmail: "sent", welcomeEmailedAt: Date.now() }, { merge: true });
  return { ok: true as const };
}

async function userEmails() {
  const snap = await adminDb().collection("users").get();
  const emails = new Set<string>();
  for (const item of snap.docs) {
    const data = item.data();
    if (data.status === "Түр зогссон") continue;
    const email = String(data.email ?? "").trim().toLowerCase();
    if (emailPattern.test(email)) emails.add(email);
  }
  return [...emails];
}

async function announce(creatorId: string) {
  const settings = await adminDb().collection("settings").doc("app").get();
  if (settings.exists && settings.data()?.notifications === false) return { emailed: 0 };

  const ref = adminDb().collection("admins").doc(creatorId);
  const snap = await ref.get();
  if (!snap.exists) return { emailed: 0 };
  const data = snap.data() ?? {};
  if (data.announcedToUsersAt) return { emailed: 0 };
  if (data.active === false) return { emailed: 0 };

  const emails = await userEmails();
  if (!emails.length) {
    await ref.set({ announcedToUsersAt: Date.now() }, { merge: true });
    return { emailed: 0 };
  }
  if (!resendConfigured() && !wesendConfigured()) return { emailed: 0, notifyError: "Имэйл илгээх тохиргоо дутуу байна." };

  const claimed = await adminDb().runTransaction(async (tx) => {
    const current = await tx.get(ref);
    if (!current.exists || current.data()?.announcedToUsersAt || current.data()?.active === false) return false;
    tx.set(ref, { announcedToUsersAt: Date.now() }, { merge: true });
    return true;
  });
  if (!claimed) return { emailed: 0 };

  const username = String(data.username ?? "");
  const name = String(data.name ?? username);
  const message = creatorNoticeMessage({
    name,
    corner: creatorCornerTitle(username, data.cornerName),
    contentType: String(data.contentType ?? ""),
    link: `${publicSite()}${creatorPath(username)}`,
  });

  try {
    const sent = await deliver(emails, message, "new_creator", `new-creator-${creatorId}`);
    if (!sent.ok) {
      await ref.set({ announcedToUsersAt: FieldValue.delete() }, { merge: true });
      return { emailed: 0, notifyError: sent.error || "Шинэ бүтээгчийн имэйл илгээгдсэнгүй." };
    }
    return { emailed: emails.length };
  } catch (error) {
    await ref.set({ announcedToUsersAt: FieldValue.delete() }, { merge: true });
    console.error("new creator notice failed", error);
    return { emailed: 0, notifyError: "Шинэ бүтээгчийн мэдэгдэл илгээгдсэнгүй." };
  }
}

export async function announceCreator(creatorId: string) {
  try {
    return await announce(creatorId);
  } catch (error) {
    console.error("new creator notice failed", error);
    return { emailed: 0, notifyError: "Шинэ бүтээгчийн мэдэгдэл илгээгдсэнгүй." };
  }
}
