import type { Dictionary } from "@/lib/i18n/dictionary";
import { formatVatRate, vatBreakdown } from "@/lib/tax";
import { formatPrice } from "@/lib/utils";

/**
 * The tax split, for any `<dl>` that shows a total.
 *
 * One component so the cart, the checkout and the order page cannot drift apart:
 * three copies of "base = total ÷ 1,21" is three chances to round differently.
 *
 * Placed *below* the total on purpose. The total is what the customer pays and is
 * the figure they came for; the base and the tax explain how it is made up. Adding
 * tax on top of a running subtotal would suggest the earlier prices were net,
 * which they never are here.
 */
export function VatLines({
  grossCents,
  rate,
  t,
  tone = "light",
}: {
  grossCents: number;
  rate?: number;
  t: Dictionary;
  /** `dark` for the ink-on-white summaries inverted onto black. */
  tone?: "light" | "dark";
}) {
  const { netCents, vatCents, rate: applied } = vatBreakdown(grossCents, rate);
  const muted = tone === "dark" ? "text-white/60" : "text-mute";
  const value = tone === "dark" ? "text-white/80" : "text-ink/80";

  return (
    <>
      <div className="flex justify-between">
        <dt className={muted}>{t.cart.taxBase}</dt>
        <dd className={value}>{formatPrice(netCents)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className={muted}>
          {t.cart.vat} ({formatVatRate(applied)})
        </dt>
        <dd className={value}>{formatPrice(vatCents)}</dd>
      </div>
    </>
  );
}
