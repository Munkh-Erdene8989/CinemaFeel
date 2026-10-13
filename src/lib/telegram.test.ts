import assert from "node:assert/strict";
import test from "node:test";
import { episodeCaption, publicWatchLink, sendEpisodeNotice, telegramConfigured } from "./telegram.ts";

const originalToken = process.env.TELEGRAM_BOT_TOKEN;
const originalChannel = process.env.TELEGRAM_CHANNEL_ID;
const originalFetch = globalThis.fetch;

test.afterEach(() => {
  if (originalToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
  else process.env.TELEGRAM_BOT_TOKEN = originalToken;
  if (originalChannel === undefined) delete process.env.TELEGRAM_CHANNEL_ID;
  else process.env.TELEGRAM_CHANNEL_ID = originalChannel;
  globalThis.fetch = originalFetch;
});

test("caption names the series and episode", () => {
  assert.equal(
    episodeCaption({ seriesTitle: "Lyra & Co", episodeTitle: "Эхлэл", episodeNumber: 2 }),
    "Шинэ анги гарлаа\n<b>Lyra &amp; Co</b>\n2-р анги · Эхлэл",
  );
  assert.equal(
    episodeCaption({ seriesTitle: "Lyra", episodeTitle: "3-р анги", episodeNumber: 3 }),
    "Шинэ анги гарлаа\n<b>Lyra</b>\n3-р анги",
  );
});

test("watch links stay on the public site", () => {
  assert.equal(publicWatchLink("http://localhost:3000", "abc", 4), "https://cinemafeel.dev/watch/abc/4");
  assert.equal(publicWatchLink("https://cinemafeel.dev/", "abc", 1), "https://cinemafeel.dev/watch/abc/1");
});

test("sendPhoto posts the poster to the configured channel", async () => {
  process.env.TELEGRAM_BOT_TOKEN = "123:token";
  process.env.TELEGRAM_CHANNEL_ID = "@cinemafeel";
  assert.equal(telegramConfigured(), true);
  let body = "";
  globalThis.fetch = async (_url, init) => {
    body = String(init?.body ?? "");
    return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
  };

  const result = await sendEpisodeNotice({
    seriesTitle: "Lyra",
    episodeTitle: "Эхлэл",
    episodeNumber: 1,
    photoUrl: "https://cdn.example/poster.jpg",
    link: "https://cinemafeel.dev/watch/abc/1",
  });

  assert.equal(result.ok, true);
  const sent = JSON.parse(body) as { chat_id: string; photo: string; parse_mode: string };
  assert.equal(sent.chat_id, "@cinemafeel");
  assert.equal(sent.photo, "https://cdn.example/poster.jpg");
  assert.equal(sent.parse_mode, "HTML");
});

test("a missing poster waits instead of posting text", async () => {
  process.env.TELEGRAM_BOT_TOKEN = "123:token";
  process.env.TELEGRAM_CHANNEL_ID = "@cinemafeel";
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  const result = await sendEpisodeNotice({
    seriesTitle: "Lyra",
    episodeTitle: "Эхлэл",
    episodeNumber: 1,
    photoUrl: "",
    link: "https://cinemafeel.dev/watch/abc/1",
  });
  assert.equal(result.ok, false);
  assert.match(result.pending ?? "", /Постер/);
  assert.equal(called, false);
});
