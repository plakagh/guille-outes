"use client";

import Link from "next/link";
import { useState } from "react";
import { useWishlist } from "@/components/account/wishlist-provider";
import { ProductShot, photosFor } from "@/components/product/product-shot";
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
  formatFrameSize,
  frameAspect,
  frameOrientation,
  frameSizeFor,
  frameSurcharge,
  isNew,
  onSale,
  resolveSizeGuide,
  stockFor,
  unitPriceFor,
  type FrameChoice,
  type FrameFinish,
  type Product,
} from "@/lib/catalog";
import { mediaUrl } from "@/lib/supabase/env";
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
  /*
    What the shopper is buying, which is no longer the same question as what they
    are looking at. A cuadro is sold as paper and the frame is an extra, so "sin
    marco" is a real choice with a real price — and `framed` above only decides
    whether the gallery draws the moulding.
  */
  const [frameChoice, setFrameChoice] = useState<FrameChoice | null>(null);
  // The camera view is mounted only once asked for: it holds a MediaStream, and
  // unmounting is what guarantees the camera is released.
  const [wallOpen, setWallOpen] = useState(false);
  // This product's own measurements, or the baseline for its garment shape.
  const sizeGuide = resolveSizeGuide(product);
  const frame = product.framePreview;
  // The camera call to action is in the markup either way; CSS decides whether a
  // device that has no camera ever sees it.
  useCameraProbe();
  /*
    The frame as chosen, defaulting to the first finish the piece offers: a cuadro
    opens framed, so the price and the picture must agree with that from the first
    render. Null for anything not sold framed, which is how the line reaches the
    basket without a frame field at all.
  */
  const choice: FrameChoice | null = frame ? (frameChoice ?? frame.finishes[0]) : null;
  // What the preview paints. "Sin marco" still has a colour to fall back on,
  // because the framed *view* stays available as a preview after choosing it.
  const activeFinish: FrameFinish =
    choice && choice !== "none" ? choice : (frame?.finishes[0] ?? "black");
  const surcharge = frameSurcharge(frame, choice);
  const [size, setSize] = useState<string | null>(
    product.sizes.length === 1 ? product.sizes[0] : null,
  );
  const [qty, setQty] = useState(1);
  /*
    What the chosen format is printed at. A cuadro is sold in more than one, and
    they are not the same shape — so the framed view and the camera both follow
    the size button rather than one measurement standing in for the listing.
    Before a size is picked it is the product's default.
  */
  const printSize = frame ? frameSizeFor(frame, size) : null;
  // Which way up the piece hangs, read off its measurements. Nothing else has an
  // orientation, so anything that is not a cuadro stays portrait.
  const orientation = printSize ? frameOrientation(printSize) : "portrait";
  const [error, setError] = useState(false);

  const wished = wishlist.has(product.id);

  const colorway = product.colorways[colorIndex] ?? product.colorways[0];

  /*
    The gallery is the photographs when there are any, and four views synthesised
    from the flat garment drawing when there are not.

    The synthesised views — a zoomed detail, the print swapped out — only make
    sense for a drawing, which can be re-rendered any way we like. A photograph
    is a photograph: there is no "monogram" version of it, so each one is simply
    its own view.
  */
  const photos = photosFor(product, colorway?.id);

  const views = photos.length
    ? photos.map((photo, i) => ({
        id: photo.id,
        label: `${product.name} — ${i + 1}`,
        print: null,
        zoom: 1,
        photo,
      }))
    : [
        { id: "front", label: t.pdp.viewFront, print: null, zoom: 1, photo: null },
        { id: "detail", label: t.pdp.viewDetail, print: null, zoom: 2.1, photo: null },
        { id: "monogram", label: t.pdp.viewMonogram, print: "monogram" as const, zoom: 1, photo: null },
        { id: "plain", label: t.pdp.viewPlain, print: "none" as const, zoom: 1, photo: null },
      ];

  const reduced = onSale(product);
  // Switching colour can change how many photographs there are, so an index left
  // over from the previous colour must not fall off the end.
  const activeView = views[view] ?? views[0];

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
      // The size decides the price once a variant can carry a surcharge, and the
      // frame adds to it. The server re-prices from the catalogue anyway; this is
      // what the cart shows.
      price: unitPriceFor(product, size, choice),
      // Undefined rather than "none" for a product that is not sold framed: the
      // line has no frame to speak of, which is not the same as an unframed one.
      frameFinish: choice ?? undefined,
      // The measurements travel with the choice so the basket can hang the piece
      // exactly as this page does — the chosen format, not the default one.
      frame: frame && printSize ? { mount: frame.mount, print: printSize } : undefined,
      imageUrl: activeView.photo ? mediaUrl(activeView.photo.path) : undefined,
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
        {/* One photograph is not a gallery — the strip would just repeat it. */}
        <ul
          className={cn("flex gap-3 sm:flex-col", views.length < 2 && "hidden")}
          aria-label={t.pdp.views}
        >
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
                  <ProductShot
                    product={product}
                    colorway={colorway}
                    print={item.print ?? product.print}
                    orientation={orientation}
                    photo={item.photo}
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

          {frame && printSize && framed ? (
            <FramedArt finish={activeFinish} mount={frame.mount} className="aspect-[5/6]">
              {/* The art alone, at its own proportions: the mount supplies the
                  white and the bevel supplies the edge. */}
              <div style={{ aspectRatio: frameAspect(printSize) }}>
                <ProductShot
                  product={product}
                  colorway={colorway}
                  print={activeView.print ?? product.print}
                  bare
                  orientation={orientation}
                  photo={activeView.photo}
                />
              </div>
            </FramedArt>
          ) : (
            <div
              className="aspect-[5/6] transition-transform duration-500 ease-[var(--ease-out-quint)]"
              style={{ transform: `scale(${activeView.zoom})` }}
            >
              <ProductShot
                product={product}
                colorway={colorway}
                print={activeView.print ?? product.print}
                orientation={orientation}
                photo={activeView.photo}
              />
            </div>
          )}
        </div>

      </div>

        {/*
          Framing sits under the image rather than in the buybox, where the piece
          it applies to is. It is a buying decision now, not a way of looking:
          picking an acabado orders the frame and adds what it costs, and "sin
          marco" orders the paper on its own.

          The eye button beside it is the leftover *view* toggle, for coming back
          to the framed picture after a thumbnail dropped out of it.
        */}
        {frame && choice && (
          <div className="space-y-3 border border-line p-3">
            <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <legend className="sr-only">{t.pdp.frameFinish}</legend>
              <span className="eyebrow text-mute">{t.pdp.frameChoice}</span>

              <ul className="flex flex-wrap items-center gap-2">
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setFrameChoice("none");
                      // Buying the paper: show the paper.
                      setFramed(false);
                    }}
                    aria-pressed={choice === "none"}
                    className={cn(
                      "inline-flex h-10 items-center border px-3 text-[0.8125rem] font-semibold transition",
                      choice === "none" ? "border-ink bg-ink text-white" : "border-line hover:border-ink",
                    )}
                  >
                    {t.pdp.frameNone}
                  </button>
                </li>
                {frame.finishes.map((option) => (
                  <li key={option}>
                    <button
                      type="button"
                      onClick={() => {
                        setFrameChoice(option);
                        setFramed(true);
                      }}
                      aria-pressed={option === choice}
                      aria-label={t.pdp.frameFinishes[option]}
                      title={t.pdp.frameFinishes[option]}
                      className={cn(
                        "grid size-10 place-items-center border-2 transition",
                        option === choice ? "border-ink" : "border-transparent hover:border-line",
                      )}
                    >
                      <FrameSwatch finish={option} />
                    </button>
                  </li>
                ))}
              </ul>

              {/* What the frame adds, said where it is chosen rather than only in
                  the total: the price above already includes it. */}
              {frame.surcharge > 0 && (
                <span className="text-[0.8125rem] font-semibold">
                  {choice === "none"
                    ? t.pdp.framePlus.replace("{{amount}}", formatPrice(frame.surcharge))
                    : t.pdp.frameIncluded.replace("{{amount}}", formatPrice(frame.surcharge))}
                </span>
              )}

              <button
                type="button"
                onClick={() => setFramed((current) => !current)}
                aria-pressed={framed}
                className={cn(
                  "ms-auto inline-flex h-10 items-center gap-2 border px-3 text-[0.8125rem] font-semibold transition",
                  framed ? "border-ink" : "border-line hover:border-ink",
                )}
              >
                <FrameIcon className="size-4" />
                {framed ? t.pdp.frameHide : t.pdp.frameShow}
              </button>
            </fieldset>

            <p className="text-[0.75rem] text-mute">
              {choice === "none" ? t.pdp.frameNoteUnframed : t.pdp.frameNote}
            </p>
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
          {/* The frame is inside the figure, and so is the old price it is
              compared against — otherwise choosing an acabado would look like a
              deeper discount than it is. */}
          <Price
            price={unitPriceFor(product, size, choice)}
            compareAt={product.compareAt === undefined ? undefined : product.compareAt + surcharge}
            size="lg"
          />
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
                    {/* For a cuadro the format name means nothing on its own:
                        "Grande" is not a size, 50 × 70 cm is. The button says
                        both, and it is the same number the camera hangs. */}
                    {frame && (
                      <span className="text-[0.625rem] font-normal tabular-nums opacity-70">
                        {formatFrameSize(frameSizeFor(frame, option))}
                      </span>
                    )}
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
          // …and at the format they have chosen, if they have chosen one.
          initialSize={size}
          // A finish tried against a real wall is a finish chosen: it comes back
          // here so the basket gets the one they settled on.
          onFinish={(picked) => {
            setFrameChoice(picked);
            setFramed(true);
          }}
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
