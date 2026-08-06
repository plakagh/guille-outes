import type { Catalog } from "@/lib/catalog";
import { onSale } from "@/lib/catalog";
import type { DiscountLine } from "@/lib/discounts";

/**
 * The basket as it arrives from the browser, and what the server makes of it.
 *
 * Shared by `placeOrder` and by the code-checking action, because both start the
 * same way: take a list of *choices* — slug, size, colour, quantity — and look
 * up what they actually cost. Neither ever reads a price out of the request.
 */

export type CheckoutLineInput = {
  slug: string;
  size: string;
  colorwayId: string;
  qty: number;
  /** A drawing from the children's gallery, printed on this line. */
  artworkId?: string;
};

/** Cart lines travel as JSON in a hidden field, then get validated here. */
export function parseLines(raw: string): CheckoutLineInput[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (typeof item !== "object" || item === null) return [];
      const line = item as Partial<CheckoutLineInput>;
      if (
        typeof line.slug !== "string" ||
        typeof line.size !== "string" ||
        typeof line.colorwayId !== "string" ||
        !Number.isFinite(line.qty)
      ) {
        return [];
      }
      // Clamp rather than trust: the same ceiling the UI enforces.
      const qty = Math.min(10, Math.max(1, Math.floor(Number(line.qty))));
      return [
        {
          slug: line.slug,
          size: line.size,
          colorwayId: line.colorwayId,
          qty,
          artworkId: typeof line.artworkId === "string" ? line.artworkId : undefined,
        },
      ];
    });
  } catch {
    return [];
  }
}

/**
 * The basket reduced to what a discount code needs: what each line is worth, and
 * which part of the catalogue it belongs to.
 *
 * Priced from the catalogue, like everything else. A line whose product has gone
 * is simply dropped — `placeOrder` is what refuses the order over it, and a code
 * check has no business failing with a different error than the checkout will.
 */
export function discountLines(catalog: Catalog, lines: CheckoutLineInput[]): DiscountLine[] {
  return lines.flatMap((line) => {
    const product = catalog.products.find((candidate) => candidate.slug === line.slug);
    if (!product) return [];

    return [
      {
        categoryId: product.categoryId,
        collectionId: product.collectionId,
        discounted: onSale(product),
        lineTotal: product.price * line.qty,
      },
    ];
  });
}
