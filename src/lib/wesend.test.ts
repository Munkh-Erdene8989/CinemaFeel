import assert from "node:assert/strict";
import test from "node:test";
import { releaseSmsText, supportedMnMobile } from "./wesend.ts";

test("keeps supported Mongolian mobiles", () => {
  assert.equal(supportedMnMobile("+976 9911 2233"), "99112233");
  assert.equal(supportedMnMobile("81811234"), "81811234");
  assert.equal(supportedMnMobile("50501234"), "50501234");
  assert.equal(supportedMnMobile("55112233"), "55112233");
  assert.equal(supportedMnMobile("12345678"), null);
  assert.equal(supportedMnMobile("81001234"), null);
});

test("sms is latin and keeps the title and link within the segment limit", () => {
  const link = "https://cinemafeel.dev/s/ab12cd";
  const text = releaseSmsText("Шөнийн хот", link);
  assert.equal(text, `Shine kontent nemegdlee: Shoniin khot ${link}`);
  assert.ok(text.length <= 300);
  assert.doesNotMatch(text, /[А-Яа-яЁёӨөҮү]/);

  const long = releaseSmsText("Кино ".repeat(200), link);
  assert.ok(long.endsWith(link));
  assert.ok(long.length <= 300);
  assert.doesNotMatch(long, /[А-Яа-яЁёӨөҮү]/);
  assert.match(long, /\.\.\. https:\/\/cinemafeel\.dev/);
});
