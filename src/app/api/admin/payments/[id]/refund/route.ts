import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { assertAdmin, jsonError } from "@/lib/http";
import { refundPayment } from "@/lib/qpay";
import type { Payment } from "@/lib/types";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!assertAdmin(request)) return jsonError("Нэвтрэх шаардлагатай.", 401);
  const { id } = await context.params;
  const ref = adminDb().collection("payments").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return jsonError("Төлбөр олдсонгүй.", 404);
  const payment = snap.data() as Payment;
  if (payment.status !== "Амжилттай") return jsonError("Зөвхөн амжилттай төлбөрийг буцаана.");
  if (payment.paymentId) {
    try {
      await refundPayment(payment.paymentId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "QPay буцаалт амжилтгүй.";
      return jsonError(message, 502);
    }
  }
  if (payment.mode === "subscription") {
    await adminDb().collection("users").doc(payment.uid).set({ plan: "Үндсэн", subscriptionExpiresAt: Date.now() }, { merge: true });
  } else if (payment.seriesId) {
    const purchases = await adminDb().collection("purchases").where("uid", "==", payment.uid).get();
    await Promise.all(
      purchases.docs.filter((item) => item.data().seriesId === payment.seriesId && item.data().paymentId === id).map((item) => item.ref.delete()),
    );
  }
  await ref.set({ status: "Буцаагдсан" }, { merge: true });
  return NextResponse.json({ ok: true });
}
