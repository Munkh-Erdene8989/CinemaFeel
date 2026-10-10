import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "./admin-session";
import { adminAuth, adminDb } from "./firebase-admin";
import type { AdminSession } from "./types";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function assertAdmin(request: NextRequest): Promise<AdminSession | null> {
  const session = verifyAdminToken(request.cookies.get("cf_admin")?.value);
  if (!session) return null;
  if (session.role !== "admin") return session;
  const snap = await adminDb().collection("admins").doc(session.adminId).get();
  if (!snap.exists || snap.data()?.active === false) return null;
  return session;
}

export async function requireSuper(request: NextRequest) {
  const session = await assertAdmin(request);
  if (!session) return { session: null, error: jsonError("Нэвтрэх шаардлагатай.", 401) };
  if (session.role !== "super") return { session, error: jsonError("Зөвхөн super admin хийнэ.", 403) };
  return { session, error: null };
}

export async function readUser(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  try {
    return await adminAuth().verifyIdToken(token);
  } catch {
    return null;
  }
}

export function siteOrigin(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
