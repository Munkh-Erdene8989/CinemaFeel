import { FieldValue, type DocumentReference, type Firestore } from "firebase-admin/firestore";
import { contactsMatch, creatorMayWatchOwn, grantPass, isSubscriptionCheckout } from "./entitlement";
import type { AppUser, Payment, Series } from "./types";
import { subscriptionActive, todayStamp } from "./format";

export { subscriptionActive };

export async function userCanWatch(db: Firestore, uid: string, series: Series) {
  const userSnap = await db.collection("users").doc(uid).get();
  const user = userSnap.exists ? (userSnap.data() as AppUser) : null;
  if (user?.status === "Түр зогссон") return false;
  if (series.access === "free") return true;
  if (subscriptionActive(user)) return true;
  if (user && series.ownerId && (await viewerOwnsCreatorCatalog(db, user, series.ownerId))) return true;
  const owned = await db.collection("purchases").where("uid", "==", uid).get();
  return owned.docs.some((item) => item.data().seriesId === series.id);
}

export async function findLiveCreatorId(db: Firestore, contact: { email?: string; phone?: string }) {
  const email = contact.email?.trim().toLowerCase() ?? "";
  const phone = contact.phone?.trim() ?? "";
  if (email) {
    const snap = await db.collection("admins").where("email", "==", email).limit(5).get();
    const match = snap.docs.find((item) => creatorMayWatchOwn(item.data()));
    if (match) return match.id;
  }
  if (phone) {
    const snap = await db.collection("admins").where("phone", "==", phone).limit(5).get();
    const match = snap.docs.find((item) => creatorMayWatchOwn(item.data()));
    if (match) return match.id;
  }
  return "";
}

async function viewerOwnsCreatorCatalog(db: Firestore, user: Pick<AppUser, "email" | "phone">, ownerId: string) {
  const admin = await db.collection("admins").doc(ownerId).get();
  if (!creatorMayWatchOwn(admin.data())) return false;
  return contactsMatch(user, { email: String(admin.data()?.email ?? ""), phone: String(admin.data()?.phone ?? "") });
}

export async function attachCreatorViewers(db: Firestore, creatorId: string) {
  const admin = await db.collection("admins").doc(creatorId).get();
  if (!creatorMayWatchOwn(admin.data())) return;
  const email = String(admin.data()?.email ?? "").trim().toLowerCase();
  const phone = String(admin.data()?.phone ?? "").trim();
  const refs = new Map<string, DocumentReference>();
  if (email) {
    const snap = await db.collection("users").where("email", "==", email).get();
    snap.docs.forEach((item) => refs.set(item.id, item.ref));
  }
  if (phone) {
    const snap = await db.collection("users").where("phone", "==", phone).get();
    snap.docs.forEach((item) => refs.set(item.id, item.ref));
  }
  await Promise.all([...refs.values()].map((ref) => ref.set({ creatorId }, { merge: true })));
}

export async function detachCreatorViewers(db: Firestore, creatorId: string) {
  const snap = await db.collection("users").where("creatorId", "==", creatorId).get();
  await Promise.all(snap.docs.map((item) => item.ref.set({ creatorId: "" }, { merge: true })));
}

export async function grantPayment(db: Firestore, paymentId: string, qpayPaymentId: string) {
  const ref = db.collection("payments").doc(paymentId);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false as const, error: "Төлбөр олдсонгүй." };
  const payment = snap.data() as Payment;
  if (payment.status === "Амжилттай") return { ok: true as const, already: true };
  if (payment.status === "Буцаагдсан") return { ok: false as const, error: "Төлбөр буцаагдсан байна." };

  if (payment.mode === "creator") {
    if (!payment.creatorId) return { ok: false as const, error: "Контент бүтээгч олдсонгүй." };
    await db.collection("admins").doc(payment.creatorId).set({ active: true, paid: true, paidAt: Date.now() }, { merge: true });
    await attachCreatorViewers(db, payment.creatorId);
    await ref.set({ status: "Амжилттай", paymentId: qpayPaymentId, date: todayStamp() }, { merge: true });
    return { ok: true as const, already: false };
  }

  if (isSubscriptionCheckout(payment.mode)) {
    const userRef = db.collection("users").doc(payment.uid);
    const userSnap = await userRef.get();
    const current = Number(userSnap.data()?.subscriptionExpiresAt ?? 0);
    await userRef.set(grantPass(payment.mode, current), { merge: true });
  } else if (payment.seriesId) {
    const existing = await db.collection("purchases").where("uid", "==", payment.uid).get();
    const alreadyOwned = existing.docs.some((item) => item.data().seriesId === payment.seriesId);
    if (!alreadyOwned) {
      await db.collection("purchases").add({
        uid: payment.uid,
        seriesId: payment.seriesId,
        amount: payment.amount,
        createdAt: Date.now(),
        paymentId,
      });
    }
  }

  await ref.set({ status: "Амжилттай", paymentId: qpayPaymentId, date: todayStamp() }, { merge: true });
  if (payment.discountCode) {
    const discountRef = db.collection("discounts").doc(payment.discountCode);
    const discount = await discountRef.get();
    if (discount.exists) await discountRef.set({ usedCount: FieldValue.increment(1) }, { merge: true });
  }
  return { ok: true as const, already: false };
}
