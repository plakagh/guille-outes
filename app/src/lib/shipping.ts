/**
 * Shipping rates and thresholds.
 *
 * Deliberately a neutral module — no `"use client"`, no `"server-only"` —
 * because both the checkout UI and the server action that prices the order use
 * it, and they must agree. Importing a value from a `"use client"` module into a
 * Server Action does not fail loudly: Next substitutes a throwing proxy, which
 * then stringifies into the arithmetic and produces nonsense. Keeping the maths
 * here is what stops the displayed total and the charged total from drifting.
 *
 * The **numbers** are no longer here. They live in `shipping_settings`, so a rate
 * change is a form submission rather than a deploy, and they reach the browser as
 * props (see `CartProvider`). What stays is the shape, the parsing and the one
 * function that decides what delivery costs.
 *
 * All amounts are integer cents.
 */

export type ShippingMethod = "standard" | "express" | "pickup";

export const SHIPPING_METHODS: ShippingMethod[] = ["standard", "express", "pickup"];

export type ShippingSettings = {
  /** Subtotal at or above which standard delivery is free. */
  freeThreshold: number;
  rates: Record<ShippingMethod, number>;
  /**
   * Which services the shop offers. Standard is always available: a checkout
   * with no shipping option is a dead end.
   */
  enabled: Record<ShippingMethod, boolean>;
};

/**
 * Used when the settings row cannot be read — a cold cache, a database blip.
 *
 * These are the values the shop launched with, so falling back is a degraded
 * read rather than a free-shipping accident. The server re-prices every order
 * from the database regardless, so a fallback shown in the browser can never be
 * what gets charged.
 */
export const DEFAULT_SHIPPING: ShippingSettings = {
  freeThreshold: 6000,
  rates: { standard: 495, express: 895, pickup: 295 },
  enabled: { standard: true, express: true, pickup: true },
};

export function isShippingMethod(value: string): value is ShippingMethod {
  return (SHIPPING_METHODS as string[]).includes(value);
}

/**
 * The single definition of what shipping costs.
 *
 * Free delivery applies to the **standard** service only — upgrading to express
 * is always paid, because the threshold is a promise about the cheapest way to
 * get the parcel, not a discount on every service.
 */
export function shippingCost(
  subtotalCents: number,
  method: ShippingMethod,
  settings: ShippingSettings,
): number {
  if (method === "standard" && subtotalCents >= settings.freeThreshold) return 0;
  return settings.rates[method] ?? settings.rates.standard;
}

/** What the free-shipping meter needs: how much more to spend, and how far along. */
export function freeShippingProgress(subtotalCents: number, settings: ShippingSettings) {
  const missing = Math.max(0, settings.freeThreshold - subtotalCents);
  const percent =
    settings.freeThreshold > 0 ? Math.min(100, (subtotalCents / settings.freeThreshold) * 100) : 100;

  return { missing, percent, reached: missing === 0 };
}

/** Reads a `shipping_settings` row, falling back rather than throwing. */
export function parseShippingSettings(row: unknown): ShippingSettings {
  if (typeof row !== "object" || row === null) return DEFAULT_SHIPPING;

  const raw = row as Record<string, unknown>;
  const cents = (value: unknown, fallback: number) => {
    const number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number) && number >= 0 ? Math.round(number) : fallback;
  };

  return {
    freeThreshold: cents(raw.free_threshold_cents, DEFAULT_SHIPPING.freeThreshold),
    rates: {
      standard: cents(raw.standard_cents, DEFAULT_SHIPPING.rates.standard),
      express: cents(raw.express_cents, DEFAULT_SHIPPING.rates.express),
      pickup: cents(raw.pickup_cents, DEFAULT_SHIPPING.rates.pickup),
    },
    enabled: {
      standard: true,
      express: raw.express_enabled !== false,
      pickup: raw.pickup_enabled !== false,
    },
  };
}
