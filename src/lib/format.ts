import type { AppUser } from "./types";

export function subscriptionActive(user: Pick<AppUser, "plan" | "status" | "subscriptionExpiresAt"> | null) {
  if (!user || user.status !== "Идэвхтэй") return false;
  if (user.plan !== "Plus") return false;
  return typeof user.subscriptionExpiresAt === "number" && user.subscriptionExpiresAt > Date.now();
}

export function formatMoney(amount: number) {
  return `${amount.toLocaleString("mn-MN")}₮`;
}

export function formatDate(value: number | string) {
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

export function formatViews(views: number) {
  if (views >= 1000) return `${Math.round(views / 1000)}K`;
  return String(views);
}

export function todayStamp() {
  return formatDate(Date.now());
}

export function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("976") && digits.length >= 11 ? digits.slice(-8) : digits;
  if (local.length === 8) return `${local.slice(0, 4)} ${local.slice(4)}`;
  return value;
}

export function accountIdentity(email?: string | null, phone?: string | null) {
  if (email) return email;
  if (phone) return formatPhone(phone);
  return "";
}

export function accountInitial(email?: string | null, phone?: string | null) {
  if (email) return email[0]?.toUpperCase() || "C";
  const digits = (phone || "").replace(/\D/g, "");
  return digits.slice(-1) || "C";
}
