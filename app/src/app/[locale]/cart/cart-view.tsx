"use client";

import Link from "next/link";
import { LineShot } from "@/components/product/product-shot";
import { useCart } from "@/components/cart/cart-context";
import { CartSuggestions } from "@/components/cart/cart-suggestions";
import { DiscountForm } from "@/components/cart/discount-form";
import { useI18n } from "@/components/i18n/provider";
import {
  BagIcon,
  CloseIcon,
  MinusIcon,
  PaymentMark,
  PlusIcon,
  ShieldIcon,
  TruckIcon,
} from "@/components/icons";
import { Breadcrumbs } from "@/components/ui/bits";
import { Button, ButtonLink } from "@/components/ui/button";
import { frameLabel } from "@/lib/catalog";
import { CHECKOUT_OPEN } from "@/lib/shop-status";
import { curatedSlug } from "@/lib/i18n/sections";
import { VatLines } from "@/components/cart/vat-lines";
import { formatPrice } from "@/lib/utils";

const PAYMENTS = ["Visa", "Mastercard", "Amex", "PayPal", "Bizum", "Apple Pay"];

/**
 * `outlet` says whether anything is discounted right now. The empty cart offers
 * somewhere to go, and one of those places only exists when there is an outlet:
 * both the button and the sentence that mentions it come out when there is not.
 */
export function CartView({ outlet }: { outlet: boolean }) {
  const { t, href, locale } = useI18n();
  const {
    lines,
    subtotal,
    shipping,
    discountCents,
    total,
    count,
    setQty,
    remove,
    ready,
    freeShipping,
    discount,
  } = useCart();

  if (!ready) return <div className="shell py-20" aria-busy="true" />;

  if (lines.length === 0) {
    return (
      <div className="shell flex flex-col items-start gap-5 py-20">
        <BagIcon className="size-14 text-line" />
        <h1 className="text-4xl">{t.cart.empty}</h1>
        <p className="text-[0.9375rem] text-mute">
          {outlet ? t.cart.emptyBlurb : t.cart.emptyBlurbNoOutlet}
        </p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={href("shop", curatedSlug("mas-vendido", locale))}>
            {t.cart.bestSellers}
          </ButtonLink>
          {outlet && (
            <ButtonLink href={href("shop", curatedSlug("outlet", locale))} variant="outline">
              {t.cart.viewOutlet}
            </ButtonLink>
          )}
        </div>
      </div>
    );
  }

  const { missing } = freeShipping;

  return (
    <div className="shell py-6 lg:py-10">
      <Breadcrumbs
        label={t.plp.breadcrumbHome}
        trail={[{ label: t.plp.breadcrumbHome, href: href() }, { label: t.cart.title }]}
        className="mb-4"
      />

      <h1 className="text-[clamp(2rem,5vw,3.25rem)] leading-[0.9]">
        {t.cart.title}{" "}
        <span className="font-sans text-[0.9375rem] font-normal normal-case tracking-normal text-mute">
          ({count} {count === 1 ? t.plp.item : t.plp.items})
        </span>
      </h1>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
        {/* Lines */}
        <div>
          <ul className="divide-y divide-line border-y border-line">
            {lines.map((line) => (
              <li key={line.key} className="flex gap-4 py-5">
                <Link
                  href={href("product", line.slug)}
                  className="size-24 shrink-0 bg-shell sm:size-32"
                >
                  <LineShot
                    imageUrl={line.imageUrl}
                    artworkUrl={line.artwork?.imageUrl}
                    shape={line.shape}
                    colorway={line.colorway}
                    print={line.print}
                    frame={line.frame}
                    frameFinish={line.frameFinish}
                    alt={line.name}
                  />
                </Link>

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Link
                        href={href("product", line.slug)}
                        className="block text-[0.9375rem] font-semibold leading-snug hover:underline"
                      >
                        {line.name}
                      </Link>
                      <p className="mt-1 text-[0.8125rem] text-mute">
                        {line.colorway.name} · {t.cart.size} {line.size} · {t.pdp.ref} {line.ref}
                        {line.frameFinish && ` · ${frameLabel(line.frameFinish, t.pdp)}`}
                      </p>
                      {line.artwork && (
                        <>
                          <p className="mt-0.5 truncate text-[0.8125rem] text-mute">
                            {t.gallery.printedWith} «{line.artwork.title}» · {line.artwork.author}
                          </p>
                          {/* A line that is made to order carries different terms
                              from the one above it, so it has to be possible to
                              tell them apart at a glance. */}
                          <p className="mt-1 inline-block border-l-2 border-rust bg-shell px-2 py-1 text-[0.75rem] font-semibold">
                            {t.gallery.tee.cartNote}
                          </p>
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(line.key)}
                      aria-label={`${t.common.remove}: ${line.name}`}
                      className="grid size-8 shrink-0 place-items-center text-mute transition hover:text-flame"
                    >
                      <CloseIcon className="size-4" />
                    </button>
                  </div>

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center border border-line">
                      <button
                        type="button"
                        onClick={() => setQty(line.key, line.qty - 1)}
                        aria-label={t.pdp.decreaseQty}
                        className="grid size-10 place-items-center hover:bg-shell"
                      >
                        <MinusIcon className="size-4" />
                      </button>
                      <span className="w-9 text-center text-[0.875rem] font-semibold">
                        {line.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQty(line.key, line.qty + 1)}
                        aria-label={t.pdp.increaseQty}
                        disabled={line.qty >= 10}
                        className="grid size-10 place-items-center hover:bg-shell disabled:opacity-30"
                      >
                        <PlusIcon className="size-4" />
                      </button>
                    </div>

                    <p className="text-[1.0625rem] font-semibold">{formatPrice(line.lineTotal)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <Link
            href={href("shop")}
            className="mt-5 inline-block text-[0.875rem] underline hover:decoration-2"
          >
            {t.cart.keepShopping}
          </Link>

          {/* Four here rather than the drawer's three: the column is wide enough
              for a row of them, and this is the page someone reads rather than
              glances at. */}
          <CartSuggestions limit={4} layout="grid" className="mt-10" />
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-[calc(var(--spacing-masthead)+var(--spacing-navbar)+1.5rem)] lg:self-start">
          <div className="border border-line p-5">
            <h2 className="text-xl">{t.cart.summary}</h2>

            <dl className="mt-4 space-y-2 text-[0.875rem]">
              <div className="flex justify-between">
                <dt className="text-mute">{t.cart.subtotal}</dt>
                <dd className="font-semibold">{formatPrice(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-mute">{t.cart.shipping}</dt>
                <dd className="font-semibold">
                  {shipping === 0 ? t.cart.free : formatPrice(shipping)}
                </dd>
              </div>
              {/* Waived delivery is shown here rather than as a zero shipping
                  line, so the three figures still add up to the total. */}
              {discountCents > 0 && discount.applied && (
                <div className="flex justify-between text-pine">
                  <dt>
                    {t.cart.discount}{" "}
                    <span className="font-mono text-[0.8125rem]">{discount.applied.code}</span>
                  </dt>
                  <dd className="font-semibold">−{formatPrice(discountCents)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-line pt-3 text-lg">
                <dt className="font-display font-bold uppercase">{t.cart.total}</dt>
                <dd className="font-bold">{formatPrice(total)}</dd>
              </div>
              {/* The split of that total, not an addition to it. */}
              <div className="space-y-2 border-t border-line-soft pt-2 text-[0.8125rem]">
                <VatLines grossCents={total} t={t} />
              </div>
            </dl>

            <p className="mt-1 text-[0.75rem] text-mute">{t.common.vatIncluded}</p>

            {missing > 0 && (
              <p className="mt-4 flex items-start gap-2 bg-shell p-3 text-[0.8125rem]">
                <TruckIcon className="mt-0.5 size-4 shrink-0" />
                <span>
                  {t.cart.addMore} <span className="font-semibold">{formatPrice(missing)}</span>{" "}
                  {t.cart.andShippingFree}
                </span>
              </p>
            )}

            <DiscountForm className="mt-5" />

            {CHECKOUT_OPEN ? (
              <>
                {/* "Continuar" is red, "seguir comprando" is the outline below (§2.2). */}
                <ButtonLink
                  href={href("checkout")}
                  variant="primary"
                  block
                  size="lg"
                  className="mt-5"
                >
                  {t.cart.goToPay}
                </ButtonLink>

                <p className="mt-3 flex items-start gap-2 text-[0.75rem] leading-relaxed text-mute">
                  <ShieldIcon className="mt-0.5 size-4 shrink-0" />
                  {t.cart.securePayment}
                </p>
              </>
            ) : (
              /*
                Disabled rather than absent.

                The button is where a shopper looks for the answer to "can I buy
                this yet", and a summary with nothing at the bottom of it reads
                as a broken page rather than a shop that has not opened. So it
                stays, greyed, with the reason underneath — and the note says the
                basket is kept, because that is the argument for filling one now.
              */
              <>
                <Button
                  type="button"
                  variant="primary"
                  block
                  size="lg"
                  disabled
                  className="mt-5"
                >
                  {t.comingSoon.cartCta}
                </Button>
                <p className="mt-3 border-l-2 border-ink bg-shell p-3 text-[0.8125rem] leading-relaxed">
                  {t.comingSoon.cartNote}
                </p>
              </>
            )}

            <ul className="mt-4 flex flex-wrap gap-1.5">
              {PAYMENTS.map((label) => (
                <li key={label} className="[&_span]:border-line">
                  <PaymentMark label={label} tone="#4a4a4a" />
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
