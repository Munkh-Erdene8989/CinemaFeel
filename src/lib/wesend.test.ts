import assert from "node:assert/strict";
import test from "node:test";
import { otpSmsText, releaseSmsText, sendOtpSms, supportedMnMobile, wesendOutOfCredit } from "./wesend.ts";

const originalFetch = globalThis.fetch;
const originalKey = process.env.WESEND_API_KEY;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.WESEND_API_KEY;
  else process.env.WESEND_API_KEY = originalKey;
});

test("keeps supported Mongolian mobiles", () => {
  assert.equal(supportedMnMobile("+976 9911 2233"), "99112233");
  assert.equal(supportedMnMobile("81811234"), "81811234");
  assert.equal(supportedMnMobile("50501234"), "50501234");
  assert.equal(supportedMnMobile("55112233"), "55112233");
  assert.equal(supportedMnMobile("12345678"), null);
  assert.equal(supportedMnMobile("81001234"), null);
});

test("login otp is a latin CinemaFeel OTP message", () => {
  const text = otpSmsText("0482");
  assert.equal(text, "CinemaFeel OTP: 0482");
  assert.doesNotMatch(text, /[А-Яа-яЁёӨөҮү]/);
  assert.equal(wesendOutOfCredit("insufficient_credits"), true);
  assert.equal(wesendOutOfCredit("provider_failed"), false);
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

test("otp sms posts the latin code to one number", async () => {
  process.env.WESEND_API_KEY = "ws_test";
  let url = "";
  let body = "";
  let idempotency = "";
  globalThis.fetch = (async (input, init) => {
    url = String(input);
    body = String(init?.body);
    idempotency = new Headers(init?.headers).get("idempotency-key") ?? "";
    return new Response(JSON.stringify({ id: "1", status: "sent" }), { status: 200 });
  }) as typeof fetch;
  const sent = await sendOtpSms("99112233", "0482", "session-1");
  assert.equal(sent.ok, true);
  assert.equal(url, "https://api.wesend.mn/v1/sms");
  assert.equal(idempotency, "session-1");
  assert.deepEqual(JSON.parse(body), { to: "99112233", text: "CinemaFeel OTP: 0482" });
});

test("otp sms reports exhausted credits", async () => {
  process.env.WESEND_API_KEY = "ws_test";
  globalThis.fetch = (async () => new Response(JSON.stringify({ error: { code: "insufficient_credits", message: "Not enough credits." } }), { status: 402 })) as typeof fetch;
  const sent = await sendOtpSms("99112233", "0482", "session-2");
  assert.equal(sent.ok, false);
  if (!sent.ok) {
    assert.equal(sent.code, "insufficient_credits");
    assert.equal(sent.error, "WeSend кредит хүрэлцэхгүй байна.");
  }
});
