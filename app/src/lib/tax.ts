/**
 * IVA.
 *
 * Every price in this shop — on a product card, in the cart, in the total the
 * bank charges — is the price the customer pays, tax included. That is not a
 * stylistic choice: Spanish consumer law requires the price shown to a consumer
 * to be the final price (RDL 1/2007, art. 60; and Real Decreto 3423/2000 on
 * price indication). Showing a net price and adding tax at the end would be
 * unlawful here, and it also makes the shop feel like it is hiding something.
 *
 * What the customer *does* have a right to see is the split, on the documents
 * that record the sale: the taxable base, the rate, and the amount of tax
 * (Reglamento de facturación, RD 1619/2012). So the breakdown appears in the
 * order summary and in the emails, derived from the gross figure rather than the
 * other way round.
 *
 * A neutral module on purpose — no `"use client"`, no `"server-only"` — because
 * both the checkout in the browser and the order pipeline on the server must
 * compute the same numbers. (This is the mistake `shipping.ts` exists to avoid:
 * a Server Action importing constants from a client module gets a throwing proxy
 * that stringifies into the arithmetic.)
 */

/** Clothing and accessories in Spain carry the general rate. */
export const VAT_RATE = 0.21;

export type VatBreakdown = {
  /** The rate applied, as a fraction. Stored per order, not assumed. */
  rate: number;
  /** Base imponible, in integer cents. */
  netCents: number;
  /** Cuota de IVA, in integer cents. */
  vatCents: number;
  /** What the customer pays. Always `netCents + vatCents`, exactly. */
  grossCents: number;
};

/**
 * Splits a tax-inclusive amount into base and tax.
 *
 * The base is rounded and the tax is then taken as the remainder, so the two
 * always add back up to the gross to the cent. Deriving both independently would
 * let them disagree by one cent, and an invoice whose lines do not sum is not a
 * valid invoice.
 *
 * Shipping is included in the amount passed here: transport charged as part of a
 * sale takes the rate of what is being sold, so it is not a separate base.
 */
export function vatBreakdown(grossCents: number, rate: number = VAT_RATE): VatBreakdown {
  const safeRate = Number.isFinite(rate) && rate >= 0 ? rate : VAT_RATE;
  const netCents = Math.round(grossCents / (1 + safeRate));

  return {
    rate: safeRate,
    netCents,
    vatCents: grossCents - netCents,
    grossCents,
  };
}

/** "21 %" — for labels like "IVA (21 %)". Whole numbers stay whole. */
export function formatVatRate(rate: number): string {
  const percent = rate * 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)} %`;
}
