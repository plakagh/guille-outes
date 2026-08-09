import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateDiscount,
  isCodeShape,
  MIN_PAYABLE_CENTS,
  normalizeCode,
  totalWithDiscount,
  type DiscountLine,
  type DiscountRules,
} from "./discounts.ts";

/**
 * The evaluator is the only thing standing between a promotional code and the
 * amount signed for the bank, so what is tested here is not "does it multiply"
 * but the rules a shop would be embarrassed to get wrong: never discounting more
 * than the goods, never producing an unpayable order, never letting a code apply
 * outside the campaign it was written for.
 */

const NOW = new Date("2026-08-06T12:00:00Z");

/** Everything off, nothing limited — each test switches on the one rule it is about. */
function rules(overrides: Partial<DiscountRules> = {}): DiscountRules {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    code: "TEST",
    kind: "percent",
    percent: 10,
    amountCents: null,
    maxDiscountCents: null,
    minSubtotalCents: 0,
    scope: "all",
    collectionId: null,
    categoryId: null,
    excludeDiscounted: false,
    firstOrderOnly: false,
    maxRedemptions: null,
    maxPerCustomer: null,
    startsAt: null,
    endsAt: null,
    usedTotal: 0,
    usedByCaller: 0,
    callerHasPaid: false,
    personal: false,
    callerIsRecipient: false,
    ...overrides,
  };
}

const line = (overrides: Partial<DiscountLine> = {}): DiscountLine => ({
  categoryId: "camisetas",
  collectionId: "court-series",
  discounted: false,
  lineTotal: 3495,
  ...overrides,
});

const evaluate = (
  discount: Partial<DiscountRules>,
  lines: DiscountLine[],
  shippingCents = 495,
  signedIn = true,
) => evaluateDiscount({ rules: rules(discount), lines, shippingCents, signedIn, now: NOW });

/* ------------------------------------------------------------- the maths */

test("a percentage comes off the goods, not off the delivery", () => {
  const result = evaluate({ percent: 20 }, [line({ lineTotal: 5000 })]);
  assert.ok(result.ok);
  assert.equal(result.discount.amountCents, 1000);

  const priced = totalWithDiscount({
    subtotalCents: 5000,
    shippingCents: 495,
    discount: result.discount,
  });
  assert.equal(priced.totalCents, 5000 - 1000 + 495);
});

test("a fixed amount never exceeds the basket it applies to", () => {
  const result = evaluate({ kind: "amount", percent: null, amountCents: 3000 }, [
    line({ lineTotal: 2000 }),
  ]);
  assert.ok(result.ok);
  // 30 € off a 20 € basket takes 20 €, and stops there rather than eating the
  // delivery charge.
  assert.equal(result.discount.amountCents, 2000);
});

test("a ceiling caps a percentage", () => {
  const result = evaluate({ percent: 50, maxDiscountCents: 1500 }, [line({ lineTotal: 10000 })]);
  assert.ok(result.ok);
  assert.equal(result.discount.amountCents, 1500);
});

test("the order always stays payable", () => {
  // 100 % off, collected in person for nothing: without the floor this order
  // would be for zero euros, which Redsys cannot process.
  const result = evaluate({ percent: 100 }, [line({ lineTotal: 4000 })], 0);
  assert.ok(result.ok);
  assert.equal(result.discount.amountCents, 4000 - MIN_PAYABLE_CENTS);

  const priced = totalWithDiscount({
    subtotalCents: 4000,
    shippingCents: 0,
    discount: result.discount,
  });
  assert.equal(priced.totalCents, MIN_PAYABLE_CENTS);
});

test("waived delivery is counted as a discount, so the lines still add up", () => {
  const result = evaluate({ kind: "free_shipping", percent: null }, [line({ lineTotal: 3495 })], 895);
  assert.ok(result.ok);
  assert.equal(result.discount.freeShipping, true);
  assert.equal(result.discount.amountCents, 0);

  const priced = totalWithDiscount({
    subtotalCents: 3495,
    shippingCents: 895,
    discount: result.discount,
  });
  assert.equal(priced.shippingCents, 895);
  assert.equal(priced.discountCents, 895);
  assert.equal(priced.totalCents, 3495);
});

test("a free-delivery code on an order that already ships free is refused", () => {
  const result = evaluate({ kind: "free_shipping", percent: null }, [line()], 0);
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.reason, "nothing_to_take");
});

/* -------------------------------------------------------------- the scope */

test("a collection code ignores the rest of the basket", () => {
  const result = evaluate({ percent: 10, scope: "collection", collectionId: "court-series" }, [
    line({ collectionId: "court-series", lineTotal: 5000 }),
    line({ collectionId: "otra", lineTotal: 5000 }),
  ]);
  assert.ok(result.ok);
  assert.equal(result.discount.amountCents, 500);
});

test("a category code ignores the rest of the basket", () => {
  const result = evaluate({ percent: 10, scope: "category", categoryId: "gorras" }, [
    line({ categoryId: "gorras", lineTotal: 2000 }),
    line({ categoryId: "camisetas", lineTotal: 8000 }),
  ]);
  assert.ok(result.ok);
  assert.equal(result.discount.amountCents, 200);
});

test("outlet lines are left out when the code says not to stack", () => {
  const result = evaluate({ percent: 50, excludeDiscounted: true }, [
    line({ discounted: true, lineTotal: 4000 }),
    line({ discounted: false, lineTotal: 2000 }),
  ]);
  assert.ok(result.ok);
  assert.equal(result.discount.amountCents, 1000);
});

test("a code that matches nothing in the basket is refused, not applied for zero", () => {
  const result = evaluate({ scope: "category", categoryId: "gorras" }, [
    line({ categoryId: "camisetas" }),
  ]);
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.reason, "no_eligible_items");
});

/* ------------------------------------------------------------- the limits */

test("the minimum is measured against the whole basket, not the eligible part", () => {
  // 40 € of goods clears a 40 € minimum even though the code only applies to
  // half of them: "spend 40 €" is a promise about the order.
  const result = evaluate(
    { minSubtotalCents: 4000, scope: "category", categoryId: "gorras" },
    [line({ categoryId: "gorras", lineTotal: 2000 }), line({ categoryId: "camisetas", lineTotal: 2000 })],
  );
  assert.ok(result.ok);
  assert.equal(result.discount.amountCents, 200);
});

test("a basket under the minimum is told the figure", () => {
  const result = evaluate({ minSubtotalCents: 4000 }, [line({ lineTotal: 3000 })]);
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.reason, "min_subtotal");
  assert.equal(result.ok === false && result.detail, 4000);
});

test("dates bound the campaign at both ends", () => {
  const early = evaluate({ startsAt: "2026-09-01T00:00:00Z" }, [line()]);
  assert.equal(early.ok === false && early.reason, "not_started");

  const late = evaluate({ endsAt: "2026-08-01T00:00:00Z" }, [line()]);
  assert.equal(late.ok === false && late.reason, "expired");

  const open = evaluate({ startsAt: "2026-08-01T00:00:00Z", endsAt: "2026-09-01T00:00:00Z" }, [line()]);
  assert.equal(open.ok, true);
});

test("the global limit and the per-customer limit are separate refusals", () => {
  const spent = evaluate({ maxRedemptions: 100, usedTotal: 100 }, [line()]);
  assert.equal(spent.ok === false && spent.reason, "exhausted");

  const mine = evaluate({ maxPerCustomer: 1, usedByCaller: 1 }, [line()]);
  assert.equal(mine.ok === false && mine.reason, "already_used");
});

test("a personal code asks a signed-out visitor to sign in rather than failing later", () => {
  for (const personal of [
    { maxPerCustomer: 1 },
    { firstOrderOnly: true },
    { personal: true, callerIsRecipient: true },
  ]) {
    const result = evaluate(personal, [line()], 495, false);
    assert.equal(result.ok === false && result.reason, "sign_in");
  }

  // A code with no personal rule works perfectly well signed out.
  assert.equal(evaluate({}, [line()], 495, false).ok, true);
});

test("a welcome code counts paid orders, not abandoned baskets", () => {
  const returning = evaluate({ firstOrderOnly: true, callerHasPaid: true }, [line()]);
  assert.equal(returning.ok === false && returning.reason, "not_first_order");

  const first = evaluate({ firstOrderOnly: true, callerHasPaid: false }, [line()]);
  assert.equal(first.ok, true);
});

/* ------------------------------------------------ codes issued to one person */

test("a code issued to somebody else is refused, however well it is typed", () => {
  // The welcome code from the newsletter, forwarded or screenshotted. Whose it is
  // was decided against the confirmed address on the account, so holding the
  // string is worth nothing.
  const stranger = evaluate({ personal: true, callerIsRecipient: false, maxRedemptions: 1 }, [line()]);
  assert.equal(stranger.ok === false && stranger.reason, "not_yours");

  const owner = evaluate({ personal: true, callerIsRecipient: true, maxRedemptions: 1 }, [line()]);
  assert.equal(owner.ok, true);
});

test("a spent personal code says 'you have used this', not 'the campaign is over'", () => {
  // Single use is `maxRedemptions: 1`, and on a code with one owner the only
  // person who could have spent it is that owner.
  const result = evaluate(
    { personal: true, callerIsRecipient: true, maxRedemptions: 1, usedTotal: 1 },
    [line()],
  );
  assert.equal(result.ok === false && result.reason, "already_used");

  // A shared campaign at its ceiling still reads as exhausted.
  const shared = evaluate({ maxRedemptions: 1, usedTotal: 1 }, [line()]);
  assert.equal(shared.ok === false && shared.reason, "exhausted");
});

test("the code itself is checked before the basket is", () => {
  // Both wrong: the shopper is told the campaign has ended, not to spend more on
  // a code that would have been refused either way.
  const result = evaluate({ endsAt: "2026-08-01T00:00:00Z", minSubtotalCents: 9999999 }, [line()]);
  assert.equal(result.ok === false && result.reason, "expired");
});

/* --------------------------------------------------------------- the box */

test("what the shopper types is trimmed and upper-cased", () => {
  assert.equal(normalizeCode("  bienvenida10 "), "BIENVENIDA10");
});

test("only shapes the column can hold reach the database", () => {
  for (const good of ["ABC", "BIENVENIDA10", "FERIA-2026", "A".repeat(24)]) {
    assert.ok(isCodeShape(good), good);
  }
  for (const bad of ["AB", "-ABC", "hola10", "CON ESPACIO", "AÑO2026", "A".repeat(25)]) {
    assert.ok(!isCodeShape(bad), bad);
  }
});

test("no code means no change to the total", () => {
  const priced = totalWithDiscount({ subtotalCents: 3495, shippingCents: 495, discount: null });
  assert.deepEqual(priced, { discountCents: 0, shippingCents: 495, totalCents: 3990 });
});
