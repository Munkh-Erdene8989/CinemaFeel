import assert from "node:assert/strict";
import test from "node:test";
import { playbackProvider } from "./mux-source.ts";

test("a ready Mux asset plays before the stored file", () => {
  assert.equal(playbackProvider({ muxPlaybackId: "abc", muxStatus: "ready" }), "mux");
  assert.equal(playbackProvider({ muxPlaybackId: "abc", muxStatus: "preparing" }), "firebase");
  assert.equal(playbackProvider({ muxPlaybackId: "", muxStatus: "ready" }), "firebase");
});

test("an explicit fallback always uses the stored file", () => {
  assert.equal(playbackProvider({ fallback: true, muxPlaybackId: "abc", muxStatus: "ready" }), "firebase");
});
