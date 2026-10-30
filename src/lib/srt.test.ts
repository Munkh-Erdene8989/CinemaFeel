import assert from "node:assert/strict";
import test from "node:test";
import { srtToVtt } from "./srt.ts";

test("srt commas become webvtt dots", () => {
  const vtt = srtToVtt("1\n00:00:01,200 --> 00:00:03,400\nСайн уу\n");
  assert.match(vtt, /^WEBVTT\n/);
  assert.match(vtt, /00:00:01\.200 --> 00:00:03\.400/);
  assert.match(vtt, /Сайн уу/);
});

test("offset shifts cue times and clamps at zero", () => {
  const vtt = srtToVtt("1\n00:00:01,000 --> 00:00:02,000\nМөр\n", -1500);
  assert.match(vtt, /00:00:00\.000 --> 00:00:00\.500/);
});
