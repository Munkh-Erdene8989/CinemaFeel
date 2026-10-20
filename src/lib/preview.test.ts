import assert from "node:assert/strict";
import test from "node:test";
import { publishedShareId, readPreview, shouldReplacePreview, subtitleUrl } from "./preview.ts";

test("the earliest episode becomes the preview", () => {
  assert.equal(shouldReplacePreview(null, 3), true);
  assert.equal(shouldReplacePreview({ videoId: "old", episodeNumber: 2 }, 4), false);
  assert.equal(shouldReplacePreview({ videoId: "old", episodeNumber: 5 }, 1), true);
});

test("a preview needs a video and an episode", () => {
  assert.equal(readPreview(null), null);
  assert.equal(readPreview({ videoId: "abc" }), null);
  assert.equal(readPreview({ videoId: "abc", episodeId: "ep", episodeNumber: 1, episodeLabel: "1-р анги" })?.videoId, "abc");
});

test("subtitles load from this site, not from storage", () => {
  assert.equal(subtitleUrl("series 1", "ep/2"), "/api/media/subtitle?seriesId=series%201&episodeId=ep%2F2");
});

test("only a published share document opens", () => {
  assert.equal(publishedShareId({ seriesId: "s1", status: "Нийтлэгдсэн" }), "s1");
  assert.equal(publishedShareId({ seriesId: "s1", status: "Ноорог" }), null);
  assert.equal(publishedShareId(null), null);
});
