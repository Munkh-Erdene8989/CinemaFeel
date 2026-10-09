import { NextRequest, NextResponse } from "next/server";
import { adminCookieName, adminCookieOptions, createAdminToken, safeEqual } from "@/lib/admin-session";
import { jsonError } from "@/lib/http";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { username?: string; password?: string };
  const username = process.env.ADMIN_USERNAME || "";
  const password = process.env.ADMIN_PASSWORD || "";
  if (!username || !password || !process.env.ADMIN_SESSION_SECRET) return jsonError("Админ нэвтрэлт тохируулаагүй байна.", 500);
  if (!safeEqual(body.username ?? "", username) || !safeEqual(body.password ?? "", password)) {
    return jsonError("Нэвтрэх нэр эсвэл нууц үг буруу.", 401);
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(adminCookieName(), createAdminToken(), adminCookieOptions());
  return response;
}
