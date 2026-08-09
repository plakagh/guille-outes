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
      className="relative hidden border-t border-line-soft bg-white lg:block"
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
                  "after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:origin-left after:scale-x-0 after:bg-ink after:transition-transform after:duration-200",
                  isOpen && "after:scale-x-100",
                  item.accent ? "text-flame hover:text-flame-deep" : "hover:text-flame",
                )}
              >
                {item.label}
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
      className="absolute inset-x-0 top-full z-40 border-b border-line bg-white shadow-[0_24px_40px_-24px_rgba(0,0,0,0.28)]"
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
              <p className="eyebrow mb-3 border-b border-line pb-2 text-mute">{column.heading}</p>
              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      onClick={onNavigate}
                      className="inline-flex items-center gap-2 text-[0.875rem] hover:underline"
                    >
                      {link.label}
                      {link.flag === "nuevo" && (
                        <span className="eyebrow text-ink">{t.nav.flagNew}</span>
                      )}
                      {link.flag === "oferta" && (
                        <span className="eyebrow text-flame">{t.nav.flagSale}</span>
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
      style={collection ? { backgroundColor: `${collection.accent}14` } : undefined}
    >
      <span className="relative w-32 shrink-0">
        {hero && (
          <ProductShot product={hero} colorway={hero.colorways[0]} print={hero.print} />
        )}
      </span>
      <span className="min-w-0">
        <span className="eyebrow block text-flame">{feature.eyebrow}</span>
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
