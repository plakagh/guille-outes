/**
 * Discount codes: the rules, and the one function that applies them.
 *
 * A neutral module, for the same reason `shipping.ts` and `tax.ts` are neutral —
 * no `"use client"`, no `"server-only"`. The cart shows a saving and the server
 * charges for it, and if those two numbers ever disagree the shop has either
 * lied to a customer or undercharged itself. They agree because they are the
 * same code. (Importing a value from a `"use client"` module into a Server
 * Action does not fail loudly: Next substitutes a throwing proxy, which then
 * stringifies into the arithmetic. That is the mistake this shape avoids.)
 *
 * What is *not* here: whether the code exists, when it starts, how many times it
 * has been used. Those come from `discount_lookup` in the database, because a
 * browser must not be able to read the shop's campaigns or the counters that
 * limit them. This module takes the rules as data and the basket as data, and
 * says what comes off.
 *
 * All amounts are integer cents.
 */

export type DiscountKind = "percent" | "amount" | "free_shipping";

export type DiscountScope = "all" | "collection" | "category";

/** A code's rules, exactly as `discount_lookup` returns them. */
export type DiscountRules = {
  id: string;
  code: string;
  kind: DiscountKind;
  /** 1–100, on a `percent` code. */
  percent: number | null;
  /** Cents off, on an `amount` code. */
  amountCents: number | null;
  /** Ceiling for a percentage code, e.g. "20 %, up to 15 €". */
  maxDiscountCents: number | null;
  minSubtotalCents: number;
  scope: DiscountScope;
  collectionId: string | null;
  categoryId: string | null;
  excludeDiscounted: boolean;
  firstOrderOnly: boolean;
  maxRedemptions: number | null;
  maxPerCustomer: number | null;
  startsAt: string | null;
  endsAt: string | null;
  /** How many paid orders have used it, in total and by the caller. */
  usedTotal: number;
  usedByCaller: number;
  /** Whether the caller has ever paid for an order. */
  callerHasPaid: boolean;
  /**
   * The code was issued to one person — the newsletter welcome code is the first
   * of these. Holding the string is not enough to spend it.
   */
  personal: boolean;
  /** On a personal code, whether the caller is the person it was issued to. */
  callerIsRecipient: boolean;
};

/** One basket line, reduced to what a code needs to know about it. */
export type DiscountLine = {
  categoryId: string;
  collectionId: string | null;
  /** True when the product is already down from a compare-at price. */
  discounted: boolean;
  /** Unit price × quantity, in cents. */
  lineTotal: number;
};

/**
 * Why a code was refused. Each one gets its own sentence in the dictionary: "no
 * such code" and "you have already used this" are very different things to be
 * told, and collapsing them into "invalid" is how a shop generates support mail.
 */
export type DiscountRefusal =
  | "unknown"
  | "not_started"
  | "expired"
  | "exhausted"
  | "already_used"
  | "sign_in"
  | "not_yours"
  | "not_first_order"
  | "min_subtotal"
  | "no_eligible_items"
  | "nothing_to_take";

/** What a valid code does to this basket. */
export type AppliedDiscount = {
  id: string;
  code: string;
  kind: DiscountKind;
  /** Cents off the goods. Always 0 for a free-shipping code. */
  amountCents: number;
  /** Delivery drops to zero. */
  freeShipping: boolean;
};

export type DiscountResult =
  | { ok: true; discount: AppliedDiscount }
  | { ok: false; reason: DiscountRefusal; /** Cents, on `min_subtotal`. */ detail?: number };

/**
 * The order must still be payable.
 *
 * Redsys cannot process a zero charge, and this shop has no "free order" path
 * that skips the bank — so a code generous enough to clear the basket is applied
 * up to this floor and no further. It bites only in the pathological case (100 %
 * off with free delivery); the shopper is always shown the figure that is
 * actually coming off, never a rounder one.
 */
export const MIN_PAYABLE_CENTS = 50;

/** What the shopper typed, as the database stores it. */
export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

/** The shape the `code` column will accept. Checked before a round trip. */
export function isCodeShape(value: string): boolean {
  return /^[A-Z0-9][A-Z0-9-]{2,23}$/.test(value);
}

/** Lines this code is allowed to discount. */
function eligibleLines(rules: DiscountRules, lines: DiscountLine[]): DiscountLine[] {
  return lines.filter((line) => {
    if (rules.excludeDiscounted && line.discounted) return false;
    if (rules.scope === "collection") return line.collectionId === rules.collectionId;
    if (rules.scope === "category") return line.categoryId === rules.categoryId;
    return true;
  });
}

const sum = (lines: DiscountLine[]) => lines.reduce((total, line) => total + line.lineTotal, 0);

/**
 * Applies a code to a basket.
 *
 * Order of the checks matters: the ones about the code itself (dates, limits)
 * come before the ones about the basket, so a shopper is told "that campaign has
 * ended" rather than "spend 20 € more" about a code that would not have worked
 * either way.
 *
 * `now` is a parameter rather than a `new Date()` inside, so the server and the
 * browser can be handed the same instant and cannot disagree about a code that
 * expires while the page is open.
 */
export function evaluateDiscount({
  rules,
  lines,
  shippingCents,
  signedIn,
  now,
}: {
  rules: DiscountRules;
  lines: DiscountLine[];
  /** What delivery costs before the code is applied. */
  shippingCents: number;
  signedIn: boolean;
  now: Date;
}): DiscountResult {
  const time = now.getTime();

  if (rules.startsAt && time < Date.parse(rules.startsAt)) {
    return { ok: false, reason: "not_started" };
  }
  if (rules.endsAt && time >= Date.parse(rules.endsAt)) {
    return { ok: false, reason: "expired" };
  }
  if (rules.maxRedemptions !== null && rules.usedTotal >= rules.maxRedemptions) {
    // A code with one owner can only have been exhausted by that owner, so they
    // are told the truth about themselves rather than "this campaign is over".
    return { ok: false, reason: rules.personal ? "already_used" : "exhausted" };
  }

  // A per-customer limit, a first-order offer and a code issued to one person are
  // all promises about a person, and a signed-out visitor is not yet one. Saying
  // so is better than accepting the code in the cart and refusing it at checkout.
  const personal = rules.personal || rules.maxPerCustomer !== null || rules.firstOrderOnly;
  if (personal && !signedIn) return { ok: false, reason: "sign_in" };

  // Whose code it is was decided by `discount_lookup` against the confirmed
  // address on the account, not by anything the browser sent. A forwarded welcome
  // email is therefore worth nothing to the person who receives it.
  if (rules.personal && !rules.callerIsRecipient) return { ok: false, reason: "not_yours" };

  if (rules.maxPerCustomer !== null && rules.usedByCaller >= rules.maxPerCustomer) {
    return { ok: false, reason: "already_used" };
  }
  if (rules.firstOrderOnly && rules.callerHasPaid) {
    return { ok: false, reason: "not_first_order" };
  }

  // The minimum is measured against the whole basket, not the eligible part of
  // it: "spend 40 €" is a promise about the order, and narrowing it to the
  // discounted subset would make a scoped code refuse baskets that plainly meet
  // the threshold.
  const subtotal = sum(lines);
  if (subtotal < rules.minSubtotalCents) {
    return { ok: false, reason: "min_subtotal", detail: rules.minSubtotalCents };
  }

  if (rules.kind === "free_shipping") {
    // Already free — say so rather than showing a code that changes nothing.
    if (shippingCents <= 0) return { ok: false, reason: "nothing_to_take" };
    return {
      ok: true,
      discount: { id: rules.id, code: rules.code, kind: rules.kind, amountCents: 0, freeShipping: true },
    };
  }

  const eligible = sum(eligibleLines(rules, lines));
  if (eligible <= 0) return { ok: false, reason: "no_eligible_items" };

  let off =
    rules.kind === "percent"
      ? Math.round((eligible * (rules.percent ?? 0)) / 100)
      : (rules.amountCents ?? 0);

  if (rules.maxDiscountCents !== null) off = Math.min(off, rules.maxDiscountCents);

  // Never more than the goods it applies to: a 30 € code on a 20 € basket takes
  // 20 €, and never starts eating into the delivery charge.
  off = Math.min(off, eligible);

  // …and never so much that there is nothing left to charge. See MIN_PAYABLE_CENTS.
  const payableFloor = subtotal + shippingCents - MIN_PAYABLE_CENTS;
  off = Math.min(off, Math.max(0, payableFloor));

  if (off <= 0) return { ok: false, reason: "nothing_to_take" };

  return {
    ok: true,
    discount: { id: rules.id, code: rules.code, kind: rules.kind, amountCents: off, freeShipping: false },
  };
}

/**
 * What the basket costs once the code is in.
 *
 * One function, so the cart, the checkout, `placeOrder`, the order page and the
 * confirmation email all reach the same total.
 *
 * Waived delivery is counted as part of the discount rather than as a zero
 * shipping charge, and that is a deliberate choice about the paperwork: the
 * summary then reads "Envío 4,95 € / Descuento −4,95 €", the three lines add up
 * to the total exactly, and `orders.discount_cents` records what the code was
 * really worth — which is the figure the shop wants when it asks what a campaign
 * cost. Zeroing the shipping line instead would make a free-delivery code look
 * free to run.
 */
export function totalWithDiscount({
  subtotalCents,
  shippingCents,
  discount,
}: {
  subtotalCents: number;
  shippingCents: number;
  discount: AppliedDiscount | null;
}): { discountCents: number; shippingCents: number; totalCents: number } {
  const waived = discount?.freeShipping ? shippingCents : 0;
  const off = Math.min(discount?.amountCents ?? 0, subtotalCents) + waived;

  return {
    discountCents: off,
    shippingCents,
    totalCents: Math.max(0, subtotalCents + shippingCents - off),
  };
}
