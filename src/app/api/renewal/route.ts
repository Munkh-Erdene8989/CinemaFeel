import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { jsonError, readUser } from "@/lib/http";
import { asRenewalOffer } from "@/lib/renewal-mail";
import { normalizeDiscountCode } from "@/lib/discount";

export async function GET(request: NextRequest) {
  const user = await readUser(request);
  if (!user?.uid) return jsonError("Нэвтрэх шаардлагатай.", 401);
  const code = normalizeDiscountCode(request.nextUrl.searchParams.get("code") ?? "");
  if (!code) return jsonError("Хөнгөлөлт олдсонгүй.");
  const snap = await adminDb().collection("renewalOffers").doc(code).get();
  if (!snap.exists) return jsonError("Хөнгөлөлт олдсонгүй.", 404);
  const offer = asRenewalOffer(code, snap.data() as Record<string, unknown> | undefined);
  if (offer.uid !== user.uid) return jsonError("Энэ хөнгөлөлт зөвхөн чамд зориулагдсан.", 403);
  const now = Date.now();
  return NextResponse.json({
    code: offer.code,
    percent: offer.percent,
    expiresAt: offer.expiresAt,
    used: offer.usedAt > 0,
    expired: offer.expiresAt <= now,
  });
}
