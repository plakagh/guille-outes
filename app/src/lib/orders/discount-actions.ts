"use server";

import { getCatalog } from "@/lib/db/catalog";
import { lookupDiscount } from "@/lib/db/discounts";
import { getShippingSettings } from "@/lib/db/settings";
import { evaluateDiscount, type DiscountResult } from "@/lib/discounts";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { discountLines, parseLines } from "@/lib/orders/lines";
import { isShippingMethod, shippingCost } from "@/lib/shipping";
import { getUser } from "@/lib/supabase/server";

/**
 * Checking a code from the cart.
 *
 * The browser sends the string and its choices; everything else — what the code
 * is worth, what the basket is worth, what delivery costs — is read here. The
 * answer is a display figure, and it is not remembered: `placeOrder` runs the
 * whole check again against the basket it is actually charging for, so a cart
 * left open through the end of a campaign is refused at the till rather than
 * honoured on the strength of a stale quote.
 *
 * There is no rate limiting on this, and it is worth being clear why: a code is
 * something the shop prints on a flyer, and the limits that cost money — how
 * many times, by whom, first order only — are counted in the database, not here.
 */
export async function quoteDiscount(input: {
  code: string;
  /** The same JSON the checkout posts: choices only, never prices. */
  lines: string;
  shippingMethod: string;
  locale: string;
}): Promise<DiscountResult> {
  const locale: Locale = isLocale(input.locale) ? input.locale : "es";

  const rules = await lookupDiscount(input.code);
  if (!rules) return { ok: false, reason: "unknown" };

  const lines = parseLines(input.lines);
  if (lines.length === 0) return { ok: false, reason: "no_eligible_items" };

  const [catalog, shippingSettings, user] = await Promise.all([
    getCatalog(locale),
    getShippingSettings(),
    getUser(),
  ]);

  const priced = discountLines(catalog, lines);
  const subtotal = priced.reduce((total, line) => total + line.lineTotal, 0);

  // An unknown or switched-off method quotes as standard rather than failing:
  // this is the code box, and the shipping choice has its own validation at
  // checkout. What matters here is that a free-shipping code is judged against a
  // real rate.
  const method = isShippingMethod(input.shippingMethod) ? input.shippingMethod : "standard";

  return evaluateDiscount({
    rules,
    lines: priced,
    shippingCents: shippingCost(subtotal, method, shippingSettings),
    signedIn: user !== null,
    now: new Date(),
  });
}
