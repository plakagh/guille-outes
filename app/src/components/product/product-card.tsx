"use client";

import Link from "next/link";
import { useState } from "react";
import { useWishlist } from "@/components/account/wishlist-provider";
import { ProductShot } from "@/components/product/product-shot";
import { useI18n } from "@/components/i18n/provider";
import { CameraIcon, HeartIcon } from "@/components/icons";
import { FramedArt } from "@/components/product/framed-art";
import { useCameraProbe, WallView } from "@/components/product/wall-view";
import { Badge, Price, Stars, Swatch } from "@/components/ui/bits";
import {
  frameAspect,
  frameOrientation,
  frameSizeOptions,
  inStock,
  isNew,
  onSale,
  priceRange,
  type Product,
} from "@/lib/catalog";
import { cn, discountPercent } from "@/lib/utils";

export function ProductCard({
  product,
  collectionName,
  className,
}: {
  product: Product;
  /** Passed in by the parent so the card never has to query the catalogue. */
  collectionName?: string;
  className?: string;
}) {
  const { t, href } = useI18n();
  const wishlist = useWishlist();
  const [activeColor, setActiveColor] = useState(0);
  const [wallOpen, setWallOpen] = useState(false);
  const wished = wishlist.has(product.id);

  const colorway = product.colorways[activeColor] ?? product.colorways[0];
  const available = inStock(product);
  const reduced = onSale(product);
  const productHref = href("product", product.slug);
  // Cuadros only: everything else has nothing to hang. Whether a camera exists
  // is settled by CSS rather than here — see `useCameraProbe`.
  const frame = product.framePreview;
  // Nothing is selected on a card, so the smallest format is what the tile draws
  // and what the camera opens on — the same piece either way, and the shopper
  // switches format inside the camera.
  const printSize = frame ? frameSizeOptions(product, frame)[0] : null;
  useCameraProbe();

  return (
    /*
      `text-ink` is stated rather than inherited.

      A card is always drawn on white — §2.1 is explicit that a product tile is
      never `--surface-subtle`, let alone a coloured band — but the *section* it is
      placed in may well be dark, and the title was the one line in here with no
      colour of its own. On the outlet band, which sets `text-white` for its own
      heading, that made every product name white text on a white tile. Asserting
      it here means a card can be dropped into any band without the band having to
      know it is carrying one.
    */
    <article className={cn("group relative flex flex-col text-ink", className)}>
      {/* Art tile */}
      <div className="relative aspect-[3/4] overflow-hidden bg-shell">
        <Link href={productHref} className="block h-full w-full" tabIndex={-1}>
          <div className="h-full w-full transition-transform duration-500 ease-[var(--ease-out-quint)] group-hover:scale-[1.04]">
            {/*
              A cuadro is shown framed here, not as a bare sheet of paper: it is
              what is being sold and how the shopper will judge it, and a grid of
              loose scans reads as a folder of images rather than as art you could
              hang. Same frame, mount and proportions as the product page — the
              first format's, since nothing has been chosen on a card yet.
            */}
            {frame && printSize ? (
              <FramedArt
                finish={frame.finishes[0]}
                mount={frame.mount}
                className="h-full w-full"
              >
                <div style={{ aspectRatio: frameAspect(printSize) }}>
                  <ProductShot
                    product={product}
                    colorway={colorway}
                    print={product.print}
                    bare
                    orientation={frameOrientation(printSize)}
                  />
                </div>
              </FramedArt>
            ) : (
              <ProductShot
                product={product}
                colorway={colorway}
                print={product.print}
                orientation="portrait"
              />
            )}
          </div>
        </Link>

        <div className="pointer-events-none absolute left-0 top-0 flex flex-col items-start gap-1 p-2.5">
          {reduced && product.compareAt !== undefined && (
            <Badge tone="sale">{discountPercent(product.price, product.compareAt)} %</Badge>
          )}
          {isNew(product) && !reduced && <Badge tone="new">{t.card.new}</Badge>}
          {product.exclusive && <Badge tone="limited">{t.card.limited}</Badge>}
          {!available && <Badge tone="soldout">{t.card.soldOut}</Badge>}
        </div>

        <button
          type="button"
          onClick={() => wishlist.toggle(product.id)}
          aria-label={
            wishlist.signedIn
              ? wished
                ? t.card.removeFromWishlist
                : t.card.addToWishlist
              : t.account.signInToSave
          }
          aria-pressed={wished}
          className="absolute right-2 top-2 z-20 grid size-9 place-items-center bg-white/85 text-ink backdrop-blur transition hover:bg-white"
        >
          <HeartIcon className="size-[1.15rem]" filled={wished} />
        </button>

        {/*
          The foot of the tile: colours on hover, and the wall button under them.
          A column rather than two pinned layers, so hiding the button lets the
          swatches fall to the bottom on their own — no offset to keep in step
          with whether the button is there.
        */}
        <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col">
          {product.colorways.length > 1 && (
            <div className="flex items-center gap-1.5 bg-gradient-to-t from-black/10 to-transparent p-2.5 opacity-0 transition-opacity duration-200 focus-within:opacity-100 group-hover:opacity-100">
              {product.colorways.slice(0, 5).map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  onMouseEnter={() => setActiveColor(i)}
                  onFocus={() => setActiveColor(i)}
                  onClick={() => setActiveColor(i)}
                  aria-label={`${t.card.viewIn} ${c.name}`}
                  aria-pressed={i === activeColor}
                  className={cn(
                    "grid size-6 place-items-center bg-white/90 ring-1 ring-inset transition",
                    i === activeColor ? "ring-ink" : "ring-transparent hover:ring-line",
                  )}
                >
                  <Swatch base={c.base} trim={c.trim} className="size-3.5" />
                </button>
              ))}
            </div>
          )}

          {/*
            "En tu pared" — shown without hover, because the phone is where this
            matters and a phone has no hover, and because it is the only reason
            to stop scrolling a grid of prints that look alike at this size.
            `data-wall-cta` is what CSS reveals once a camera is confirmed.
          */}
          {frame && (
            <button
              type="button"
              data-wall-cta
              onClick={() => setWallOpen(true)}
              className="h-9 items-center justify-center gap-1.5 bg-ink/85 font-display text-[0.6875rem] font-bold uppercase tracking-wide text-white backdrop-blur transition hover:bg-black"
            >
              <CameraIcon className="size-4" />
              {t.wall.ctaShort}
            </button>
          )}
        </div>
      </div>

      {/* Copy */}
      <div className="flex flex-1 flex-col gap-1.5 pt-3">
        {collectionName && <p className="eyebrow text-mute">{collectionName}</p>}

        <h3 className="font-sans text-[0.9375rem] font-semibold normal-case leading-snug tracking-normal">
          <Link href={productHref} className="hover:underline">
            {/* Full-tile hit area without nesting interactive elements */}
            <span className="absolute inset-0 z-10" aria-hidden="true" />
            {product.name}
          </Link>
        </h3>

        {product.reviews > 0 && (
          <Stars rating={product.rating} reviews={product.reviews} label={t.pdp.outOf5} />
        )}

        <Price
          price={product.price}
          compareAt={product.compareAt}
          className="mt-auto pt-1"
          fromLabel={priceRange(product).to > product.price ? t.common.from : undefined}
        />

        <p className="text-[0.75rem] text-mute">
          {product.colorways.length === 1
            ? colorway.name
            : `${product.colorways.length} ${t.common.colors}`}
        </p>

        {product.credits.length > 0 && (
          <p className="truncate text-[0.75rem] text-mute-soft">
            {product.credits.map((credit) => credit.name).join(" · ")}
          </p>
        )}
      </div>

      {frame && wallOpen && (
        <WallView
          product={product}
          frame={frame}
          initialFinish={frame.finishes[0]}
          initialColorway={colorway}
          initialSize={printSize?.size ?? null}
          onClose={() => setWallOpen(false)}
        />
      )}
    </article>
  );
}
