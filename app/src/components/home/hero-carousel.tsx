"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ProductArt,
  type ArtOrientation,
  type ArtPrint,
  type ArtShape,
  type Colorway,
} from "@/components/brand/product-art";
import { useI18n } from "@/components/i18n/provider";
import { ArrowRight, ChevronLeft, ChevronRight } from "@/components/icons";
import { FramedArt } from "@/components/product/framed-art";
import type { FrameFinish } from "@/lib/catalog";
import { cn } from "@/lib/utils";

export type HeroSlide = {
  eyebrow: string;
  headline: [string, string];
  blurb: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
  /** Oversized outlined word sitting behind the product art. */
  ghost: string;
  background: string;
  ink: "light" | "dark";
  art: { shape: ArtShape; colorway: Colorway; print: ArtPrint };
  /**
   * A photograph of the piece the slide is about. The drawn `art` is the
   * fallback for a slide whose product has never been photographed.
   */
  imageUrl?: string;
  imageAlt?: string;
  /**
   * Framing, when the piece the slide leads with is a cuadro.
   *
   * A cuadro is bought framed and hung on a wall, so a bare scan of the paper
   * undersells it — and on a slide the size of the fold it is the difference
   * between a photograph of some art and something you can picture in a room. A
   * garment has nothing to hang, so it has no frame here.
   *
   * The finish, the mount and the proportions come from the product itself, which
   * is what keeps this frame the same object the product page shows.
   */
  frame?: {
    finish: FrameFinish;
    /** Mount width, as a percentage of the frame. */
    mount: number;
    /** The printed artwork's proportions, as a CSS `aspect-ratio`. */
    aspect: string;
    orientation: ArtOrientation;
  };
};

const AUTOPLAY_MS = 6500;

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const go = useCallback(
    (next: number) => setIndex(((next % slides.length) + slides.length) % slides.length),
    [slides.length],
  );

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [paused, slides.length]);

  // Every slide is built from something the shop actually has, so an empty list
  // is a real state — a catalogue with no collections and nothing on sale — and
  // not a bug. Render nothing rather than reading `ink` off undefined.
  const slide = slides[index] ?? slides[0];
  if (!slide) return null;

  const light = slide.ink === "light";

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t.home.heroCarousel}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="relative overflow-hidden"
      style={{ backgroundColor: slide.background }}
    >
      {/* Own artwork: diagonal court hatching keyed to the slide colour */}
      <DiagonalField light={light} />

      <div
        className={cn(
          "shell relative grid items-center gap-6 py-12 lg:grid-cols-[1.05fr_1fr] lg:py-20",
          light ? "text-white" : "text-ink",
        )}
      >
        <div key={index} className="animate-[fade-up_500ms_var(--ease-out-quint)]">
          <p className={cn("eyebrow mb-4", light ? "text-white/70" : "text-flame")}>
            {slide.eyebrow}
          </p>
          <h1 className="text-[clamp(2.75rem,8vw,6rem)] leading-[0.86]">
            {slide.headline[0]}
            <br />
            <span className={light ? "text-flame" : "text-flame"}>{slide.headline[1]}</span>
          </h1>
          <p
            className={cn(
              "mt-5 max-w-md text-[0.9375rem] leading-relaxed",
              light ? "text-white/75" : "text-ink/70",
            )}
          >
            {slide.blurb}
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href={slide.primary.href}
              className={cn(
                "inline-flex h-14 items-center gap-2 px-8 font-display text-base font-bold uppercase tracking-wide transition-colors",
                light ? "bg-white text-ink hover:bg-flame hover:text-white" : "bg-ink text-white hover:bg-flame",
              )}
            >
              {slide.primary.label}
              <ArrowRight className="size-4" />
            </Link>
            {slide.secondary?.label && (
              <Link
                href={slide.secondary.href}
                className={cn(
                  "inline-flex h-14 items-center px-8 font-display text-base font-bold uppercase tracking-wide transition-colors",
                  light
                    ? "border-2 border-white/60 hover:border-white hover:bg-white hover:text-ink"
                    : "border-2 border-ink hover:bg-ink hover:text-white",
                )}
              >
                {slide.secondary.label}
              </Link>
            )}
          </div>
        </div>

        {/* Art panel */}
        <div className="relative flex min-h-[19rem] items-center justify-center lg:min-h-[32rem]">
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 select-none text-center font-display text-[clamp(6rem,20vw,15rem)] font-bold uppercase leading-none",
              light ? "text-white/10" : "text-ink/[0.07]",
            )}
          >
            {slide.ghost}
          </span>
          {/* The piece is what the slide is selling, so it takes most of the panel:
              the ghost word behind it is a backdrop, not a competing element. */}
          <div
            key={`art-${index}`}
            className="relative w-[82%] max-w-md animate-[fade-up_650ms_var(--ease-out-quint)] lg:max-w-lg"
          >
            <SlideArt slide={slide} />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="shell relative flex items-center justify-between pb-6 lg:pb-8">
        <ol className="flex items-center gap-2" aria-label={t.home.heroCarousel}>
          {slides.map((item, i) => (
            <li key={item.headline.join("-")}>
              <button
                type="button"
                onClick={() => go(i)}
                aria-label={`${t.home.heroSlide} ${i + 1}: ${item.headline.join(" ")}`}
                aria-current={i === index}
                className={cn(
                  "h-1 transition-all duration-300",
                  i === index ? "w-10" : "w-5 opacity-40 hover:opacity-70",
                  light ? "bg-white" : "bg-ink",
                )}
              />
            </li>
          ))}
        </ol>

        <div className="hidden gap-2 md:flex">
          {[
            { dir: -1 as const, Icon: ChevronLeft, label: t.common.previous },
            { dir: 1 as const, Icon: ChevronRight, label: t.common.next },
          ].map(({ dir, Icon, label }) => (
            <button
              key={label}
              type="button"
              onClick={() => go(index + dir)}
              aria-label={label}
              className={cn(
                "grid size-11 place-items-center border transition",
                light
                  ? "border-white/40 text-white hover:bg-white hover:text-ink"
                  : "border-ink/30 text-ink hover:bg-ink hover:text-white",
              )}
            >
              <Icon className="size-5" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * The piece the slide leads with: a photograph if there is one, the drawn artwork
 * otherwise — and inside a frame when it is a cuadro.
 *
 * `onWall` is off: the frame hangs over the slide's own colour and hatching, and
 * the painted grey wall that component draws for a product tile would read as a
 * grey box pasted onto the hero. The drop shadow is what makes it hang.
 *
 * The artwork fills the aperture (`object-cover`), exactly as on the product
 * page: the mount is cut to a printed format, and a scan that misses it by a
 * millimetre should lose that millimetre rather than show a white band.
 */
function SlideArt({ slide }: { slide: HeroSlide }) {
  const art = slide.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={slide.imageUrl}
      alt={slide.imageAlt ?? ""}
      className={cn("h-full w-full", slide.frame ? "object-cover" : "object-contain")}
    />
  ) : (
    <ProductArt
      shape={slide.art.shape}
      colorway={slide.art.colorway}
      print={slide.art.print}
      // Behind glass the drawing is the print alone: no sheet of paper and no
      // ground shadow, which inside a frame would read as a second mount.
      bare={slide.frame !== undefined}
      orientation={slide.frame?.orientation}
    />
  );

  if (!slide.frame) return art;

  return (
    <FramedArt finish={slide.frame.finish} mount={slide.frame.mount} onWall={false}>
      <div style={{ aspectRatio: slide.frame.aspect }}>{art}</div>
    </FramedArt>
  );
}

/** Repeating diagonal bands — drawn here, not imported from anywhere. */
function DiagonalField({ light }: { light: boolean }) {
  const stroke = light ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)";
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
    >
      <defs>
        <pattern id="heroDiagonals" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M-12 12 L12 -12 M0 48 L48 0 M36 60 L60 36" stroke={stroke} strokeWidth="14" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#heroDiagonals)" />
    </svg>
  );
}
