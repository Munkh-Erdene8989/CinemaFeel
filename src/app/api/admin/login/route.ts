import { NextRequest, NextResponse } from "next/server";
import { adminCookieName, adminCookieOptions, createAdminToken, safeEqual } from "@/lib/admin-session";
import { jsonError } from "@/lib/http";
import { findStaffByUsername, normalizeUsername, verifyPassword } from "@/lib/staff";
import { SUPER_ADMIN_ID } from "@/lib/types";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { username?: string; password?: string };
  const username = process.env.ADMIN_USERNAME || "";
  const password = process.env.ADMIN_PASSWORD || "";
  const givenName = body.username ?? "";
  const givenPassword = body.password ?? "";
  if (!username || !password || !process.env.ADMIN_SESSION_SECRET) return jsonError("Админ нэвтрэлт тохируулаагүй байна.", 500);

  if (safeEqual(givenName, username) && safeEqual(givenPassword, password)) {
    const response = NextResponse.json({ ok: true, role: "super" });
    response.cookies.set(
      adminCookieName(),
      createAdminToken({ role: "super", adminId: SUPER_ADMIN_ID, name: "Super admin" }),
      adminCookieOptions(),
    );
    return response;
  }

  const staff = await findStaffByUsername(normalizeUsername(givenName));
  if (!staff || staff.active === false || !verifyPassword(givenPassword, String(staff.passwordHash ?? ""))) {
    return jsonError("Нэвтрэх нэр эсвэл нууц үг буруу.", 401);
  }
  const response = NextResponse.json({ ok: true, role: "admin" });
  response.cookies.set(
    adminCookieName(),
    createAdminToken({ role: "admin", adminId: staff.id, name: staff.name || staff.username }),
    adminCookieOptions(),
  );
  return response;
}
