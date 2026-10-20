import assert from "node:assert/strict";
import test from "node:test";
import { playbackMark } from "./playback-mark.ts";

test("phone and email show together with the site", () => {
  assert.equal(playbackMark({ phone: "99112233", email: "a@b.com" }), "99112233\na@b.com\nCinemaFeel.mn");
});

test("email shows with the site when there is no phone", () => {
  assert.equal(playbackMark({ email: "a@b.com" }), "a@b.com\nCinemaFeel.mn");
});

test("phone shows with the site when there is no email", () => {
  assert.equal(playbackMark({ phone: "99112233" }), "99112233\nCinemaFeel.mn");
});

test("invalid email without a phone renders nothing", () => {
  assert.equal(playbackMark({ email: "not-an-email" }), "");
});

test("empty identity renders nothing", () => {
  assert.equal(playbackMark({}), "");
});
