import { createHmac, timingSafeEqual, createHash } from "crypto";
import type { AdminRole, AdminSession } from "./types";

const COOKIE = "cf_admin";
const WEEK = 60 * 60 * 24 * 7;

function secret() {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (!value) throw new Error("ADMIN_SESSION_SECRET дутуу байна.");
  return value;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function adminCookieName() {
  return COOKIE;
}

export function createAdminToken(session: AdminSession) {
  const payload = Buffer.from(JSON.stringify({ ...session, exp: Date.now() + WEEK * 1000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyAdminToken(token: string | undefined | null): AdminSession | null {
  if (!token || !process.env.ADMIN_SESSION_SECRET) return null;
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return null;
  const expected = sign(payload);
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      role?: AdminRole | "admin";
      adminId?: string;
      name?: string;
      exp?: number;
    };
    if (typeof data.exp !== "number" || data.exp <= Date.now()) return null;
    if (data.role === "super" || (data.role === "admin" && !data.adminId)) {
      return { role: "super", adminId: "super", name: data.name || "Super admin" };
    }
    if (data.role === "admin" && data.adminId) {
      return { role: "admin", adminId: data.adminId, name: data.name || data.adminId };
    }
    return null;
  } catch {
    return null;
  }
}

export function safeEqual(a: string, b: string) {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: WEEK,
  };
}
