import { createHash, timingSafeEqual } from "crypto";

export const PHONE_SMS_COOLDOWN_MS = 60_000;

export function hashPhoneOtp(phone: string, code: string) {
  return createHash("sha256").update(`${code}:${phone}`).digest("hex");
}

export function phoneOtpMatches(stored: string, phone: string, code: string) {
  const left = Buffer.from(hashPhoneOtp(phone, stored));
  const right = Buffer.from(hashPhoneOtp(phone, hashPhoneOtp(phone, code)));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function phoneDeliveryPlan(input: { wesendReady: boolean; outOfCredit: boolean; verifyReady: boolean }) {
  if (input.wesendReady && !input.outOfCredit) return "otp" as const;
  if (input.verifyReady) return "mo" as const;
  if (!input.wesendReady) return "demo" as const;
  return "blocked" as const;
}
