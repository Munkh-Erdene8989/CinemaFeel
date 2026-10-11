import assert from "node:assert/strict";
import test from "node:test";
import { callbackUrl, createVerifySession, getVerifySession, normalizeMnPhone, VerifyMnError } from "./verify-mn.ts";

const originalFetch = globalThis.fetch;
const originalKey = process.env.VERIFY_MN_API_KEY;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.VERIFY_MN_API_KEY;
  else process.env.VERIFY_MN_API_KEY = originalKey;
});

test("normalizes Mongolian numbers", () => {
  assert.equal(normalizeMnPhone("9911 2233"), "99112233");
  assert.equal(normalizeMnPhone("+97699112233"), "99112233");
  assert.equal(normalizeMnPhone("123"), null);
});

test("callback is only registered for public https", () => {
  assert.equal(callbackUrl("http://localhost:3000", "abc"), undefined);
  assert.equal(callbackUrl("https://cinemafeel.mn", "abc"), "https://cinemafeel.mn/api/auth/phone/callback/abc");
});

test("create session sends the key and code", async () => {
  process.env.VERIFY_MN_API_KEY = "vrf_test";
  globalThis.fetch = (async (_url, init) => {
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("authorization"), "Bearer vrf_test");
    assert.deepEqual(JSON.parse(String(init?.body)), { phone: "99112233", text: "482916" });
    return new Response(JSON.stringify({ sessionId: "s1", phone: "99112233", shortcode: "144773", text: "482916", smsUri: "sms:144773?body=482916", displayInstruction: "илгээнэ үү", expiresAt: "2026-04-14T12:30:00.000Z" }), { status: 200 });
  }) as typeof fetch;
  const session = await createVerifySession({ phone: "99112233", text: "482916" });
  assert.equal(session.sessionId, "s1");
  assert.equal(session.smsUri, "sms:144773?body=482916");
});

test("bad key is 401", async () => {
  process.env.VERIFY_MN_API_KEY = "vrf_bad";
  globalThis.fetch = (async () => new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 })) as typeof fetch;
  await assert.rejects(() => createVerifySession({ phone: "99112233", text: "482916" }), (error: unknown) => {
    assert.ok(error instanceof VerifyMnError);
    assert.equal(error.status, 401);
    return true;
  });
});

test("missing key fails loudly", async () => {
  delete process.env.VERIFY_MN_API_KEY;
  await assert.rejects(() => createVerifySession({ phone: "99112233", text: "1" }), (error: unknown) => error instanceof VerifyMnError);
});

test("status moves from PENDING to VERIFIED and can expire", async () => {
  const states = ["PENDING", "VERIFIED", "EXPIRED"];
  let index = 0;
  globalThis.fetch = (async () => new Response(JSON.stringify({ sessionId: "s1", sessionStatus: states[index++] }), { status: 200 })) as typeof fetch;
  assert.equal((await getVerifySession("s1")).sessionStatus, "PENDING");
  assert.equal((await getVerifySession("s1")).sessionStatus, "VERIFIED");
  assert.equal((await getVerifySession("s1")).sessionStatus, "EXPIRED");
});
