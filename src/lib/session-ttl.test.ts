import assert from "node:assert/strict";
import test from "node:test";
import { SESSION_TTL_SEC, sessionCheckDelayMs, sessionExpired, sessionRemainingMs } from "./session-ttl.ts";

const authTime = 1_700_000_000;

test("a sign-in stays valid for 90 days", () => {
  const signedIn = authTime * 1000;
  assert.equal(SESSION_TTL_SEC, 60 * 60 * 24 * 90);
  assert.equal(sessionExpired(authTime, signedIn + SESSION_TTL_SEC * 1000 - 1), false);
  assert.equal(sessionExpired(authTime, signedIn + SESSION_TTL_SEC * 1000), true);
  assert.equal(sessionRemainingMs(authTime, signedIn), SESSION_TTL_SEC * 1000);
});

test("the open-tab check stays inside the timer limit", () => {
  const signedIn = authTime * 1000;
  const delay = sessionCheckDelayMs(authTime, signedIn);
  assert.equal(delay, 2_147_483_647);
  assert.ok(delay < sessionRemainingMs(authTime, signedIn));
});

test("a missing sign-in time is already expired", () => {
  assert.equal(sessionExpired(undefined), true);
  assert.equal(sessionExpired(Number.NaN), true);
});
