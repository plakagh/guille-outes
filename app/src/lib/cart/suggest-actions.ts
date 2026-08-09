"use server";

import { crossSell } from "@/lib/catalog";
import { toSuggestion, type CartSuggestion } from "@/lib/cart/suggestions";
import { getCatalog } from "@/lib/db/catalog";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { parseLines } from "@/lib/orders/lines";

/** Never more than a shelf's worth, whatever the caller asks for. */
const MAX = 4;

/**
 * What else to show someone who already has something in the basket.
 *
 * The browser sends its choices — the same slug/size/colour payload the checkout
 * posts — and gets back tiles. Nothing is trusted from it and nothing is written:
 * the basket is read only to find out which sections have already been bought
 * from, and every name, price and photograph comes from the catalogue on this
 * side. An unknown slug is simply skipped, exactly as it is when a code is
 * checked; there is no order here to refuse.
 *
 * Reads go through the visitor's own Supabase client, so an unpublished product
 * is invisible here for the same reason it is invisible everywhere else.
 */
export async function suggestForCart(input: {
  /** The cart's `linesJson`: choices only, never prices. */
  lines: string;
  locale: string;
  limit?: number;
}): Promise<CartSuggestion[]> {
  const locale: Locale = isLocale(input.locale) ? input.locale : "es";
  const limit = Math.min(MAX, Math.max(1, Math.floor(input.limit ?? 3)));

  const lines = parseLines(input.lines);
  if (lines.length === 0) return [];

  const catalog = await getCatalog(locale);

  // Deduped by slug: two formats of the same print are one thing as far as
  // "which sections have they already bought from" is concerned.
  const basket = [...new Set(lines.map((line) => line.slug))].flatMap((slug) => {
    const product = catalog.products.find((candidate) => candidate.slug === slug);
    return product ? [product] : [];
  });

  const sections = new Map(catalog.categories.map((category) => [category.id, category.name]));

  return crossSell(catalog.products, basket, limit).map((product) =>
    toSuggestion(product, sections.get(product.categoryId) ?? "", locale),
  );
}
