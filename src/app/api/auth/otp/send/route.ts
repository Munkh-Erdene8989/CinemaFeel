import { createHash, randomInt } from "crypto";
import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { jsonError } from "@/lib/http";
import { sendOtpEmail, smtpConfigured } from "@/lib/mail";
import { NextResponse } from "next/server";

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = body.email?.trim().toLowerCase() ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError("Зөв email хаяг оруулна уу.");
  if (!smtpConfigured()) {
    return jsonError("Имэйл илгээх тохиргоо дутуу байна. SMTP мэдээллээ нэмээд дахин оролдоно уу.", 503);
  }

  const ref = adminDb().collection("otp").doc(hash(email));
  const existing = await ref.get();
  if (existing.exists && Date.now() - Number(existing.data()?.createdAt ?? 0) < 60_000) {
    return jsonError("Код дахин илгээхийн тулд 1 минут хүлээнэ үү.", 429);
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  try {
    await sendOtpEmail(email, code);
  } catch {
    return jsonError("Имэйл илгээж чадсангүй. SMTP тохиргоогоо шалгана уу.", 502);
  }

  await ref.set({
    codeHash: hash(`${code}:${email}`),
    expiresAt: Date.now() + 10 * 60 * 1000,
    attempts: 0,
    createdAt: Date.now(),
  });
  return NextResponse.json({ ok: true });
}
