import assert from "node:assert/strict";
import test from "node:test";
import { readVideoSize, videoFrame } from "./video-frame.ts";

test("a wider frame is landscape and a taller frame is portrait", () => {
  assert.equal(videoFrame(1920, 1080)?.landscape, true);
  assert.equal(videoFrame(1080, 1920)?.landscape, false);
  assert.equal(videoFrame(1080, 1080)?.landscape, false);
  assert.equal(videoFrame(0, 1080), null);
});

test("size is read from the media element or its player wrapper", () => {
  assert.deepEqual(readVideoSize({ videoWidth: 1280, videoHeight: 720 }), { width: 1280, height: 720, landscape: true });
  assert.deepEqual(readVideoSize({ media: { videoWidth: 720, videoHeight: 1280 } }), { width: 720, height: 1280, landscape: false });
  assert.equal(readVideoSize({ videoWidth: 0, videoHeight: 0 }), null);
  assert.equal(readVideoSize(null), null);
});
