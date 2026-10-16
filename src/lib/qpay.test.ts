import assert from "node:assert/strict";
import test from "node:test";
import { paymentResult, type QPayCheck } from "./qpay.ts";

function check(partial: QPayCheck): QPayCheck {
  return partial;
}

test("a QPay check is paid from one threshold", () => {
  assert.deepEqual(paymentResult(check({ rows: [{ payment_status: "PAID", payment_id: "p1", payment_amount: 5900 }] }), 5900), {
    paid: true,
    paymentId: "p1",
  });
  assert.equal(paymentResult(check({ rows: [{ payment_status: "SUCCESS", payment_id: "p2" }] }), 100).paid, true);
  assert.equal(paymentResult(check({ rows: [{ payment_status: "PENDING", payment_amount: 1000 }] }), 5900).paid, false);
  assert.equal(paymentResult(check({ paid_amount: 5900, count: 1 }), 5900).paid, true);
  assert.equal(paymentResult(check({ paid_amount: 5900, count: 0 }), 0).paid, false);
});
