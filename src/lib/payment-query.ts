import type { Query } from "firebase-admin/firestore";

/** Admin lists never render the QPay QR. Selecting these fields keeps the blob off the download. */
export const paymentListFields = [
  "uid",
  "email",
  "amount",
  "product",
  "mode",
  "seriesId",
  "createdAt",
  "date",
  "method",
  "status",
  "invoiceId",
  "senderInvoiceNo",
  "paymentId",
  "creatorId",
  "originalAmount",
  "discountCode",
  "discountPercent",
] as const;

export function paymentsWithoutQr<T extends Query>(query: T) {
  return query.select(...paymentListFields);
}
