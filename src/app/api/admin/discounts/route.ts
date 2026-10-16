import { NextRequest, NextResponse } from "next/server";
import { asDiscount, normalizeDiscountCode, validDiscountCode, validDiscountPercent } from "@/lib/discount";
import { adminDb } from "@/lib/firebase-admin";
import { jsonError, requireSuper } from "@/lib/http";

export async function GET(request: NextRequest) {
  const gate = await requireSuper(request);
  if (gate.error) return gate.error;
  const snap = await adminDb().collection("discounts").get();
  const discounts = snap.docs
    .map((item) => asDiscount(item.id, item.data() as Record<string, unknown>))
    .sort((a, b) => b.createdAt - a.createdAt);
  return NextResponse.json({ discounts });
}

export async function POST(request: NextRequest) {
  const gate = await requireSuper(request);
  if (gate.error) return gate.error;
  const body = (await request.json().catch(() => ({}))) as { code?: string; percent?: number };
  const code = normalizeDiscountCode(body.code ?? "");
  if (!validDiscountCode(code)) return jsonError("Код 3–20 үсэг эсвэл тоо байна.");
  if (!validDiscountPercent(body.percent)) return jsonError("Хөнгөлөлт 1–99 хувь байна.");

  const ref = adminDb().collection("discounts").doc(code);
  const existing = await ref.get();
  if (existing.exists) return jsonError("Энэ код бүртгэлтэй байна.");
  const discount = { code, percent: Number(body.percent), active: true, usedCount: 0, createdAt: Date.now() };
  await ref.set(discount);
  return NextResponse.json({ discount });
}

export async function PATCH(request: NextRequest) {
  const gate = await requireSuper(request);
  if (gate.error) return gate.error;
  const body = (await request.json().catch(() => ({}))) as { code?: string; percent?: number; active?: boolean };
  const code = normalizeDiscountCode(body.code ?? "");
  if (!validDiscountCode(code)) return jsonError("Код олдсонгүй.");
  const ref = adminDb().collection("discounts").doc(code);
  const snap = await ref.get();
  if (!snap.exists) return jsonError("Код олдсонгүй.", 404);

  const patch: { percent?: number; active?: boolean } = {};
  if (body.percent !== undefined) {
    if (!validDiscountPercent(body.percent)) return jsonError("Хөнгөлөлт 1–99 хувь байна.");
    patch.percent = Number(body.percent);
  }
  if (typeof body.active === "boolean") patch.active = body.active;
  if (!Object.keys(patch).length) return jsonError("Өөрчлөлт олдсонгүй.");
  await ref.set(patch, { merge: true });
  return NextResponse.json({ discount: asDiscount(code, { ...(snap.data() as Record<string, unknown>), ...patch }) });
}

export async function DELETE(request: NextRequest) {
  const gate = await requireSuper(request);
  if (gate.error) return gate.error;
  const body = (await request.json().catch(() => ({}))) as { code?: string };
  const code = normalizeDiscountCode(body.code ?? "");
  if (!validDiscountCode(code)) return jsonError("Код олдсонгүй.");
  const ref = adminDb().collection("discounts").doc(code);
  const snap = await ref.get();
  if (!snap.exists) return jsonError("Код олдсонгүй.", 404);
  await ref.delete();
  return NextResponse.json({ ok: true });
}
