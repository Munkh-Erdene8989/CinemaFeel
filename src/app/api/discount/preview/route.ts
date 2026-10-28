import { NextRequest, NextResponse } from "next/server";
import { viewerCheckoutQuote } from "@/lib/discount";
import { adminDb } from "@/lib/firebase-admin";
import { jsonError, readUser } from "@/lib/http";
import { defaultSettings, mergeSettings, settingAmount, WEEKLY_PRICE, type Settings } from "@/lib/types";

export async function POST(request: NextRequest) {
  const user = await readUser(request);
  if (!user?.uid) return jsonError("Нэвтрэх шаардлагатай.", 401);
  const body = (await request.json().catch(() => ({}))) as { mode?: string; seriesId?: string | null; code?: string };
  if (!body.code?.trim()) return jsonError("Хөнгөлөлтийн код оруулна уу.");
  const settingsSnap = await adminDb().collection("settings").doc("app").get();
  const settings = mergeSettings(settingsSnap.data() as Partial<Settings> | undefined);
  const monthly = settingAmount(settings.price, Number(defaultSettings.price));
  const weekly = settingAmount(settings.weeklyPrice, WEEKLY_PRICE);
  const quote = await viewerCheckoutQuote({ mode: body.mode, seriesId: body.seriesId, code: body.code, monthlyPrice: monthly, weeklyPrice: weekly, uid: user.uid });
  if (!quote.ok) return jsonError(quote.error, quote.status);
  return NextResponse.json({
    code: quote.discountCode,
    percent: quote.discountPercent,
    originalAmount: quote.originalAmount,
    amount: quote.amount,
  });
}
