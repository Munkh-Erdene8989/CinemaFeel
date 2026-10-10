import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { adminDb } from "./firebase-admin";
import type { StaffAdmin } from "./types";

const usernamePattern = /^[a-z0-9._-]{3,32}$/;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 32);
  const left = Buffer.from(hash, "hex");
  if (left.length !== next.length) return false;
  return timingSafeEqual(left, next);
}

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function validUsername(value: string) {
  return usernamePattern.test(value);
}

export function mapStaff(id: string, data: Record<string, unknown>): StaffAdmin {
  return {
    id,
    username: String(data.username ?? ""),
    name: String(data.name ?? ""),
    active: data.active !== false,
    createdAt: Number(data.createdAt ?? 0),
  };
}

export async function findStaffByUsername(username: string) {
  const snap = await adminDb().collection("admins").where("username", "==", username).limit(1).get();
  const doc = snap.docs[0];
  if (!doc) return null;
  return { id: doc.id, ...doc.data() } as { id: string; username: string; name: string; passwordHash: string; active?: boolean };
}
