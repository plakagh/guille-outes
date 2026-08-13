"use client";

import Link from "next/link";
import { LineShot } from "@/components/product/product-shot";
import { useCart, type CartLine } from "@/components/cart/cart-context";
import { CartSuggestions } from "@/components/cart/cart-suggestions";
import { VatLines } from "@/components/cart/vat-lines";
import { useI18n } from "@/components/i18n/provider";
import { BagIcon, CloseIcon, MinusIcon, PlusIcon, TruckIcon } from "@/components/icons";
import { Button, ButtonLink } from "@/components/ui/button";
import { frameLabel } from "@/lib/catalog";
import { formatPrice } from "@/lib/utils";

export function CartDrawer() {
  const { t, href } = useI18n();
  const { isOpen, close, lines, subtotal, shipping, discountCents, total, count, freeShipping, discount } =
    useCart();
  if (!isOpen) return null;

  const { missing, percent: progress } = freeShipping;

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={t.cart.title}>
      <button
        type="button"
        aria-label={t.common.close}
        onClick={close}
        className="absolute inset-0 bg-black/50 animate-[scrim-in_200ms_ease-out]"
      />

      <div
        className="absolute inset-y-0 right-0 flex w-[min(28rem,100vw)] flex-col bg-white animate-[drawer-in_300ms_var(--ease-out-quint)]"
        style={{ "--from": "100%" } as React.CSSProperties}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="flex items-center gap-2 text-xl">
            <BagIcon className="size-5" />
            {t.cart.title}
            <span className="font-sans text-[0.875rem] font-normal normal-case text-mute">
              ({count})
            </span>
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label={t.common.close}
            className="grid size-9 place-items-center hover:text-flame"
          >
            <CloseIcon className="size-5" />
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <BagIcon className="size-12 text-line" />
            <p className="text-[0.9375rem] text-mute">{t.cart.empty}</p>
            <ButtonLink href={href("shop")} onClick={close}>
              {t.cart.startShopping}
            </ButtonLink>
          </div>
        ) : (
          <>
            {/* Free-shipping meter */}
            <div className="border-b border-line-soft bg-shell px-5 py-3">
              <p className="flex items-center gap-2 text-[0.8125rem]">
                <TruckIcon className="size-[1.15rem] shrink-0" />
                {missing === 0 ? (
                  <span className="font-semibold text-pine">{t.cart.freeShippingReached}</span>
                ) : (
                  <span>
                    {t.cart.missingForFree}{" "}
                    <span className="font-semibold">{formatPrice(missing)}</span>{" "}
                    {t.cart.forFreeShipping}
                  </span>
                )}
              </p>
              <div className="mt-2 h-1 w-full bg-shell-deep">
                <div
                  className="h-full bg-ink transition-[width] duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* The lines and what to look at next share one scroller, so the
                shelf sits under the basket rather than pinned above the total,
                and the total stays where it is. */}
            <div className="flex-1 overflow-y-auto">
              <ul className="divide-y divide-line-soft">
                {lines.map((line) => (
                  <CartRow key={line.key} line={line} />
                ))}
              </ul>
              {/* The shelf brings its own rule and its own shading — it has to
                  stop looking like one more line of the order. */}
              <CartSuggestions limit={3} />
            </div>

            <div className="space-y-3 border-t border-line px-5 py-4">
              <dl className="space-y-1.5 text-[0.875rem]">
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
                {/* No code box in the drawer — it is a glance at the basket,
                    not a checkout. A code applied on the cart page still shows
                    here, because the total would otherwise contradict itself. */}
                {discountCents > 0 && discount.applied && (
                  <div className="flex justify-between text-pine">
                    <dt>
                      {t.cart.discount}{" "}
                      <span className="font-mono text-[0.75rem]">{discount.applied.code}</span>
                    </dt>
                    <dd className="font-semibold">−{formatPrice(discountCents)}</dd>
                  </div>
                )}
                <div className="flex justify-between border-t border-line pt-2 text-base">
                  <dt className="font-display font-bold uppercase">{t.cart.total}</dt>
                  <dd className="font-bold">{formatPrice(total)}</dd>
                </div>
                <div className="space-y-1 border-t border-line-soft pt-2 text-[0.75rem]">
                  <VatLines grossCents={total} t={t} />
                </div>
              </dl>

              <ButtonLink href={href("cart")} onClick={close} block size="lg">
                {t.cart.checkout}
              </ButtonLink>
              <button
                type="button"
                onClick={close}
                className="w-full text-center text-[0.8125rem] text-mute underline hover:text-ink"
              >
                {t.cart.keepShopping}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CartRow({ line }: { line: CartLine }) {
  const { t, href } = useI18n();
  const { setQty, remove, close } = useCart();
  const productHref = href("product", line.slug);

  return (
    <li className="flex gap-3 p-4">
      <Link href={productHref} onClick={close} className="size-20 shrink-0 bg-shell">
        {/* A line with a drawing on it is shown wearing the drawing — same
            chest anchor as the real print, so the cart shows what gets made.
            A cuadro is shown in the frame it was bought in, for the same
            reason: the moulding is on the bill, so it is on the thumbnail. */}
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

      <div className="min-w-0 flex-1">
        <Link
          href={productHref}
          onClick={close}
          className="block text-[0.875rem] font-semibold leading-snug hover:underline"
        >
          {line.name}
        </Link>
        <p className="mt-0.5 text-[0.75rem] text-mute">
          {line.colorway.name} · {t.cart.size} {line.size}
          {/* The frame is part of what was bought, so it is part of what the
              line says — a cuadro can be in this basket twice, once framed and
              once not, and they are otherwise identical. */}
          {line.frameFinish && ` · ${frameLabel(line.frameFinish, t.pdp)}`}
        </p>
        {line.artwork && (
          <>
            <p className="mt-0.5 truncate text-[0.75rem] text-mute">
              {t.gallery.printedWith} «{line.artwork.title}» · {line.artwork.author}
            </p>
            <p className="mt-1 inline-block border-l-2 border-flame bg-shell px-1.5 py-0.5 text-[0.6875rem] font-semibold">
              {t.gallery.tee.cartNote}
            </p>
          </>
        )}

        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="flex items-center border border-line">
            <button
              type="button"
              onClick={() => setQty(line.key, line.qty - 1)}
              aria-label={t.pdp.decreaseQty}
              className="grid size-8 place-items-center hover:bg-shell"
            >
              <MinusIcon className="size-3.5" />
            </button>
            <span className="w-8 text-center text-[0.8125rem] font-semibold" aria-live="polite">
              {line.qty}
            </span>
            <button
              type="button"
              onClick={() => setQty(line.key, line.qty + 1)}
              aria-label={t.pdp.increaseQty}
              disabled={line.qty >= 10}
              className="grid size-8 place-items-center hover:bg-shell disabled:opacity-30"
            >
              <PlusIcon className="size-3.5" />
            </button>
          </div>

          <p className="text-[0.875rem] font-semibold">{formatPrice(line.lineTotal)}</p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => remove(line.key)}
          className="mt-2 h-auto bg-transparent px-0 text-[0.75rem] font-medium normal-case tracking-normal text-mute underline hover:bg-transparent hover:text-flame"
        >
          {t.common.remove}
        </Button>
      </div>
    </li>
  );
}
