import { createHash, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { attachEmail } from "@/lib/attach-email";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { jsonError, readUser } from "@/lib/http";

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function same(a: string, b: string) {
  const left = Buffer.from(hash(a));
  const right = Buffer.from(hash(b));
  return timingSafeEqual(left, right);
}

export async function POST(request: NextRequest) {
  const decoded = await readUser(request);
  if (!decoded?.uid) return jsonError("Нэвтрэх шаардлагатай.", 401);

  const body = (await request.json().catch(() => ({}))) as { email?: string; code?: string };
  const email = body.email?.trim().toLowerCase() ?? "";
  const code = body.code?.trim() ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError("Зөв email хаяг оруулна уу.");
  if (!/^\d{6}$/.test(code)) return jsonError("6 оронтой код оруулна уу.");

  const ref = adminDb().collection("otp").doc(hash(email));
  const snap = await ref.get();
  if (!snap.exists) return jsonError("Код олдсонгүй. Дахин авна уу.", 400);
  const data = snap.data() ?? {};
  if (Number(data.expiresAt) < Date.now()) {
    await ref.delete();
    return jsonError("Кодын хугацаа дууссан байна.", 400);
  }
  if (Number(data.attempts ?? 0) >= 5) return jsonError("Оролдлого хэтэрлээ. Шинэ код авна уу.", 429);
  if (!same(String(data.codeHash), hash(`${code}:${email}`))) {
    await ref.set({ attempts: Number(data.attempts ?? 0) + 1 }, { merge: true });
    return jsonError("Код буруу байна.", 400);
  }

  const attached = await attachEmail(decoded.uid, email);
  if (!attached.ok) return jsonError(attached.error, attached.status);
  await ref.delete();
  const token = await adminAuth().createCustomToken(decoded.uid);
  return NextResponse.json({ ok: true, token });
}
