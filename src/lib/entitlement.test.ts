import assert from "node:assert/strict";
import test from "node:test";
import { checkoutListAmount, clearPass, extendPass, grantPass, revokePass, SUBSCRIPTION_DAYS, viewerCheckoutMode } from "./entitlement.ts";
import { WEEKLY_DAYS, WEEKLY_PRICE } from "./types.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const now = 1_700_000_000_000;

test("a pass grant stacks on the later of now and the current expiry", () => {
  const weekly = grantPass("weekly", 0, now);
  assert.equal(weekly.plan, "Plus");
  assert.equal(weekly.subscriptionExpiresAt, now + WEEKLY_DAYS * DAY_MS);
  const stacked = grantPass("subscription", now + 5 * DAY_MS, now);
  assert.equal(stacked.subscriptionExpiresAt, now + (5 + SUBSCRIPTION_DAYS) * DAY_MS);
});

test("revoke is the inverse of a pass, and a manual basic plan clears expiry", () => {
  assert.deepEqual(revokePass(now), { plan: "Үндсэн", subscriptionExpiresAt: now });
  assert.deepEqual(clearPass(), { subscriptionExpiresAt: 0 });
  assert.deepEqual(extendPass(now + DAY_MS, now), {});
  assert.deepEqual(extendPass(now - 1, now), { subscriptionExpiresAt: now + SUBSCRIPTION_DAYS * DAY_MS });
});

test("checkout amounts follow the mode", () => {
  assert.equal(checkoutListAmount("weekly", { monthlyPrice: 14900 }), WEEKLY_PRICE);
  assert.equal(checkoutListAmount("subscription", { monthlyPrice: 14900 }), 14900);
  assert.equal(checkoutListAmount("single", { monthlyPrice: 14900, singlePrice: 3900 }), 3900);
  assert.equal(viewerCheckoutMode("creator"), "subscription");
  assert.equal(viewerCheckoutMode("weekly"), "weekly");
});
