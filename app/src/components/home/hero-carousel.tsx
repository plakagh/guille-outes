"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ProductArt, type ArtPrint, type ArtShape, type Colorway } from "@/components/brand/product-art";
import { useI18n } from "@/components/i18n/provider";
import { ArrowRight, ChevronLeft, ChevronRight } from "@/components/icons";
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

  const slide = slides[index];
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
        <div className="relative flex min-h-[16rem] items-center justify-center lg:min-h-[26rem]">
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 select-none text-center font-display text-[clamp(6rem,20vw,15rem)] font-bold uppercase leading-none",
              light ? "text-white/10" : "text-ink/[0.07]",
            )}
          >
            {slide.ghost}
          </span>
          <div key={`art-${index}`} className="relative w-[62%] max-w-sm animate-[fade-up_650ms_var(--ease-out-quint)]">
            <ProductArt
              shape={slide.art.shape}
              colorway={slide.art.colorway}
              print={slide.art.print}
            />
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
