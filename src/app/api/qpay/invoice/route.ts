import { randomInt } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { userCanWatch } from "@/lib/access";
import { mapSeries } from "@/lib/catalog";
import { viewerCheckoutQuote } from "@/lib/discount";
import { adminDb } from "@/lib/firebase-admin";
import { todayStamp } from "@/lib/format";
import { jsonError, readUser, siteOrigin } from "@/lib/http";
import { createInvoice } from "@/lib/qpay";
import { defaultSettings } from "@/lib/types";

export async function POST(request: NextRequest) {
  const user = await readUser(request);
  if (!user?.uid) return jsonError("Нэвтрэх шаардлагатай.", 401);
  const contact = user.email || user.phone_number || "";
  const profile = await adminDb().collection("users").doc(user.uid).get();
  if (profile.data()?.status === "Түр зогссон") return jsonError("Таны бүртгэл түр зогссон байна.", 403);

  const body = (await request.json().catch(() => ({}))) as { mode?: string; seriesId?: string | null; code?: string };
  const settingsSnap = await adminDb().collection("settings").doc("app").get();
  const monthly = Number(settingsSnap.data()?.price || defaultSettings.price);
  const quote = await viewerCheckoutQuote({ mode: body.mode, seriesId: body.seriesId, code: body.code, monthlyPrice: monthly, uid: user.uid });
  if (!quote.ok) return jsonError(quote.error, quote.status);
  if (quote.mode === "single" && quote.seriesId) {
    const seriesSnap = await adminDb().collection("series").doc(quote.seriesId).get();
    if (seriesSnap.exists && (await userCanWatch(adminDb(), user.uid, mapSeries(seriesSnap.id, seriesSnap.data()!)))) {
      return jsonError("Та энэ киног үзэх эрхтэй.", 409);
    }
  }

  const senderInvoiceNo = `CF${Date.now()}${randomInt(100, 999)}`;
  const callbackUrl = `${siteOrigin(request)}/api/qpay/callback?sender=${senderInvoiceNo}`;
  let invoice;
  try {
    invoice = await createInvoice({
      senderInvoiceNo,
      description: quote.discountPercent ? `${quote.product} · ${quote.discountCode} -${quote.discountPercent}%` : quote.product,
      amount: quote.amount,
      callbackUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "QPay нэхэмжлэх үүсгэж чадсангүй.";
    return jsonError(message, 502);
  }

  await adminDb().collection("payments").doc(senderInvoiceNo).set({
    uid: user.uid,
    email: contact,
    amount: quote.amount,
    originalAmount: quote.originalAmount,
    discountCode: quote.discountCode,
    discountPercent: quote.discountPercent,
    product: quote.product,
    mode: quote.mode,
    seriesId: quote.seriesId,
    createdAt: Date.now(),
    date: todayStamp(),
    method: "QPay",
    status: "Хүлээгдэж буй",
    invoiceId: invoice.invoice_id,
    senderInvoiceNo,
    paymentId: "",
    qrImage: invoice.qr_image || "",
    qrText: invoice.qr_text || "",
    urls: invoice.urls || [],
  });

  return NextResponse.json({
    senderInvoiceNo,
    qrImage: invoice.qr_image || "",
    qrText: invoice.qr_text || "",
    urls: invoice.urls || [],
    amount: quote.amount,
    originalAmount: quote.originalAmount,
    discountCode: quote.discountCode,
    discountPercent: quote.discountPercent,
  });
}
