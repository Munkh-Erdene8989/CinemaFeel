import { WEEKLY_DAYS, WEEKLY_PRICE, type CheckoutMode } from "./types";

export const SUBSCRIPTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export function isSubscriptionCheckout(mode: string): mode is "subscription" | "weekly" {
  return mode === "subscription" || mode === "weekly";
}

export function viewerCheckoutMode(mode?: string): "single" | "weekly" | "subscription" {
  if (mode === "single" || mode === "weekly") return mode;
  return "subscription";
}

export function checkoutListAmount(mode: string, input: { monthlyPrice: number; weeklyPrice?: number; singlePrice?: number }) {
  if (mode === "single") return input.singlePrice ?? 0;
  if (mode === "weekly") return input.weeklyPrice && input.weeklyPrice > 0 ? input.weeklyPrice : WEEKLY_PRICE;
  return input.monthlyPrice;
}

export function grantPass(mode: "subscription" | "weekly", currentExpiresAt: number, now = Date.now()) {
  const days = mode === "weekly" ? WEEKLY_DAYS : SUBSCRIPTION_DAYS;
  const base = Math.max(now, currentExpiresAt);
  return {
    plan: "Plus" as const,
    status: "Идэвхтэй" as const,
    subscriptionExpiresAt: base + days * DAY_MS,
  };
}

export function revokePass(now = Date.now()) {
  return {
    plan: "Үндсэн" as const,
    subscriptionExpiresAt: now,
  };
}

export function extendPass(currentExpiresAt: number, now = Date.now()) {
  if (currentExpiresAt >= now) return {};
  return { subscriptionExpiresAt: now + SUBSCRIPTION_DAYS * DAY_MS };
}

export function clearPass() {
  return { subscriptionExpiresAt: 0 };
}

export function creatorMayWatchOwn(admin: { active?: boolean; paid?: boolean; source?: string } | null | undefined) {
  if (!admin || admin.active === false) return false;
  return admin.source === "self" ? admin.paid === true : true;
}

export function contactsMatch(
  left: { email?: string | null; phone?: string | null } | null | undefined,
  right: { email?: string | null; phone?: string | null } | null | undefined,
) {
  const email = String(left?.email ?? "").trim().toLowerCase();
  const otherEmail = String(right?.email ?? "").trim().toLowerCase();
  if (email && otherEmail && email === otherEmail) return true;
  const phone = String(left?.phone ?? "").trim();
  const otherPhone = String(right?.phone ?? "").trim();
  return Boolean(phone && otherPhone && phone === otherPhone);
}

export function alreadyEntitled(
  film: { id: string; ownerId?: string },
  input: { ownedIds: readonly string[]; subscribed: boolean; creatorId?: string },
) {
  if (input.subscribed || input.ownedIds.includes(film.id)) return true;
  return Boolean(input.creatorId && film.ownerId === input.creatorId);
}
