import { grantPayment } from "./access";
import { adminDb } from "./firebase-admin";
import { checkInvoice, paymentResult } from "./qpay";
import type { Payment } from "./types";

export async function settleInvoice(senderInvoiceNo: string) {
  const ref = adminDb().collection("payments").doc(senderInvoiceNo);
  const snap = await ref.get();
  if (!snap.exists) return { paid: false, error: "Нэхэмжлэх олдсонгүй." };
  const payment = { id: snap.id, ...(snap.data() as Omit<Payment, "id">) };
  if (payment.status === "Амжилттай") return { paid: true };
  if (payment.status === "Буцаагдсан") return { paid: false, error: "Төлбөр буцаагдсан байна." };
  const check = await checkInvoice(payment.invoiceId);
  const result = paymentResult(check, payment.amount);
  if (!result.paid) return { paid: false };
  await grantPayment(adminDb(), senderInvoiceNo, result.paymentId);
  return { paid: true };
}
