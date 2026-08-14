"use client";

import Link from "next/link";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
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

/**
 * May the carousel advance on its own right now?
 *
 * Advancing by itself is a loop nobody asked for, so it is granted narrowly: it
 * stops while the fold is off screen or the tab is in the background — where its
 * only effect is to spend a frame budget on something nobody can see — and it
 * never starts at all for a visitor who has asked for reduced motion, which is
 * the one animation on the page that no CSS media query can soften into
 * something acceptable. It is movement they did not initiate; the answer is not
 * to run it.
 *
 * Every answer starts at "no" and is opened up by an effect, so the first paint
 * after hydration never carries movement we have not yet earned the right to.
 */
function useAutoplayAllowed(ref: RefObject<HTMLElement | null>) {
  const [onScreen, setOnScreen] = useState(false);
  const [awake, setAwake] = useState(true);
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      // The middle of the viewport rather than a fraction of the section: a
      // fraction is a share of something whose height depends on the slide, and
      // on a short screen a tall fold can never clear it.
      { rootMargin: "-15% 0px -15% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);

  useEffect(() => {
    const read = () => setAwake(!document.hidden);
    read();
    document.addEventListener("visibilitychange", read);
    return () => document.removeEventListener("visibilitychange", read);
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setReduced(query.matches);
    read();
    query.addEventListener("change", read);
    return () => query.removeEventListener("change", read);
  }, []);

  return onScreen && awake && !reduced;
}

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const { t } = useI18n();
  // The direction travels with the index because the entrance is built from it:
  // a slide arrives from the side you sent it, and stored apart the two could
  // disagree for a render — long enough to play the wrong way.
  const [{ index, dir }, setSlide] = useState({ index: 0, dir: 1 });
  const [paused, setPaused] = useState(false);
  const section = useRef<HTMLElement>(null);
  const allowed = useAutoplayAllowed(section);

  const go = useCallback(
    (next: number, direction: 1 | -1) =>
      setSlide({
        index: ((next % slides.length) + slides.length) % slides.length,
        dir: direction,
      }),
    [slides.length],
  );

  const running = allowed && !paused && slides.length > 1;

  // A timeout keyed to the slide, not a free-running interval: picking a slide
  // off the pager gives you the whole dwell to look at it, and the bar drawing
  // the countdown is then measuring the wait that is actually pending.
  useEffect(() => {
    if (!running) return;
    const id = window.setTimeout(() => go(index + 1, 1), AUTOPLAY_MS);
    return () => window.clearTimeout(id);
  }, [running, index, go]);

  // Every slide is built from something the shop actually has, so an empty list
  // is a real state — a catalogue with no collections and nothing on sale — and
  // not a bug. Render nothing rather than reading `ink` off undefined.
  const slide = slides[index] ?? slides[0];
  if (!slide) return null;

  const light = slide.ink === "light";

  return (
    <section
      ref={section}
      aria-roledescription="carousel"
      aria-label={t.home.heroCarousel}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      // Focus moving between two of the fold's own controls raises a blur on the
      // way out of the first one. Resuming there would restart the countdown
      // under someone still tabbing through the slide they stopped it to read.
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
      // The colour is the one thing every slide shares a slot for, so it is
      // crossed rather than cut: the fold stays one surface being repainted
      // while its contents change, instead of two unrelated screens swapped.
      className="relative overflow-hidden transition-colors duration-500 ease-[var(--ease-out-quint)]"
      style={{ backgroundColor: slide.background, "--dir": String(dir) } as React.CSSProperties}
    >
      {/* Own artwork: diagonal court hatching keyed to the slide colour */}
      <DiagonalField light={light} />

      <div
        className={cn(
          "shell relative grid items-center gap-6 py-12 lg:grid-cols-[1.05fr_1fr] lg:py-20",
          light ? "text-white" : "text-ink",
        )}
      >
        {/* Words first and over the shortest distance: they are the thing you
            read, so they settle while the piece is still arriving. */}
        <div
          key={index}
          className="animate-[hero-enter_460ms_var(--ease-out-quint)]"
          style={{ "--travel": "1.5rem" } as React.CSSProperties}
        >
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
              "mt-5 text-[0.9375rem] leading-relaxed",
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
          {/* Centring is the wrapper's job and travel is the inner span's: both
              are `transform`, and an entrance that animated the same property
              that holds the word on the centre line would drop it half its own
              height for the length of the animation. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 select-none"
          >
            {/* Furthest back, so it moves least — the word is the wall the piece
                hangs against, and a backdrop keeping pace with the foreground
                flattens the two into one sheet. */}
            <span
              key={`ghost-${index}`}
              className={cn(
                "block text-center font-display text-[clamp(6rem,20vw,15rem)] font-bold uppercase leading-none",
                "animate-[hero-enter_620ms_var(--ease-out-quint)]",
                light ? "text-white/10" : "text-ink/[0.07]",
              )}
              style={{ "--travel": "0.75rem" } as React.CSSProperties}
            >
              {slide.ghost}
            </span>
          </span>
          {/* The piece is what the slide is selling, so it takes most of the panel:
              the ghost word behind it is a backdrop, not a competing element. */}
          {/* Nearest the front, so it covers the most ground and takes the
              longest doing it — this is the one thing on the fold worth
              watching arrive. */}
          <div
            key={`art-${index}`}
            className="relative w-[82%] animate-[hero-enter_700ms_var(--ease-out-quint)]"
            style={{ "--travel": "3rem" } as React.CSSProperties}
          >
            <SlideArt slide={slide} />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="shell relative flex items-center justify-between pb-6 lg:pb-8">
        <ol className="flex items-center gap-2" aria-label={t.home.heroCarousel}>
          {slides.map((item, i) => {
            const current = i === index;
            return (
              <li key={item.headline.join("-")}>
                <button
                  type="button"
                  onClick={() => go(i, i > index ? 1 : -1)}
                  aria-label={`${t.home.heroSlide} ${i + 1}: ${item.headline.join(" ")}`}
                  aria-current={current}
                  // The active bar is a track with something drawn in it, so it
                  // sits back from the others rather than in front of them: the
                  // weight that used to mark "you are here" now belongs to the
                  // fill, and a track as strong as the fill would leave the two
                  // indistinguishable at the end of every dwell.
                  className={cn(
                    "relative block h-1 overflow-hidden transition-[width,background-color] duration-300 ease-[var(--ease-out-quint)]",
                    current ? "w-10" : "w-5",
                    light
                      ? current
                        ? "bg-white/25"
                        : "bg-white/40 hover:bg-white/75"
                      : current
                        ? "bg-ink/20"
                        : "bg-ink/35 hover:bg-ink/70",
                  )}
                >
                  {/*
                    The wait, drawn. A fold that moves on its own owes you the
                    reason it is about to move, and the bar it is going to leave
                    behind is where you are already looking.

                    Solid whenever the countdown is not running — hover, a
                    background tab, reduced motion — because then nothing is
                    pending and a half-drawn bar would be describing a wait that
                    is not happening. Remounting on that flip restarts the draw
                    with the timeout it is measuring.
                  */}
                  {current && (
                    <span
                      key={`${index}-${running}`}
                      className={cn(
                        "absolute inset-0 origin-left",
                        light ? "bg-white" : "bg-ink",
                        running && "animate-[pager-fill_var(--dwell)_linear_both]",
                      )}
                      style={
                        running ? ({ "--dwell": `${AUTOPLAY_MS}ms` } as React.CSSProperties) : undefined
                      }
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ol>

        <div className="hidden gap-2 md:flex">
          {[
            { dir: -1 as const, Icon: ChevronLeft, label: t.common.previous },
            { dir: 1 as const, Icon: ChevronRight, label: t.common.next },
          ].map(({ dir, Icon, label }) => (
            <button
              key={label}
              type="button"
              onClick={() => go(index + dir, dir)}
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
          {/* The hatching is painted on the slide's own colour and has to change
              with it: cut on its own it would flash a wrong-contrast grid across
              a background that is still crossing. Same 500ms as the section. */}
          <path
            d="M-12 12 L12 -12 M0 48 L48 0 M36 60 L60 36"
            stroke={stroke}
            strokeWidth="14"
            style={{ transition: "stroke 500ms var(--ease-out-quint)" }}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#heroDiagonals)" />
    </svg>
  );
}
