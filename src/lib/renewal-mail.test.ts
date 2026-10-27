import assert from "node:assert/strict";
import test from "node:test";
import {
  formatOfferDeadline,
  offerStillQuiet,
  renewalKind,
  renewalOfferCodeFromBytes,
  renewalOfferError,
  renewalRecipient,
  shiftDateKey,
  ubDateKey,
  type RenewalOffer,
} from "./renewal-mail.ts";

const now = Date.parse("2026-10-27T02:00:00.000Z");

test("renewal windows follow Ulaanbaatar calendar days", () => {
  assert.equal(ubDateKey(now), "2026-10-27");
  assert.equal(renewalKind(Date.parse("2026-10-30T02:00:00.000Z"), now), "d3");
  assert.equal(renewalKind(Date.parse("2026-10-29T16:00:00.000Z"), now), "d3");
  assert.equal(renewalKind(Date.parse("2026-10-28T10:00:00.000Z"), now), "d1");
  assert.equal(renewalKind(Date.parse("2026-10-24T05:00:00.000Z"), now), "offer");
  assert.equal(renewalKind(Date.parse("2026-10-27T12:00:00.000Z"), now), null);
  assert.equal(renewalKind(0, now), null);
  assert.equal(shiftDateKey("2026-10-27", -3), "2026-10-24");
});

test("paused accounts and addresses without a mailbox are skipped", () => {
  assert.equal(renewalRecipient("Ada@CinemaFeel.mn", "Идэвхтэй"), "ada@cinemafeel.mn");
  assert.equal(renewalRecipient("ada@cinemafeel.mn", "Түр зогссон"), "");
  assert.equal(renewalRecipient("99112233", "Идэвхтэй"), "");
});

test("a watch after the package ended is no longer quiet", () => {
  const expiresAt = Date.parse("2026-10-24T05:00:00.000Z");
  assert.equal(offerStillQuiet(0, expiresAt), true);
  assert.equal(offerStillQuiet(expiresAt - 1, expiresAt), true);
  assert.equal(offerStillQuiet(expiresAt, expiresAt), false);
});

test("a personal offer only fits its owner, package, and 24 hours", () => {
  const offer: RenewalOffer = {
    code: "RABCDEFGHJ",
    uid: "ada",
    percent: 20,
    cycle: "2026-10-24",
    createdAt: now,
    expiresAt: now + 60_000,
    usedAt: 0,
  };
  assert.equal(renewalOfferError(offer, { uid: "ada", mode: "subscription", now }), "");
  assert.equal(renewalOfferError(offer, { uid: "ada", mode: "weekly", now }), "");
  assert.match(renewalOfferError(offer, { uid: "bolt", mode: "subscription", now }), /чамд/);
  assert.match(renewalOfferError(offer, { uid: "ada", mode: "single", now }), /багц/);
  assert.match(renewalOfferError({ ...offer, usedAt: 5 }, { uid: "ada", mode: "weekly", now }), /ашигласан/);
  assert.match(renewalOfferError({ ...offer, expiresAt: now }, { uid: "ada", mode: "weekly", now }), /24 цаг/);
  assert.equal(renewalOfferCodeFromBytes(Uint8Array.from({ length: 10 }, () => 0)), "RAAAAAAAAAA");
  assert.match(formatOfferDeadline(now), /10/);
});
