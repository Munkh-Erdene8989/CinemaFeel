import { NextRequest, NextResponse } from "next/server";
import { newId } from "@/lib/catalog";
import { adminDb } from "@/lib/firebase-admin";
import { jsonError, requireSuper } from "@/lib/http";
import { hashPassword, mapStaff, normalizeUsername, validUsername } from "@/lib/staff";

export async function GET(request: NextRequest) {
  const gate = await requireSuper(request);
  if (gate.error) return gate.error;
  const snap = await adminDb().collection("admins").get();
  const admins = snap.docs
    .map((item) => mapStaff(item.id, item.data() as Record<string, unknown>))
    .sort((a, b) => b.createdAt - a.createdAt);
  return NextResponse.json({ admins });
}

export async function POST(request: NextRequest) {
  const gate = await requireSuper(request);
  if (gate.error) return gate.error;
  const body = (await request.json().catch(() => ({}))) as { username?: string; name?: string; password?: string };
  const username = normalizeUsername(body.username ?? "");
  const name = String(body.name ?? "").trim();
  const password = String(body.password ?? "");
  if (!validUsername(username)) return jsonError("Нэвтрэх нэр 3–32 тэмдэгт, жижиг үсэг болон тоо байна.");
  if (name.length < 2) return jsonError("Админы нэр оруулна уу.");
  if (password.length < 6) return jsonError("Нууц үг хамгийн багадаа 6 тэмдэгт.");
  const superName = (process.env.ADMIN_USERNAME || "").trim().toLowerCase();
  if (superName && username === superName) return jsonError("Энэ нэвтрэх нэр super admin-д ашиглагдсан.");
  const existing = await adminDb().collection("admins").where("username", "==", username).limit(1).get();
  if (!existing.empty) return jsonError("Энэ нэвтрэх нэр бүртгэлтэй байна.");
  const id = newId();
  await adminDb().collection("admins").doc(id).set({
    username,
    name,
    passwordHash: hashPassword(password),
    active: true,
    createdAt: Date.now(),
  });
  return NextResponse.json({ id });
}
