import assert from "node:assert/strict";
import test from "node:test";
import { SESSION_TTL_SEC, sessionExpired, sessionRemainingMs } from "./session-ttl.ts";

const authTime = 1_700_000_000;

test("a sign-in stays valid through the seventh day", () => {
  const signedIn = authTime * 1000;
  assert.equal(sessionExpired(authTime, signedIn + SESSION_TTL_SEC * 1000 - 1), false);
  assert.equal(sessionExpired(authTime, signedIn + SESSION_TTL_SEC * 1000), true);
  assert.equal(sessionRemainingMs(authTime, signedIn), SESSION_TTL_SEC * 1000);
});

test("a missing sign-in time is already expired", () => {
  assert.equal(sessionExpired(undefined), true);
  assert.equal(sessionExpired(Number.NaN), true);
});
