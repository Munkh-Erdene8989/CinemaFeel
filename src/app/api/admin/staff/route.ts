import { NextRequest, NextResponse } from "next/server";
import { newId } from "@/lib/catalog";
import { announceCreator, sendCreatorWelcome } from "@/lib/creator-notice";
import { adminDb } from "@/lib/firebase-admin";
import { jsonError, requireSuper } from "@/lib/http";
import { hashPassword, mapStaff, normalizeUsername, uniqueInviteCode, validUsername } from "@/lib/staff";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: NextRequest) {
  const gate = await requireSuper(request);
  if (gate.error) return gate.error;
  const snap = await adminDb().collection("admins").get();
  const admins = snap.docs.map((item) => mapStaff(item.id, item.data() as Record<string, unknown>));
  admins.sort((a, b) => b.createdAt - a.createdAt);
  return NextResponse.json({ admins });
}

export async function POST(request: NextRequest) {
  const gate = await requireSuper(request);
  if (gate.error) return gate.error;
  const body = (await request.json().catch(() => ({}))) as { username?: string; name?: string; password?: string; email?: string };
  const username = normalizeUsername(body.username ?? "");
  const name = String(body.name ?? "").trim();
  const password = String(body.password ?? "");
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!validUsername(username)) return jsonError("Нэвтрэх нэр 3–32 тэмдэгт, жижиг үсэг болон тоо байна.");
  if (name.length < 2) return jsonError("Контент бүтээгчийн нэр оруулна уу.");
  if (password.length < 6) return jsonError("Нууц үг хамгийн багадаа 6 тэмдэгт.");
  if (!emailPattern.test(email) || email.length > 120) return jsonError("И-мэйл хаяг буруу байна.");
  const superName = (process.env.ADMIN_USERNAME || "").trim().toLowerCase();
  if (superName && username === superName) return jsonError("Энэ нэвтрэх нэр super admin-д ашиглагдсан.");
  const existing = await adminDb().collection("admins").where("username", "==", username).limit(1).get();
  if (!existing.empty) return jsonError("Энэ нэвтрэх нэр бүртгэлтэй байна.");
  const emailTaken = await adminDb().collection("admins").where("email", "==", email).limit(1).get();
  if (!emailTaken.empty) return jsonError("Энэ и-мэйл бүртгэлтэй байна.");
  const id = newId();
  const profile = {
    username,
    name,
    email,
    passwordHash: hashPassword(password),
    active: true,
    paid: true,
    source: "manual" as const,
    kind: "creator",
    inviteCode: await uniqueInviteCode(),
    createdAt: Date.now(),
  };
  await adminDb().collection("admins").doc(id).set(profile);

  let welcomeError = "";
  try {
    const welcomed = await sendCreatorWelcome({
      creatorId: id,
      email,
      name,
      username,
      password,
      ready: true,
    });
    if (!welcomed.ok) welcomeError = welcomed.error;
  } catch (error) {
    console.error("creator welcome email failed", error);
    welcomeError = "Нэвтрэх мэдээллийн имэйл илгээгдсэнгүй.";
  }

  const notice = await announceCreator(id);
  return NextResponse.json({
    admin: mapStaff(id, { ...profile, welcomeEmail: welcomeError ? undefined : "sent" }),
    welcomeError: welcomeError || undefined,
    emailed: notice.emailed || undefined,
    notifyError: notice.notifyError,
  });
}
