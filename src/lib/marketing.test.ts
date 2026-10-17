import assert from "node:assert/strict";
import test from "node:test";
import { announcementAudience, broadcastInput, marketingFromSettings, normalizeMailFromName } from "./marketing.ts";

test("mail sender name stays short and safe", () => {
  assert.equal(normalizeMailFromName("  Cinema Feel  "), "Cinema Feel");
  assert.equal(normalizeMailFromName('Bad <name> "x"'), "Bad name x");
  assert.equal(normalizeMailFromName(""), "CinemaFeel");
  assert.equal(normalizeMailFromName("н".repeat(50)).length, 40);
});

test("missing channel flags stay on", () => {
  assert.deepEqual(marketingFromSettings(undefined), {
    emailEnabled: true,
    smsEnabled: true,
    mailFromName: "CinemaFeel",
  });
  assert.equal(marketingFromSettings({ emailEnabled: false, smsEnabled: false, mailFromName: "Feel" }).emailEnabled, false);
});

test("broadcast requires a channel and its copy", () => {
  assert.equal(broadcastInput({}).ok, false);
  assert.equal(broadcastInput({ email: true }).error, "Имэйлийн гарчиг оруулна уу.");
  assert.equal(broadcastInput({ email: true, subject: "Сайн уу", body: "" }).error, "Имэйлийн агуулга оруулна уу.");
  assert.equal(broadcastInput({ sms: true }).error, "SMS агуулга оруулна уу.");
  const ready = broadcastInput({ email: true, sms: true, subject: "  Шинэ  ", body: "Агуулга", smsBody: "Мессеж" });
  assert.equal(ready.ok, true);
  if (ready.ok) assert.equal(ready.subject, "Шинэ");
});

test("disabled channels drop that audience without turning mature sms back on", () => {
  assert.deepEqual(
    announcementAudience({ emails: ["a@b.c"], phones: ["99112233"], emailEnabled: false, smsEnabled: true, mature: false }),
    { emails: [], phones: ["99112233"], suppressed: false },
  );
  assert.deepEqual(
    announcementAudience({ emails: ["a@b.c"], phones: [], emailEnabled: false, smsEnabled: true, mature: false }),
    { emails: [], phones: [], suppressed: true },
  );
  assert.deepEqual(
    announcementAudience({ emails: [], phones: ["99112233"], emailEnabled: true, smsEnabled: true, mature: true }),
    { emails: [], phones: [], suppressed: false },
  );
});
