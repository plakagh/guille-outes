"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ProductShot } from "@/components/product/product-shot";
import { ArrowRight } from "@/components/icons";
import type { Catalog } from "@/lib/catalog";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { NavFeature, NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * Desktop primary navigation. Panels open on hover with a short close delay (so
 * diagonal mouse paths don't dismiss them) and on keyboard focus; Escape closes.
 */
export function MegaNav({
  t,
  nav,
  catalog,
}: {
  t: Dictionary;
  nav: NavItem[];
  catalog: Catalog;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const closeTimer = useRef<number | null>(null);

  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpenIndex(null), 140);
  };

  useEffect(() => cancelClose, []);

  useEffect(() => {
    if (openIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenIndex(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [openIndex]);

  const open = openIndex !== null ? nav[openIndex] : null;

  return (
    <nav
      aria-label={t.header.mainNav}
      className={cn(
        /*
          The bottom of three bands, each a different colour: white in the announce
          bar, black in the masthead, this blue under the navigation.

          The blue read as too much of the page when the two bands above it were
          also dark — three-quarters of the chrome in colour, and the eye had
          nowhere lighter to land. With the announce bar white it is the last of
          three steps down rather than half of one dark mass, and it separates the
          navigation from the masthead without a rule. White caps sit on it at
          9.2:1, so the labels gain contrast rather than lose it.

          What the blue costs is red: `--color-flame-bright` is only 2.9:1 here,
          against 6.4:1 on black. So the outlet item is a red chip with white caps
          rather than red text — still the one thing in the row naming a discount,
          and legible while it does.
        */
        "relative hidden border-t border-white/10 bg-court text-white lg:block",
      )}
      onMouseLeave={scheduleClose}
    >
      <ul className="shell flex h-navbar items-stretch justify-center gap-1">
        {nav.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <li
              key={item.label}
              className="flex"
              onMouseEnter={() => {
                cancelClose();
                setOpenIndex(item.columns ? index : null);
              }}
            >
              <Link
                href={item.href}
                aria-expanded={item.columns ? isOpen : undefined}
                aria-haspopup={item.columns ? "true" : undefined}
                onFocus={() => setOpenIndex(item.columns ? index : null)}
                onClick={() => setOpenIndex(null)}
                className={cn(
                  "relative flex items-center px-3 font-display text-[0.9375rem] font-bold uppercase tracking-wide transition-colors",
                  // The active item is a white 2px rule under the label (§2.2) —
                  // on a coloured row, the underline is the only marker available
                  // that isn't a second change of background.
                  "after:absolute after:inset-x-2 after:bottom-0 after:h-[2px] after:origin-left after:scale-x-0 after:bg-white after:transition-transform after:duration-200",
                  isOpen && "after:scale-x-100",
                  item.accent ? "text-white" : "text-white/85 hover:text-white",
                )}
              >
                {/*
                  Red survives here on exactly one item — the outlet — because
                  there it is naming a discount, which is the one thing red means.
                  As a chip rather than as coloured text: no red light enough to
                  read on this blue is still recognisably the brand's, while white
                  on the brand red is 5.9:1 either way round.
                */}
                {item.accent ? (
                  <span className="bg-flame px-2 py-1 leading-none">{item.label}</span>
                ) : (
                  item.label
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {open?.columns && (
        <MegaPanel
          item={open}
          t={t}
          catalog={catalog}
          onNavigate={() => setOpenIndex(null)}
          onMouseEnter={cancelClose}
        />
      )}
    </nav>
  );
}

function MegaPanel({
  item,
  t,
  catalog,
  onNavigate,
  onMouseEnter,
}: {
  item: NavItem;
  t: Dictionary;
  catalog: Catalog;
  onNavigate: () => void;
  onMouseEnter: () => void;
}) {
  return (
    <div
      onMouseEnter={onMouseEnter}
      // Uncovered downwards from under the row, so it reads as belonging to the
      // item you are pointing at rather than as a sheet of links that appeared
      // over the page. Short: this opens on hover, and anything long enough to
      // notice on the way in is long enough to be in the way on every pass.
      //
      // Only the way in is animated. Dismissal is not a state worth explaining,
      // and holding the panel mounted to play it out would keep a menu on screen
      // after the pointer has left, which is the opposite of what leaving means.
      className={cn(
        // Continuous with the row it is uncovered from: §2.2 gives the flyout the
        // same surface as the nav — the blue — and hover there is an underline
        // rather than a change of background, because a panel that repaints a row
        // on hover reads as a list of buttons, not a list of links.
        "absolute inset-x-0 top-full z-40 border-b border-white/10 bg-court text-white shadow-[0_24px_40px_-24px_rgba(0,0,0,0.6)]",
        "animate-[panel-drop_180ms_var(--ease-out-quint)]",
      )}
    >
      <div className="shell grid grid-cols-12 gap-8 py-8">
        <div
          className={cn(
            "grid gap-8",
            item.feature ? "col-span-8 grid-cols-3" : "col-span-12 grid-cols-4",
          )}
        >
          {item.columns?.map((column) => (
            <div key={column.heading}>
              <p className="eyebrow mb-3 border-b border-white/15 pb-2 text-white/55">
                {column.heading}
              </p>
              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      onClick={onNavigate}
                      className="inline-flex items-center gap-2 text-[0.875rem] text-white/85 transition-colors hover:text-white hover:underline"
                    >
                      {link.label}
                      {link.flag === "nuevo" && (
                        <span className="eyebrow text-white">{t.nav.flagNew}</span>
                      )}
                      {/*
                        The same chip the outlet item wears, for the same reason:
                        this flag names a discount, and `--color-ink-soft-bright`
                        — which this asked for until recently — was never a token,
                        so the class produced no colour at all and the flag was
                        indistinguishable from the "new" one beside it.
                      */}
                      {link.flag === "oferta" && (
                        <span className="eyebrow bg-flame px-1.5 py-0.5 text-white">
                          {t.nav.flagSale}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {item.feature && (
          <FeatureCard feature={item.feature} catalog={catalog} onNavigate={onNavigate} />
        )}
      </div>
    </div>
  );
}

function FeatureCard({
  feature,
  catalog,
  onNavigate,
}: {
  feature: NavFeature;
  catalog: Catalog;
  onNavigate: () => void;
}) {
  const collection = catalog.collections.find((c) => c.id === feature.collectionId);
  const hero = catalog.products.find((p) => p.collectionId === feature.collectionId);

  return (
    <Link
      href={feature.href}
      onClick={onNavigate}
      className="group col-span-4 relative flex items-center gap-5 overflow-hidden bg-shell p-5 text-ink transition"
      /*
        The tint is mixed into white rather than laid over the panel at 8% alpha.

        As `${accent}14` it was a translucent wash that took its lightness from
        whatever was behind it, which was white and is now black — the card would
        have gone dark and swallowed its own `text-ink` copy. `color-mix` against
        #fff makes it opaque and light regardless, which is also the right answer
        on principle: this card is content sitting on the chrome, and the one
        light panel in a black flyout is the piece being featured.
      */
      style={
        collection
          ? { backgroundColor: `color-mix(in srgb, ${collection.accent} 8%, #fff)` }
          : undefined
      }
    >
      <span className="relative w-32 shrink-0">
        {hero && (
          <ProductShot product={hero} colorway={hero.colorways[0]} print={hero.print} />
        )}
      </span>
      <span className="min-w-0">
        <span className="eyebrow block text-ink-soft">{feature.eyebrow}</span>
        <span className="mt-1.5 block font-display text-3xl font-bold uppercase leading-none">
          {feature.title}
        </span>
        <span className="mt-2 block line-clamp-3 text-[0.8125rem] leading-snug text-mute">
          {feature.blurb}
        </span>
        <span className="mt-3 inline-flex items-center gap-1.5 border-b-2 border-ink pb-0.5 font-display text-[0.8125rem] font-bold uppercase tracking-wide">
          {feature.cta}
          <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-1" />
        </span>
      </span>
    </Link>
  );
}
