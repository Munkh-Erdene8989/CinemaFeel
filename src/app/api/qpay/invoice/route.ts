import { randomInt } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { todayStamp } from "@/lib/format";
import { jsonError, readUser, siteOrigin } from "@/lib/http";
import { createInvoice } from "@/lib/qpay";
import { defaultSettings } from "@/lib/types";

export async function POST(request: NextRequest) {
  const user = await readUser(request);
  if (!user?.uid || !user.email) return jsonError("Нэвтрэх шаардлагатай.", 401);
  const profile = await adminDb().collection("users").doc(user.uid).get();
  if (profile.data()?.status === "Түр зогссон") return jsonError("Таны бүртгэл түр зогссон байна.", 403);

  const body = (await request.json().catch(() => ({}))) as { mode?: string; seriesId?: string | null };
  const settingsSnap = await adminDb().collection("settings").doc("app").get();
  const monthly = Number(settingsSnap.data()?.price || defaultSettings.price);
  let amount = monthly;
  let product = "CinemaFeel Plus";
  let seriesId: string | null = null;
  const mode = body.mode === "single" ? "single" : "subscription";

  if (mode === "single") {
    if (!body.seriesId) return jsonError("Кино сонгоно уу.");
    const series = await adminDb().collection("series").doc(body.seriesId).get();
    if (!series.exists || series.data()?.status !== "Нийтлэгдсэн") return jsonError("Кино олдсонгүй.", 404);
    amount = Number(series.data()?.price ?? 0);
    if (amount <= 0) return jsonError("Энэ кино үнэгүй.");
    product = String(series.data()?.title ?? "Кино");
    seriesId = body.seriesId;
  }

  const senderInvoiceNo = `CF${Date.now()}${randomInt(100, 999)}`;
  const callbackUrl = `${siteOrigin(request)}/api/qpay/callback?sender=${senderInvoiceNo}`;
  let invoice;
  try {
    invoice = await createInvoice({
      senderInvoiceNo,
      description: product,
      amount,
      callbackUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "QPay нэхэмжлэх үүсгэж чадсангүй.";
    return jsonError(message, 502);
  }

  await adminDb().collection("payments").doc(senderInvoiceNo).set({
    uid: user.uid,
    email: user.email,
    amount,
    product,
    mode,
    seriesId,
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
    amount,
  });
}
