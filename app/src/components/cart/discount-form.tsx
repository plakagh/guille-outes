"use client";

import { useState } from "react";
import { useCart } from "@/components/cart/cart-context";
import { useI18n } from "@/components/i18n/provider";
import { CheckIcon, CloseIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import type { DiscountRefusal } from "@/lib/discounts";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { formatPrice } from "@/lib/utils";

/**
 * The promo-code box, shared by the cart and the checkout.
 *
 * One component in two places, because the code applied on one page has to be
 * the code applied on the other — it lives in the cart provider, not in this
 * form's state, so walking from the basket to the checkout does not quietly drop
 * it.
 *
 * Nothing here decides anything. The string goes to the server, the server
 * answers, and this draws the answer. A refusal gets its own sentence: "you have
 * already used this one" and "that code does not exist" send a shopper to very
 * different places, and telling them both as "invalid" is how a shop earns
 * support mail.
 */
export function DiscountForm({ className }: { className?: string }) {
  const { t } = useI18n();
  const { discount, applyCode, clearCode } = useCart();
  const [draft, setDraft] = useState("");

  const label = t.cart.code;

  if (discount.state === "applied" && discount.applied) {
    const { applied } = discount;
    return (
      <div className={className}>
        <p className="eyebrow mb-2 text-mute">{t.cart.promoCode}</p>
        <div className="flex items-center gap-2 border border-pine bg-shell px-3 py-2.5">
          <CheckIcon className="size-4 shrink-0 text-pine" />
          <span className="min-w-0 flex-1 text-[0.875rem]">
            <span className="block font-mono font-semibold uppercase">{applied.code}</span>
            {applied.freeShipping && (
              <span className="block text-[0.75rem] text-mute">{label.freeShipping}</span>
            )}
          </span>
          <button
            type="button"
            onClick={clearCode}
            className="inline-flex shrink-0 items-center gap-1 text-[0.75rem] text-mute underline hover:text-flame"
          >
            <CloseIcon className="size-3" />
            {label.remove}
          </button>
        </div>
      </div>
    );
  }

  const busy = discount.state === "checking";

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        applyCode(draft);
      }}
      className={className}
    >
      <label htmlFor="promo" className="eyebrow mb-2 block text-mute">
        {t.cart.promoCode}
      </label>
      <div className="flex gap-2">
        <input
          id="promo"
          name="promo"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={24}
          placeholder="BIENVENIDA10"
          className="h-11 min-w-0 flex-1 border border-line px-3 font-mono text-[0.875rem] uppercase outline-none transition focus:border-ink"
        />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={busy || draft.trim().length === 0}
          className="h-11 px-4"
        >
          {busy ? label.checking : t.cart.apply}
        </Button>
      </div>

      {discount.state === "refused" && discount.refusal && (
        <p role="alert" className="mt-2 text-[0.8125rem] text-flame">
          {refusalMessage(discount.refusal, discount.detail, t)}
        </p>
      )}
    </form>
  );
}

/** One sentence per way of saying no. */
export function refusalMessage(
  reason: DiscountRefusal,
  detail: number | null,
  t: Dictionary,
): string {
  const refusal = t.cart.code.refusal;

  switch (reason) {
    case "not_started":
      return refusal.notStarted;
    case "expired":
      return refusal.expired;
    case "exhausted":
      return refusal.exhausted;
    case "already_used":
      return refusal.alreadyUsed;
    case "sign_in":
      return refusal.signIn;
    case "not_yours":
      return refusal.notYours;
    case "not_first_order":
      return refusal.notFirstOrder;
    case "min_subtotal":
      return refusal.minSubtotal.replace("{{amount}}", formatPrice(detail ?? 0));
    case "no_eligible_items":
      return refusal.noEligibleItems;
    case "nothing_to_take":
      return refusal.nothingToTake;
    default:
      return t.cart.invalidCode;
  }
}
