import assert from "node:assert/strict";
import test from "node:test";
import { cronAuthorized, rollupAuthorized } from "./cron-auth.ts";

function request(headers: Record<string, string>) {
  return { headers: { get: (name: string) => headers[name.toLowerCase()] ?? null } };
}

test("cron accepts the bearer token or the header that survives the proxy", () => {
  process.env.CRON_SECRET = "secret";
  assert.equal(cronAuthorized(request({ authorization: "Bearer secret" })), true);
  assert.equal(cronAuthorized(request({ "x-cron-secret": "secret" })), true);
  assert.equal(cronAuthorized(request({ authorization: "Bearer other" })), false);
  assert.equal(cronAuthorized(request({})), false);
  delete process.env.CRON_SECRET;
  assert.equal(cronAuthorized(request({ "x-cron-secret": "secret" })), false);
});

test("the scheduled rollup is recognized when the platform strips authorization", () => {
  delete process.env.CRON_SECRET;
  assert.equal(rollupAuthorized(request({ "user-agent": "vercel-cron/1.0" })), true);
  assert.equal(rollupAuthorized(request({ "user-agent": "node" })), false);
});
