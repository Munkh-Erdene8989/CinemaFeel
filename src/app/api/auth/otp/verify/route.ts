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
  const body = (await request.json().catch(() => ({}))) as { email?: string; code?: string };
  const email = body.email?.trim().toLowerCase() ?? "";
  const code = body.code?.trim() ?? "";
  if (!email || !/^\d{6}$/.test(code)) return jsonError("6 оронтой код оруулна уу.");

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
  await ref.delete();

  const session = await readUser(request);
  if (session?.uid) {
    const attached = await attachEmail(session.uid, email);
    if (!attached.ok) return jsonError(attached.error, attached.status);
    const token = await adminAuth().createCustomToken(session.uid);
    return NextResponse.json({ token });
  }

  let user;
  try {
    user = await adminAuth().getUserByEmail(email);
  } catch {
    user = await adminAuth().createUser({ email, emailVerified: true });
  }
  const token = await adminAuth().createCustomToken(user.uid);
  return NextResponse.json({ token });
}
