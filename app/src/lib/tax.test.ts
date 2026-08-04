import assert from "node:assert/strict";
import test from "node:test";
import { formatVatRate, vatBreakdown, VAT_RATE } from "./tax.ts";

/**
 * The property that matters: an invoice whose lines do not add up is not a valid
 * invoice, so base + tax must equal the gross for every possible amount.
 */
test("the split always adds back up to the gross", () => {
  for (let cents = 1; cents <= 20000; cents++) {
    const { netCents, vatCents } = vatBreakdown(cents);
    assert.equal(netCents + vatCents, cents, `failed at ${cents} cents`);
  }
});

test("known figures", () => {
  // 39,90 € including 21 % → 32,98 € base + 6,92 € tax
  assert.deepEqual(vatBreakdown(3990), {
    rate: 0.21,
    netCents: 3298,
    vatCents: 692,
    grossCents: 3990,
  });

  // A tee at 34,95 plus 4,95 shipping: the whole 39,90 is one base.
  const order = vatBreakdown(3495 + 495);
  assert.equal(order.netCents + order.vatCents, 3990);
});

test("the base is never above the gross", () => {
  for (const cents of [1, 2, 3, 99, 100, 12345, 999999]) {
    const { netCents, vatCents } = vatBreakdown(cents);
    assert.ok(netCents <= cents, `base ${netCents} exceeds gross ${cents}`);
    assert.ok(vatCents >= 0, `negative tax at ${cents}`);
  }
});

test("zero is not a special case", () => {
  assert.deepEqual(vatBreakdown(0), {
    rate: VAT_RATE,
    netCents: 0,
    vatCents: 0,
    grossCents: 0,
  });
});

test("a rate stored on an old order is honoured", () => {
  // If the general rate ever changes, past orders must keep their own.
  const old = vatBreakdown(1210, 0.1);
  assert.equal(old.rate, 0.1);
  assert.equal(old.netCents, 1100);
  assert.equal(old.vatCents, 110);
});

test("a nonsense rate falls back to the general one", () => {
  assert.equal(vatBreakdown(1000, Number.NaN).rate, VAT_RATE);
  assert.equal(vatBreakdown(1000, -1).rate, VAT_RATE);
});

test("rate labels", () => {
  assert.equal(formatVatRate(0.21), "21 %");
  assert.equal(formatVatRate(0.1), "10 %");
  assert.equal(formatVatRate(0.045), "4.5 %");
});
