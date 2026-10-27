import { randomBytes } from "crypto";
import { adminDb } from "./firebase-admin";
import { publicSiteUrl, renewalMessage, resendConfigured, sendOneEmail } from "./mail";
import {
  OFFER_WINDOW_MS,
  RENEWAL_OFFER_PERCENT,
  asRenewalOffer,
  formatOfferDeadline,
  offerStillQuiet,
  renewalKind,
  renewalOfferCodeFromBytes,
  renewalRecipient,
  ubDateKey,
  type RenewalKind,
  type RenewalOffer,
} from "./renewal-mail";
import { mergeSettings, type Settings } from "./types";
import { isAlreadyExists } from "./views";

async function lastWatchAt(uid: string) {
  const snap = await adminDb().collection("users").doc(uid).collection("progress").select("updatedAt").get();
  let last = 0;
  snap.forEach((item) => {
    last = Math.max(last, Number(item.data().updatedAt) || 0);
  });
  return last;
}

async function ensureOffer(uid: string, cycle: string, now: number): Promise<RenewalOffer | null> {
  const db = adminDb();
  const userRef = db.collection("users").doc(uid);
  const user = await userRef.get();
  const savedCode = String(user.data()?.renewalOfferCode ?? "");
  const savedCycle = String(user.data()?.renewalOfferCycle ?? "");
  if (savedCode && savedCycle === cycle) {
    const snap = await db.collection("renewalOffers").doc(savedCode).get();
    if (snap.exists) return asRenewalOffer(savedCode, snap.data() as Record<string, unknown> | undefined);
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = renewalOfferCodeFromBytes(randomBytes(10));
    const ref = db.collection("renewalOffers").doc(code);
    const expiresAt = now + OFFER_WINDOW_MS;
    const payload = { uid, code, percent: RENEWAL_OFFER_PERCENT, cycle, createdAt: now, expiresAt, usedAt: 0 };
    try {
      await ref.create(payload);
      await userRef.set({ renewalOfferCode: code, renewalOfferCycle: cycle }, { merge: true });
      return asRenewalOffer(code, payload);
    } catch (error) {
      if (!isAlreadyExists(error)) throw error;
    }
  }
  return null;
}

async function deliver(input: {
  uid: string;
  email: string;
  kind: RenewalKind;
  cycle: string;
  link: string;
  deadline: string;
  fromName: string;
}) {
  const logRef = adminDb().collection("renewalMailLog").doc(`${input.uid}_${input.kind}_${input.cycle}`);
  const existing = await logRef.get();
  if (Number(existing.data()?.sentAt) > 0) return "sent" as const;
  if (!existing.exists) {
    try {
      await logRef.create({ uid: input.uid, kind: input.kind, cycle: input.cycle, email: input.email, sentAt: 0, pendingAt: Date.now() });
    } catch (error) {
      if (!isAlreadyExists(error)) throw error;
      const again = await logRef.get();
      if (Number(again.data()?.sentAt) > 0) return "sent" as const;
    }
  }
  const message = renewalMessage({ kind: input.kind, link: input.link, deadline: input.deadline });
  const sent = await sendOneEmail(input.email, message, `renewal-${input.uid}-${input.kind}-${input.cycle}`, input.fromName);
  if (!sent.ok) return "failed" as const;
  await logRef.set({ sentAt: Date.now() }, { merge: true });
  return "ok" as const;
}

export async function sendRenewalMails(now = Date.now()) {
  const settingsSnap = await adminDb().collection("settings").doc("app").get();
  const settings = mergeSettings(settingsSnap.data() as Partial<Settings> | undefined);
  const sent = { d3: 0, d1: 0, offer: 0 };
  if (!settings.renewalMailEnabled) return { enabled: false, sent };
  if (!resendConfigured()) return { enabled: true, sent, error: "Имэйл илгээх тохиргоо дутуу байна." };

  const site = publicSiteUrl();
  const users = await adminDb().collection("users").get();
  let failed = 0;
  for (const user of users.docs) {
    const data = user.data();
    const expiresAt = Number(data.subscriptionExpiresAt) || 0;
    const kind = renewalKind(expiresAt, now);
    const email = renewalRecipient(data.email, data.status);
    if (!kind || !email) continue;
    const cycle = ubDateKey(expiresAt);
    let link = `${site}/renew`;
    let deadline = "";
    if (kind === "offer") {
      const watched = await lastWatchAt(user.id);
      if (!offerStillQuiet(watched, expiresAt)) continue;
      const offer = await ensureOffer(user.id, cycle, now);
      if (!offer || offer.usedAt > 0 || offer.expiresAt <= now) continue;
      link = `${site}/renew?code=${encodeURIComponent(offer.code)}`;
      deadline = formatOfferDeadline(offer.expiresAt);
    }
    const result = await deliver({ uid: user.id, email, kind, cycle, link, deadline, fromName: settings.mailFromName });
    if (result === "ok") sent[kind] += 1;
    if (result === "failed") failed += 1;
  }
  return { enabled: true, sent, failed };
}
