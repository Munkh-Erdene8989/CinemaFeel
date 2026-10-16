import assert from "node:assert/strict";
import test from "node:test";
import { playbackDenial, retrySubscribedPaywall } from "./playback.ts";

test("playback denial is sign-in, then pay", () => {
  assert.deepEqual(playbackDenial(false, false), { error: "Үзэхийн тулд нэвтэрнэ үү.", code: "auth", status: 401 });
  assert.equal(playbackDenial(true, false)?.code, "paywall");
  assert.equal(playbackDenial(true, true), null);
});

test("a subscribed viewer retries one paywall", () => {
  assert.equal(retrySubscribedPaywall("paywall", true, false), true);
  assert.equal(retrySubscribedPaywall("paywall", true, true), false);
  assert.equal(retrySubscribedPaywall("paywall", false, false), false);
  assert.equal(retrySubscribedPaywall("auth", true, false), false);
});
