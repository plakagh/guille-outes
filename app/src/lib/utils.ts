export type ClassValue = string | false | null | undefined;

/** Join conditional class names. Kept dependency-free on purpose. */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}

const eur = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

/** Prices are stored as integer cents everywhere in the catalog. */
export function formatPrice(cents: number): string {
  return eur.format(cents / 100);
}

/** Discount as a negative integer percentage, e.g. -30. */
export function discountPercent(price: number, compareAt: number): number {
  return -Math.round(((compareAt - price) / compareAt) * 100);
}

/** Strips Latin combining marks (U+0300–U+036F) left behind by NFD. */
const COMBINING_MARKS = /[\u0300-\u036f]/g;

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
