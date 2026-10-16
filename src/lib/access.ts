import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { WEEKLY_DAYS, type AppUser, type Payment, type Series } from "./types";
import { subscriptionActive, todayStamp } from "./format";

export { subscriptionActive };

export async function userCanWatch(db: Firestore, uid: string, series: Series) {
  const userSnap = await db.collection("users").doc(uid).get();
  const user = userSnap.exists ? (userSnap.data() as AppUser) : null;
  if (user?.status === "Түр зогссон") return false;
  if (series.access === "free") return true;
  if (subscriptionActive(user)) return true;
  const owned = await db.collection("purchases").where("uid", "==", uid).get();
  return owned.docs.some((item) => item.data().seriesId === series.id);
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
    await ref.set({ status: "Амжилттай", paymentId: qpayPaymentId, date: todayStamp() }, { merge: true });
    return { ok: true as const, already: false };
  }

  if (payment.mode === "subscription" || payment.mode === "weekly") {
    const userRef = db.collection("users").doc(payment.uid);
    const userSnap = await userRef.get();
    const current = Number(userSnap.data()?.subscriptionExpiresAt ?? 0);
    const base = Math.max(Date.now(), current);
    const days = payment.mode === "weekly" ? WEEKLY_DAYS : 30;
    await userRef.set(
      {
        plan: "Plus",
        status: "Идэвхтэй",
        subscriptionExpiresAt: base + days * 24 * 60 * 60 * 1000,
      },
      { merge: true },
    );
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
