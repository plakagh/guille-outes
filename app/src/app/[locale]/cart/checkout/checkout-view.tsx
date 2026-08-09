"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { LineShot } from "@/components/product/product-shot";
import { useCart } from "@/components/cart/cart-context";
import { DiscountForm, refusalMessage } from "@/components/cart/discount-form";
import { VatLines } from "@/components/cart/vat-lines";
import { shippingCost, type ShippingMethod } from "@/lib/shipping";
import { useI18n } from "@/components/i18n/provider";
import { CheckIcon, ShieldIcon } from "@/components/icons";
import { Button, ButtonLink } from "@/components/ui/button";
import { frameLabel } from "@/lib/catalog";
import { totalWithDiscount, type DiscountRefusal } from "@/lib/discounts";
import { placeOrder, type CheckoutState } from "@/lib/orders/actions";
import { cn, formatPrice } from "@/lib/utils";

export function CheckoutView() {
  const { t, href, locale } = useI18n();
  const { lines, subtotal, count, ready, shippingSettings, discount, setQuoteMethod, linesJson } =
    useCart();
  const [state, action, submitting] = useActionState<CheckoutState, FormData>(placeOrder, {});

  // Built from the shop's live rates, and filtered to the services it actually
  // offers — a switched-off method must not be selectable, because the server
  // would refuse it and the shopper would not know why.
  const delivery: { id: ShippingMethod; label: string; eta: string; price: number }[] = (
    [
      {
        id: "standard",
        label: t.checkout.delivery.standard,
        eta: t.checkout.delivery.standardEta,
        price: shippingSettings.rates.standard,
      },
      {
        id: "express",
        label: t.checkout.delivery.express,
        eta: t.checkout.delivery.expressEta,
        price: shippingSettings.rates.express,
      },
      {
        id: "pickup",
        label: t.checkout.delivery.pickup,
        eta: t.checkout.delivery.pickupEta,
        price: shippingSettings.rates.pickup,
      },
    ] satisfies { id: ShippingMethod; label: string; eta: string; price: number }[]
  ).filter((option) => shippingSettings.enabled[option.id]);

  const [shippingId, setShippingId] = useState<ShippingMethod>("standard");

  /**
   * Picking a delivery service also re-asks about the code.
   *
   * A free-delivery code is worth nothing on an order that already ships free
   * and 8,95 € on an express one, so the verdict depends on the choice. Done in
   * the handler rather than in an effect watching `shippingId`: it is one event
   * with two consequences, not a state change to synchronise afterwards.
   */
  const chooseShipping = (method: ShippingMethod) => {
    setShippingId(method);
    setQuoteMethod(method);
  };

  if (!ready) return <div className="shell py-20" aria-busy="true" />;

  if (lines.length === 0) {
    return (
      <div className="shell flex flex-col items-start gap-5 py-20">
        <h1 className="text-4xl">{t.cart.nothingToPay}</h1>
        <p className="max-w-md text-[0.9375rem] text-mute">{t.cart.nothingToPayBlurb}</p>
        <ButtonLink href={href("shop")}>{t.cart.viewCatalogue}</ButtonLink>
      </div>
    );
  }

  const chosen = delivery.find((option) => option.id === shippingId) ?? delivery[0];
  // Same helpers the server uses to price the order, so the total shown is the
  // total charged — and the amount signed for the bank.
  const shipping = shippingCost(subtotal, chosen.id, shippingSettings);
  const priced = totalWithDiscount({
    subtotalCents: subtotal,
    shippingCents: shipping,
    discount: discount.applied,
  });
  const total = priced.totalCents;

  return (
    <div className="shell py-6 lg:py-10">
      <h1 className="text-[clamp(2rem,5vw,3.25rem)] leading-[0.9]">{t.checkout.title}</h1>

      <form
        action={action}
        className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14"
      >
        <input type="hidden" name="locale" value={locale} />
        {/*
          Only the choices travel — slug, size, colour, quantity. Prices and
          stock are recomputed server-side, so a tampered cart cannot change
          what gets charged, and the amount we sign for the bank is ours.
        */}
        {/*
          Built by the cart provider, so the basket the code was checked against
          and the basket being ordered are the same string. Which drawing goes on
          a line travels as an id and nothing else: the title and the file are
          read from the database on the server, like the price.
        */}
        <input type="hidden" name="lines" value={linesJson} />
        {/*
          The code, not the saving. `placeOrder` looks it up and applies it again
          from scratch — a discount posted from the browser would be a discount
          anyone could invent.

          Posted while the answer is still in flight as well as after it arrives:
          somebody who types a code and hits pay in the same breath must not be
          charged full price because the round trip lost the race. The server
          reaches its own verdict either way, and refuses the order rather than
          silently dropping the code.
        */}
        {discount.code && (discount.state === "applied" || discount.state === "checking") && (
          <input type="hidden" name="code" value={discount.code} />
        )}
        <div className="space-y-10">
          <Step number={1} title={t.checkout.contact}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.checkout.email} type="email" name="email" required span={2} />
              <Field label={t.checkout.phone} type="tel" name="tel" required />
            </div>
          </Step>

          <Step number={2} title={t.checkout.shippingAddress}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.checkout.firstName} name="firstName" required />
              <Field label={t.checkout.lastName} name="lastName" required />
              <Field label={t.checkout.address} name="address" required span={2} />
              <Field label={t.checkout.addressExtra} name="addressExtra" span={2} />
              <Field label={t.checkout.postcode} name="postcode" required />
              <Field label={t.checkout.city} name="city" required />
              <Field label={t.checkout.province} name="province" required span={2} />
            </div>
          </Step>

          <Step number={3} title={t.checkout.shippingMethod}>
            <ul className="divide-y divide-line border-y border-line">
              {delivery.map((option) => {
                const cost = shippingCost(subtotal, option.id, shippingSettings);
                return (
                  <li key={option.id}>
                    <label className="flex cursor-pointer items-center gap-3 py-4">
                      <Radio
                        name="shipping"
                        value={option.id}
                        checked={shippingId === option.id}
                        onChange={() => chooseShipping(option.id)}
                      />
                      <span className="flex-1">
                        <span className="block text-[0.9375rem] font-semibold">{option.label}</span>
                        <span className="block text-[0.8125rem] text-mute">{option.eta}</span>
                      </span>
                      <span className="text-[0.9375rem] font-semibold">
                        {cost === 0 ? t.cart.free : formatPrice(cost)}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </Step>

          <Step number={4} title={t.checkout.payment}>
            <div className="border-y border-line py-5">
              <p className="flex items-start gap-2.5 text-[0.9375rem] font-semibold">
                <ShieldIcon className="mt-0.5 size-5 shrink-0" />
                {t.checkout.payViaBank}
              </p>
              <p className="mt-2 max-w-xl text-[0.875rem] leading-relaxed text-mute">
                {t.checkout.payViaBankBody}
              </p>
            </div>
          </Step>
        </div>

        <aside className="lg:sticky lg:top-[calc(var(--spacing-masthead)+1.5rem)] lg:self-start">
          <div className="border border-line p-5">
            <h2 className="text-xl">
              {t.checkout.yourOrder}{" "}
              <span className="font-sans text-[0.8125rem] font-normal normal-case tracking-normal text-mute">
                ({count})
              </span>
            </h2>

            <ul className="mt-4 space-y-3 border-b border-line pb-4">
              {lines.map((line) => (
                <li key={line.key} className="flex items-center gap-3">
                  {/* A div, not a span: a framed line draws a frame, and a
                      frame is boxes — inside an inline element the browser
                      would re-parent them and the summary would come apart. */}
                  <div className="size-14 shrink-0 bg-shell">
                    <LineShot
                      imageUrl={line.imageUrl}
                      artworkUrl={line.artwork?.imageUrl}
                      shape={line.shape}
                      colorway={line.colorway}
                      print="none"
                      frame={line.frame}
                      frameFinish={line.frameFinish}
                      alt={line.name}
                    />
                  </div>
                  <span className="min-w-0 flex-1 text-[0.8125rem]">
                    <span className="block truncate font-semibold">{line.name}</span>
                    <span className="block text-mute">
                      {line.colorway.name} · {line.size} · ×{line.qty}
                      {line.frameFinish && ` · ${frameLabel(line.frameFinish, t.pdp)}`}
                    </span>
                    {line.artwork && (
                      <>
                        <span className="block truncate text-mute">
                          {t.gallery.printedWith} «{line.artwork.title}»
                        </span>
                        <span className="mt-1 inline-block border-l-2 border-flame bg-shell px-1.5 py-0.5 text-[0.6875rem] font-semibold text-ink">
                          {t.gallery.tee.cartNote}
                        </span>
                      </>
                    )}
                  </span>
                  <span className="text-[0.8125rem] font-semibold">
                    {formatPrice(line.lineTotal)}
                  </span>
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-2 text-[0.875rem]">
              <div className="flex justify-between">
                <dt className="text-mute">{t.cart.subtotal}</dt>
                <dd className="font-semibold">{formatPrice(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-mute">
                  {t.cart.shipping} ({chosen.label.toLowerCase()})
                </dt>
                <dd className="font-semibold">
                  {shipping === 0 ? t.cart.free : formatPrice(shipping)}
                </dd>
              </div>
              {priced.discountCents > 0 && discount.applied && (
                <div className="flex justify-between text-pine">
                  <dt>
                    {t.cart.discount}{" "}
                    <span className="font-mono text-[0.8125rem]">{discount.applied.code}</span>
                  </dt>
                  <dd className="font-semibold">−{formatPrice(priced.discountCents)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-line pt-3 text-lg">
                <dt className="font-display font-bold uppercase">{t.cart.total}</dt>
                <dd className="font-bold">{formatPrice(total)}</dd>
              </div>
              <div className="space-y-2 border-t border-line-soft pt-2 text-[0.8125rem]">
                <VatLines grossCents={total} t={t} />
              </div>
            </dl>

            <DiscountForm className="mt-5" />

            <Button type="submit" block size="lg" disabled={submitting} className="mt-5">
              {submitting ? t.admin.saving : `${t.checkout.pay} ${formatPrice(total)}`}
            </Button>

            {state.error && (
              <p role="alert" className="mt-3 text-[0.8125rem] font-semibold text-flame">
                {state.error === "out_of_stock"
                  ? `${t.pdp.soldOut}: ${state.detail ?? ""}`
                  : state.error === "not_signed_in"
                    ? t.account.signInToSave
                    : state.error === "discount_refused"
                      ? // The code stopped working between the cart and the till.
                        // Nobody is charged more than the page said; they are told
                        // why and the box is theirs to clear.
                        refusalMessage((state.detail ?? "unknown") as DiscountRefusal, null, t)
                      : t.admin.error}
              </p>
            )}

            <p className="mt-3 flex items-start gap-2 text-[0.75rem] leading-relaxed text-mute">
              <ShieldIcon className="mt-0.5 size-4 shrink-0" />
              {t.cart.securePayment}
            </p>

            <p className="mt-3 text-[0.75rem] leading-relaxed text-mute">
              {t.checkout.acceptTerms}{" "}
              <Link href={href("legal", "condiciones")} className="underline hover:text-ink">
                {t.checkout.termsLink}
              </Link>
              .
            </p>

            <ul className="mt-4 space-y-1.5 text-[0.75rem] text-mute">
              {t.checkout.perks.map((item) => (
                <li key={item} className="flex items-start gap-1.5">
                  <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-pine" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </form>
    </div>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-4 flex items-center gap-3 text-xl">
        <span className="grid size-7 place-items-center bg-ink font-sans text-[0.8125rem] font-bold text-white">
          {number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  span,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  span?: 2;
}) {
  return (
    <label className={cn("block", span === 2 && "sm:col-span-2")}>
      <span className="eyebrow mb-1.5 block text-mute">
        {label}
        {required && <span className="text-flame"> *</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        className="h-12 w-full border border-line px-3 text-[0.9375rem] outline-none transition focus:border-ink"
      />
    </label>
  );
}

function Radio({
  name,
  value,
  checked,
  onChange,
}: {
  name: string;
  /** Required: without it the browser submits "on" for every option. */
  value: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <span className="relative grid size-5 shrink-0 place-items-center">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="peer size-full cursor-pointer appearance-none rounded-full border border-line transition checked:border-ink"
      />
      <span className="pointer-events-none absolute size-2.5 rounded-full bg-ink opacity-0 peer-checked:opacity-100" />
    </span>
  );
}
