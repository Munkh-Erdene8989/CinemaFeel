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
  const source = data.source === "self" ? "self" : "manual";
  return {
    id,
    username: String(data.username ?? ""),
    name: String(data.name ?? ""),
    active: data.active !== false,
    createdAt: Number(data.createdAt ?? 0),
    phone: String(data.phone ?? ""),
    email: String(data.email ?? ""),
    paid: source === "self" ? data.paid === true : true,
    source,
    contentType: String(data.contentType ?? ""),
    bankName: String(data.bankName ?? ""),
    bankAccount: String(data.bankAccount ?? ""),
    inviteCode: String(data.inviteCode ?? ""),
    invitedById: String(data.invitedById ?? ""),
    invitedByCode: String(data.invitedByCode ?? ""),
    invitedByName: String(data.invitedByName ?? ""),
    firstName: String(data.firstName ?? ""),
    lastName: String(data.lastName ?? ""),
    portfolio: String(data.portfolio ?? ""),
    experience: String(data.experience ?? ""),
    termsAcceptedAt: Number(data.termsAcceptedAt ?? 0),
  };
}

const inviteAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeInviteCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function randomInviteCode(length = 6) {
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => inviteAlphabet[byte % inviteAlphabet.length]).join("");
}

export async function uniqueInviteCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = randomInviteCode();
    const existing = await adminDb().collection("admins").where("inviteCode", "==", code).limit(1).get();
    if (existing.empty) return code;
  }
  return randomInviteCode(8);
}

export async function findInviter(code: string) {
  if (!code) return null;
  const snap = await adminDb().collection("admins").where("inviteCode", "==", code).limit(1).get();
  const doc = snap.docs[0];
  if (!doc || doc.data().active === false) return null;
  return { id: doc.id, name: String(doc.data().name || doc.data().username || ""), inviteCode: code };
}

export async function findStaffByUsername(username: string) {
  const snap = await adminDb().collection("admins").where("username", "==", username).limit(1).get();
  const doc = snap.docs[0];
  if (!doc) return null;
  return { id: doc.id, ...doc.data() } as { id: string; username: string; name: string; passwordHash: string; active?: boolean };
}
