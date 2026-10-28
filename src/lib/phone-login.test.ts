import assert from "node:assert/strict";
import test from "node:test";
import { hashPhoneOtp, PHONE_SMS_COOLDOWN_MS, phoneDeliveryPlan, phoneOtpMatches } from "./phone-login.ts";

test("the next login sms waits one minute", () => {
  assert.equal(PHONE_SMS_COOLDOWN_MS, 60_000);
});

test("otp check accepts only the code sent to that phone", () => {
  const stored = hashPhoneOtp("99112233", "0482");
  assert.equal(phoneOtpMatches(stored, "99112233", "0482"), true);
  assert.equal(phoneOtpMatches(stored, "99112233", "0483"), false);
  assert.equal(phoneOtpMatches(stored, "99112234", "0482"), false);
});

test("wesend sends the code until credits run out", () => {
  assert.equal(phoneDeliveryPlan({ wesendReady: true, outOfCredit: false, verifyReady: true }), "otp");
  assert.equal(phoneDeliveryPlan({ wesendReady: true, outOfCredit: false, verifyReady: false }), "otp");
  assert.equal(phoneDeliveryPlan({ wesendReady: true, outOfCredit: true, verifyReady: true }), "mo");
  assert.equal(phoneDeliveryPlan({ wesendReady: true, outOfCredit: true, verifyReady: false }), "blocked");
  assert.equal(phoneDeliveryPlan({ wesendReady: false, outOfCredit: false, verifyReady: true }), "mo");
  assert.equal(phoneDeliveryPlan({ wesendReady: false, outOfCredit: false, verifyReady: false }), "demo");
});
