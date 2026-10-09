import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { jsonError, readUser } from "@/lib/http";
import { settleInvoice } from "@/lib/settle";

export async function POST(request: NextRequest) {
  const user = await readUser(request);
  if (!user?.uid) return jsonError("Нэвтрэх шаардлагатай.", 401);
  const body = (await request.json().catch(() => ({}))) as { senderInvoiceNo?: string };
  const senderInvoiceNo = body.senderInvoiceNo || "";
  const payment = await adminDb().collection("payments").doc(senderInvoiceNo).get();
  if (!payment.exists || payment.data()?.uid !== user.uid) return jsonError("Нэхэмжлэх олдсонгүй.", 404);
  try {
    const result = await settleInvoice(senderInvoiceNo);
    if (result.error) return jsonError(result.error, 400);
    return NextResponse.json({ paid: result.paid });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Төлбөр шалгаж чадсангүй.";
    return NextResponse.json({ paid: false, error: message }, { status: 502 });
  }
}
