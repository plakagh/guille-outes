"use client";

import { useState } from "react";
import { ProductArt } from "@/components/brand/product-art";
import { useCart } from "@/components/cart/cart-context";
import { useI18n } from "@/components/i18n/provider";
import { Swatch } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { stockFor, type Product } from "@/lib/catalog";
import { cn, formatPrice } from "@/lib/utils";

/**
 * "Ponlo en una camiseta."
 *
 * The call to action lives **here**, on the drawing, rather than on the home
 * page: nobody arrives wanting to buy a shirt with a drawing on it, they arrive
 * having just made a drawing. So the home page invites you to draw, and the
 * shirt is what the drawing offers you once it exists.
 *
 * Everything on this panel is a choice, never a price. What the shirt costs and
 * whether that drawing may be printed at all are settled again in `placeOrder`
 * from the database — which matters more than usual here, because the artwork id
 * decides what gets physically made.
 */
export function ArtworkTee({
  artwork,
  products,
}: {
  artwork: { id: string; slug: string; title: string; author: string; imageUrl: string };
  /** Products the shop has marked as able to carry a drawing. */
  products: Product[];
}) {
  const { t } = useI18n();
  const { add } = useCart();

  const [productIndex, setProductIndex] = useState(0);
  const [colorIndex, setColorIndex] = useState(0);
  const [size, setSize] = useState<string | null>(null);
  const [error, setError] = useState(false);

  // The shop can untick the last printable product at any time; with none left,
  // the drawing page simply has no shirt section rather than an empty picker.
  const product = products[productIndex];
  if (!product) return null;

  const colorway = product.colorways[colorIndex] ?? product.colorways[0];
  const stockOf = (candidate: string) => stockFor(product, candidate, colorway.id);
  const soldOut = product.sizes.every((candidate) => stockOf(candidate) <= 0);

  const choose = (index: number) => {
    setProductIndex(index);
    // A size and a colour belong to the garment that was on screen when they
    // were picked. Carrying "L" over to a cap would be a silent wrong answer.
    setColorIndex(0);
    setSize(null);
    setError(false);
  };

  const submit = () => {
    if (!size || stockOf(size) <= 0) {
      setError(true);
      return;
    }
    setError(false);
    add({
      slug: product.slug,
      productId: product.id,
      ref: product.ref,
      name: product.name,
      size,
      qty: 1,
      price: product.price,
      shape: product.shape,
      print: product.print,
      colorway,
      artwork,
    });
  };

  return (
    <section className="border border-line bg-white p-5 lg:p-6">
      <p className="eyebrow mb-1 text-ink-soft">{t.gallery.tee.eyebrow}</p>
      <h2 className="text-2xl">{t.gallery.tee.title}</h2>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-mute">{t.gallery.tee.blurb}</p>

      <div className="mt-5 grid gap-5 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:gap-6">
        {/* The mock-up. The drawing is printed by `ProductArt` itself, at the
            same chest anchor the shop's own prints use. */}
        <div className="mx-auto w-full max-w-[14rem] bg-shell">
          <ProductArt
            shape={product.shape}
            colorway={colorway}
            print="none"
            artworkUrl={artwork.imageUrl}
          />
        </div>

        <div className="space-y-5">
          {products.length > 1 && (
            <div>
              <p className="eyebrow mb-2 text-mute">{t.gallery.tee.garment}</p>
              <ul className="flex flex-wrap gap-2">
                {products.map((candidate, index) => (
                  <li key={candidate.id}>
                    <button
                      type="button"
                      onClick={() => choose(index)}
                      aria-pressed={index === productIndex}
                      className={cn(
                        "border-2 px-3 py-2 text-[0.8125rem] font-semibold transition-colors",
                        index === productIndex
                          ? "border-ink bg-ink text-white"
                          : "border-line hover:border-ink",
                      )}
                    >
                      {candidate.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="eyebrow mb-2 text-mute">
              {t.common.color}
              <span className="ml-2 normal-case tracking-normal text-ink">{colorway.name}</span>
            </p>
            {/* One colourway is the answer, not a question — show the swatch
                without making it look pickable. */}
            {product.colorways.length > 1 ? (
              <ul className="flex flex-wrap gap-2">
                {product.colorways.map((option, index) => (
                  <li key={option.id}>
                    <button
                      type="button"
                      onClick={() => setColorIndex(index)}
                      aria-label={option.name}
                      aria-pressed={index === colorIndex}
                      className={cn(
                        "block border-2 p-0.5",
                        index === colorIndex ? "border-ink" : "border-transparent",
                      )}
                    >
                      <Swatch base={option.base} trim={option.trim} className="size-7" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <Swatch base={colorway.base} trim={colorway.trim} className="size-7" />
            )}
          </div>

          <div>
            <p className="eyebrow mb-2 text-mute">{t.cart.size}</p>
            <ul className="flex flex-wrap gap-2">
              {product.sizes.map((option) => {
                const available = stockOf(option) > 0;
                return (
                  <li key={option}>
                    <button
                      type="button"
                      disabled={!available}
                      onClick={() => {
                        setSize(option);
                        setError(false);
                      }}
                      aria-pressed={size === option}
                      className={cn(
                        "min-w-12 border-2 px-3 py-2 text-[0.875rem] font-semibold transition-colors",
                        size === option ? "border-ink bg-ink text-white" : "border-line",
                        available
                          ? "hover:border-ink"
                          : "cursor-not-allowed border-line-soft text-mute-soft line-through",
                      )}
                    >
                      {option}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-1">
            <span className="font-display text-2xl font-bold">{formatPrice(product.price)}</span>
            <Button type="button" onClick={submit} disabled={soldOut} className="flex-1">
              {soldOut ? t.pdp.soldOut : t.gallery.tee.addToCart}
            </Button>
          </div>

          {error && (
            <p role="alert" className="text-[0.875rem] font-semibold text-flame">
              {t.pdp.selectSize}
            </p>
          )}

          {/*
            Not decoration and not small print. A made-to-order print has no
            right of withdrawal (art. 103.c TRLGDCU), and the law wants that said
            *before* the contract, not in a document nobody opens after paying —
            so it sits next to the button that commits to it, framed like the
            same term in the conditions of sale.
          */}
          <p className="border-l-2 border-rust bg-shell p-3 text-[0.8125rem] font-semibold leading-relaxed text-ink">
            {t.gallery.tee.noReturns}
          </p>

          <p className="text-[0.75rem] leading-relaxed text-mute">{t.gallery.tee.note}</p>
        </div>
      </div>
    </section>
  );
}
