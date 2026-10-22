import assert from "node:assert/strict";
import test from "node:test";
import { fileClip, reelSpan, shuffle, youtubeClip } from "./reels.ts";

test("a youtube reel plays the first five minutes from the saved start", () => {
  assert.deepEqual(reelSpan(0, 300, 0), { start: 0, end: 300 });
  assert.deepEqual(reelSpan(12, 300, 2000), { start: 12, end: 312 });
  assert.deepEqual(reelSpan(0, 300, 90), { start: 0, end: 90 });
});

test("shuffle uses the provided random order", () => {
  const rolls = [0, 0];
  assert.deepEqual(shuffle(["a", "b", "c"], () => rolls.shift() ?? 0), ["b", "c", "a"]);
});

test("an uploaded short preview becomes the reel", () => {
  const clip = fileClip("series-1", { title: "Нууц", genre: "Драма", year: 2026, reelPreview: "https://cdn/trailer.mp4" });
  assert.equal(clip?.source, "file");
  assert.equal(clip?.url, "https://cdn/trailer.mp4");
  assert.equal(clip?.seconds, 300);
  assert.equal(fileClip("series-1", { reelPreview: "" }), null);
});

test("youtube is used only when a preview video exists", () => {
  const clip = youtubeClip("series-1", { title: "Нууц" }, { videoId: "abc", episodeId: "ep", startAt: 8, episodeLabel: "1-р анги" });
  assert.equal(clip?.source, "youtube");
  assert.equal(clip?.startAt, 0);
  assert.equal(clip?.seconds, 300);
  assert.equal(youtubeClip("series-1", {}, { videoId: "abc" }), null);
});
