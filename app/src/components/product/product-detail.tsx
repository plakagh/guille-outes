"use client";

import Link from "next/link";
import { useState } from "react";
import { useWishlist } from "@/components/account/wishlist-provider";
import { ProductArt } from "@/components/brand/product-art";
import { useCart } from "@/components/cart/cart-context";
import { useI18n } from "@/components/i18n/provider";
import {
  ArrowRight,
  BagIcon,
  CameraIcon,
  FrameIcon,
  CheckIcon,
  HeartIcon,
  MinusIcon,
  PlusIcon,
  ReturnIcon,
  ShieldIcon,
  TruckIcon,
} from "@/components/icons";
import { Badge, Price, Stars, Swatch } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { FramedArt, FrameSwatch } from "@/components/product/framed-art";
import { ProductVideo } from "@/components/product/product-video";
import { SizeGuideDialog } from "@/components/product/size-guide";
import { useCameraProbe, WallView } from "@/components/product/wall-view";
import {
  frameAspect,
  frameOrientation,
  isNew,
  onSale,
  resolveSizeGuide,
  stockFor,
  type FrameFinish,
  type Product,
} from "@/lib/catalog";
import { cn, discountPercent, formatPrice } from "@/lib/utils";

/** Below this many units we nudge the shopper. */
const LOW_STOCK = 5;

export function ProductDetail({
  product,
  collection,
  sizeGuideHref,
}: {
  product: Product;
  collection?: { name: string; slug: string };
  sizeGuideHref: string;
}) {
  const { t, href } = useI18n();
  const { add } = useCart();
  const wishlist = useWishlist();

  const [colorIndex, setColorIndex] = useState(0);
  const [view, setView] = useState(0);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  // Framing: cuadros open framed. It is how the piece is meant to be seen and
  // how the shopper will judge it, so it should not take a click to get there.
  // Picking a thumbnail drops back out of it — see the gallery below.
  const [framed, setFramed] = useState(true);
  const [finish, setFinish] = useState<FrameFinish | null>(null);
  // The camera view is mounted only once asked for: it holds a MediaStream, and
  // unmounting is what guarantees the camera is released.
  const [wallOpen, setWallOpen] = useState(false);
  // This product's own measurements, or the baseline for its garment shape.
  const sizeGuide = resolveSizeGuide(product);
  const frame = product.framePreview;
  // The camera call to action is in the markup either way; CSS decides whether a
  // device that has no camera ever sees it.
  useCameraProbe();
  const activeFinish = finish ?? frame?.finishes[0] ?? "black";
  // Which way up the piece hangs, read off its measurements. Nothing else has an
  // orientation, so anything that is not a cuadro stays portrait.
  const orientation = frame ? frameOrientation(frame) : "portrait";
  const [size, setSize] = useState<string | null>(
    product.sizes.length === 1 ? product.sizes[0] : null,
  );
  const [qty, setQty] = useState(1);
  const [error, setError] = useState(false);

  const wished = wishlist.has(product.id);

  /** Four gallery views synthesised from one flat garment drawing. */
  const views = [
    { id: "front", label: t.pdp.viewFront, print: null, zoom: 1 },
    { id: "detail", label: t.pdp.viewDetail, print: null, zoom: 2.1 },
    { id: "monogram", label: t.pdp.viewMonogram, print: "monogram" as const, zoom: 1 },
    { id: "plain", label: t.pdp.viewPlain, print: "none" as const, zoom: 1 },
  ];

  const colorway = product.colorways[colorIndex] ?? product.colorways[0];
  const reduced = onSale(product);
  const activeView = views[view];

  // Availability is per size × colour, so switching colour can change what is
  // buyable — exactly how the stock table is keyed.
  const stockOf = (candidate: string) => stockFor(product, candidate, colorway.id);
  const soldOut = product.sizes.every((candidate) => stockOf(candidate) <= 0);
  const selectedStock = size ? stockOf(size) : 0;

  const submit = () => {
    if (!size || selectedStock <= 0) {
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
      qty,
      price: product.price,
      shape: product.shape,
      print: product.print,
      colorway,
    });
  };

  return (
    <div className="shell grid gap-8 py-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-12 lg:py-10">
      {/* ------------------------------------------------------- gallery */}
      <div className="flex flex-col gap-4">
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:gap-4">
        <ul className="flex gap-3 sm:flex-col" aria-label={t.pdp.views}>
          {views.map((item, i) => (
            <li key={item.id}>
              <button
                type="button"
                // A thumbnail is a picture of the *unframed* rendering, so it
                // gives you exactly that: choosing one leaves the framed view
                // rather than quietly ignoring the choice behind the glass.
                onClick={() => {
                  setView(i);
                  setFramed(false);
                }}
                aria-label={item.label}
                aria-current={i === view && !framed}
                className={cn(
                  "block size-16 overflow-hidden bg-shell ring-1 ring-inset transition sm:size-20",
                  i === view && !framed ? "ring-ink" : "ring-transparent hover:ring-line",
                )}
              >
                <span className="block h-full w-full" style={{ transform: `scale(${item.zoom})` }}>
                  <ProductArt
                    shape={product.shape}
                    colorway={colorway}
                    print={item.print ?? product.print}
                    orientation={orientation}
                  />
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="relative flex-1 overflow-hidden bg-shell">
          <div className="pointer-events-none absolute left-0 top-0 z-10 flex flex-col items-start gap-1 p-3">
            {reduced && product.compareAt !== undefined && (
              <Badge tone="sale">{discountPercent(product.price, product.compareAt)} %</Badge>
            )}
            {isNew(product) && <Badge tone="new">{t.card.new}</Badge>}
            {product.exclusive && <Badge tone="limited">{t.card.limited}</Badge>}
          </div>

          {frame && framed ? (
            <FramedArt finish={activeFinish} mount={frame.mount} className="aspect-[5/6]">
              {/* The art alone, at its own proportions: the mount supplies the
                  white and the bevel supplies the edge. */}
              <div style={{ aspectRatio: frameAspect(frame) }}>
                <ProductArt
                  shape={product.shape}
                  colorway={colorway}
                  print={activeView.print ?? product.print}
                  bare
                  orientation={orientation}
                />
              </div>
            </FramedArt>
          ) : (
            <div
              className="aspect-[5/6] transition-transform duration-500 ease-[var(--ease-out-quint)]"
              style={{ transform: `scale(${activeView.zoom})` }}
            >
              <ProductArt
                shape={product.shape}
                colorway={colorway}
                print={activeView.print ?? product.print}
                orientation={orientation}
              />
            </div>
          )}
        </div>

      </div>

        {/*
          Framing controls sit under the image rather than in the buybox: they
          change what you are looking at, not what you are buying. Nothing about
          the frame is added to the cart.
        */}
        {frame && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border border-line p-3">
            <button
              type="button"
              onClick={() => setFramed((current) => !current)}
              aria-pressed={framed}
              className={cn(
                "inline-flex h-10 items-center gap-2 border px-4 font-display text-[0.8125rem] font-bold uppercase tracking-wide transition",
                framed ? "border-ink bg-ink text-white" : "border-line hover:border-ink",
              )}
            >
              <FrameIcon className="size-4" />
              {framed ? t.pdp.frameHide : t.pdp.frameShow}
            </button>

            {framed && frame.finishes.length > 1 && (
              <fieldset className="flex items-center gap-3">
                <legend className="sr-only">{t.pdp.frameFinish}</legend>
                <span className="eyebrow text-mute">{t.pdp.frameFinish}</span>
                <ul className="flex gap-2">
                  {frame.finishes.map((option) => (
                    <li key={option}>
                      <button
                        type="button"
                        onClick={() => setFinish(option)}
                        aria-pressed={option === activeFinish}
                        aria-label={t.pdp.frameFinishes[option]}
                        title={t.pdp.frameFinishes[option]}
                        className={cn(
                          "grid size-10 place-items-center border-2 transition",
                          option === activeFinish
                            ? "border-ink"
                            : "border-transparent hover:border-line",
                        )}
                      >
                        <FrameSwatch finish={option} />
                      </button>
                    </li>
                  ))}
                </ul>
              </fieldset>
            )}

            <p className="text-[0.75rem] text-mute">{t.pdp.frameNote}</p>
          </div>
        )}

        {/*
          The camera. Full width and under the framing controls, because it
          answers the question the shopper asks *after* deciding they like it:
          not "what does it look like" but "does it fit that wall".
        */}
        {frame && (
          <Button
            variant="outline"
            size="lg"
            block
            data-wall-cta
            onClick={() => setWallOpen(true)}
          >
            <CameraIcon className="size-5" />
            {t.wall.cta}
          </Button>
        )}

        {/*
          The video, for the products that have one — which is most of them not.
          Under the gallery because that is what it is: another way of looking at
          the piece, not another thing to decide about before buying it.
        */}
        {product.video && (
          <div>
            <h2 className="eyebrow mb-2 text-mute">{t.pdp.videoHeading}</h2>
            <ProductVideo video={product.video} t={t} productName={product.name} />
          </div>
        )}
      </div>

      {/* -------------------------------------------------------- buybox */}
      <div className="lg:sticky lg:top-[calc(var(--spacing-masthead)+var(--spacing-navbar)+1.5rem)] lg:self-start">
        {collection && (
          <Link
            href={href("collection", collection.slug)}
            className="eyebrow text-flame hover:underline"
          >
            {collection.name}
          </Link>
        )}

        <h1 className="mt-2 text-[clamp(1.75rem,4vw,2.75rem)] leading-[0.95]">{product.name}</h1>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Stars rating={product.rating} reviews={product.reviews} label={t.pdp.outOf5} />
          <span className="text-[0.75rem] text-mute">
            {t.pdp.ref} {product.ref}
          </span>
        </div>

        <div className="mt-4">
          <Price price={product.price} compareAt={product.compareAt} size="lg" />
          <p className="mt-1 text-[0.75rem] text-mute">{t.pdp.shippingAtCheckout}</p>
        </div>

        <p className="mt-5 text-[0.9375rem] leading-relaxed text-ink/75">{product.description}</p>

        {/* Credits — links through to each author's bibliography */}
        {product.credits.length > 0 && (
          <div className="mt-5 border-l-2 border-flame pl-4">
            <p className="eyebrow mb-2 text-mute">{t.pdp.creditsHeading}</p>
            <ul className="space-y-1">
              {product.credits.map((credit) => (
                <li key={credit.authorId} className="text-[0.875rem]">
                  <Link
                    href={href("authors", credit.slug)}
                    className="font-semibold hover:text-flame hover:underline"
                  >
                    {credit.name}
                  </Link>
                  {credit.role && <span className="text-mute"> — {credit.role}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Colour */}
        <fieldset className="mt-6">
          <legend className="eyebrow mb-2.5">
            {t.common.color}:{" "}
            <span className="font-normal normal-case tracking-normal">{colorway.name}</span>
          </legend>
          <ul className="flex flex-wrap gap-2">
            {product.colorways.map((option, i) => (
              <li key={option.id}>
                <button
                  type="button"
                  onClick={() => setColorIndex(i)}
                  aria-label={option.name}
                  aria-pressed={i === colorIndex}
                  className={cn(
                    "grid size-11 place-items-center border-2 transition",
                    i === colorIndex ? "border-ink" : "border-transparent hover:border-line",
                  )}
                >
                  <Swatch base={option.base} trim={option.trim} className="size-7" />
                </button>
              </li>
            ))}
          </ul>
        </fieldset>

        {/* Size */}
        <fieldset className="mt-6">
          <legend className="mb-2.5 flex w-full items-center justify-between gap-4">
            <span className="eyebrow">{t.plp.size}</span>
            {sizeGuide ? (
              <button
                type="button"
                onClick={() => setSizeGuideOpen(true)}
                className="text-[0.75rem] text-mute underline hover:text-ink"
              >
                {t.pdp.sizeGuide}
              </button>
            ) : (
              <Link href={sizeGuideHref} className="text-[0.75rem] text-mute underline hover:text-ink">
                {t.pdp.sizeGuide}
              </Link>
            )}
          </legend>
          <ul className="flex flex-wrap gap-2">
            {product.sizes.map((option) => {
              const units = stockOf(option);
              const unavailable = units <= 0;
              const active = size === option;
              return (
                <li key={option}>
                  <button
                    type="button"
                    disabled={unavailable}
                    onClick={() => {
                      setSize(option);
                      setQty(1);
                      setError(false);
                    }}
                    aria-pressed={active}
                    className={cn(
                      "relative grid h-12 min-w-14 place-items-center border px-3 text-[0.875rem] font-semibold transition",
                      active ? "border-ink bg-ink text-white" : "border-line hover:border-ink",
                      unavailable &&
                        "cursor-not-allowed border-line-soft text-mute-soft hover:border-line-soft",
                    )}
                  >
                    {option}
                    {unavailable && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-1 top-1/2 h-px -rotate-[24deg] bg-mute-soft"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {error && (
            <p role="alert" className="mt-2 text-[0.8125rem] font-semibold text-flame">
              {t.pdp.selectSize}
            </p>
          )}
          {size && selectedStock > 0 && selectedStock <= LOW_STOCK && (
            <p className="mt-2 text-[0.8125rem] font-semibold text-flame">
              {t.pdp.lowStock}: {t.pdp.unitsLeft} {selectedStock}
            </p>
          )}
        </fieldset>

        {/* Quantity + add */}
        <div className="mt-6 flex gap-3">
          <div className="flex h-14 items-center border border-line">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              aria-label={t.pdp.decreaseQty}
              className="grid size-12 place-items-center hover:bg-shell"
            >
              <MinusIcon className="size-4" />
            </button>
            <span className="w-8 text-center text-[0.9375rem] font-semibold">{qty}</span>
            <button
              type="button"
              onClick={() =>
                setQty((q) => Math.min(10, Math.max(1, selectedStock || 10), q + 1))
              }
              aria-label={t.pdp.increaseQty}
              className="grid size-12 place-items-center hover:bg-shell"
            >
              <PlusIcon className="size-4" />
            </button>
          </div>

          <Button size="lg" onClick={submit} disabled={soldOut} className="flex-1">
            <BagIcon className="size-5" />
            {soldOut ? t.pdp.soldOut : t.pdp.addToCart}
          </Button>

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
            className="grid size-14 shrink-0 place-items-center border-2 border-ink transition hover:bg-ink hover:text-white"
          >
            <HeartIcon className="size-5" filled={wished} />
          </button>
        </div>

        {/* Service promises */}
        <ul className="mt-6 space-y-2.5 border-y border-line py-5 text-[0.875rem]">
          <li className="flex items-start gap-2.5">
            <TruckIcon className="mt-0.5 size-5 shrink-0" />
            <span>
              <span className="font-semibold">{t.pdp.promiseShippingTitle}</span> —{" "}
              {t.pdp.promiseShippingBody}
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <ReturnIcon className="mt-0.5 size-5 shrink-0" />
            <span>
              <span className="font-semibold">{t.pdp.promiseReturnsTitle}</span> —{" "}
              {t.pdp.promiseReturnsBody}
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <ShieldIcon className="mt-0.5 size-5 shrink-0" />
            <span>
              <span className="font-semibold">{t.pdp.promisePaymentTitle}</span> —{" "}
              {t.pdp.promisePaymentBody}
            </span>
          </li>
        </ul>

        {/* Detail accordions */}
        <div className="mt-2 divide-y divide-line">
          <Accordion heading={t.pdp.detailsHeading} defaultOpen>
            <ul className="space-y-1.5">
              {product.details.map((detail) => (
                <li key={detail} className="flex items-start gap-2">
                  <CheckIcon className="mt-0.5 size-4 shrink-0 text-pine" />
                  {detail}
                </li>
              ))}
            </ul>
          </Accordion>

          <Accordion heading={t.pdp.shippingHeading}>
            <p>{t.pdp.shippingBody}</p>
            <p className="mt-2">
              {t.cart.shipping}: {formatPrice(495)} · {formatPrice(6000)}+ {t.cart.free}
            </p>
          </Accordion>

          <Accordion heading={t.pdp.returnsHeading}>
            <p>{t.pdp.returnsBody}</p>
          </Accordion>

          {product.keywords.length > 0 && (
            <Accordion heading={t.admin.keywords}>
              <ul className="flex flex-wrap gap-2">
                {product.keywords.map((keyword) => (
                  <li key={keyword}>
                    <Link
                      href={`${href("search")}?q=${encodeURIComponent(keyword)}`}
                      className="inline-flex items-center gap-1 border border-line px-2.5 py-1 text-[0.8125rem] transition hover:border-ink"
                    >
                      {keyword}
                      <ArrowRight className="size-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Accordion>
          )}
        </div>
      </div>

      {sizeGuide && (
        <SizeGuideDialog
          product={product}
          helpHref={sizeGuideHref}
          open={sizeGuideOpen}
          onClose={() => setSizeGuideOpen(false)}
        />
      )}

      {frame && wallOpen && (
        <WallView
          product={product}
          frame={frame}
          // The camera opens on whatever the shopper is already looking at.
          initialFinish={activeFinish}
          initialColorway={colorway}
          onClose={() => setWallOpen(false)}
        />
      )}
    </div>
  );
}

function Accordion({
  heading,
  defaultOpen,
  children,
}: {
  heading: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-display text-[1.0625rem] font-bold uppercase tracking-wide">
        {heading}
        <PlusIcon className="size-4 shrink-0 transition-transform duration-200 group-open:rotate-45" />
      </summary>
      <div className="pt-3 text-[0.875rem] leading-relaxed text-ink/75">{children}</div>
    </details>
  );
}
