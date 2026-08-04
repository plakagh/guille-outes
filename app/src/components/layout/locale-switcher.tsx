"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronDown, GlobeIcon } from "@/components/icons";
import { LOCALE_META, LOCALES, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { translateRouteSegments } from "@/lib/i18n/routes";
import { cn } from "@/lib/utils";

/**
 * Language picker.
 *
 * It translates the *route* segments only (`/es/tienda/…` → `/en/shop/…`) and
 * leaves any trailing entity slug alone; the target page resolves a slug written
 * in another language and then redirects to its own canonical one. That keeps
 * this component data-free, and keeps the canonical URL correct either way.
 */
export function LocaleSwitcher({
  locale,
  t,
  tone = "light",
}: {
  locale: Locale;
  t: Dictionary;
  tone?: "light" | "dark";
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={t.common.changeLanguage}
        className={cn(
          "flex items-center gap-1.5 transition",
          tone === "light" ? "text-white/75 hover:text-white" : "text-mute hover:text-ink",
        )}
      >
        <GlobeIcon className="size-3.5" />
        {t.promo.country} · {LOCALE_META[locale].endonym}
        <ChevronDown className="size-3" />
      </button>

      {open && (
        <ul
          className="absolute left-0 top-[calc(100%+0.5rem)] z-50 min-w-44 border border-line bg-white py-1 text-ink shadow-[0_14px_32px_rgba(0,0,0,0.18)]"
          aria-label={t.common.language}
        >
          {LOCALES.map((option) => (
            <li key={option}>
              <Link
                href={translateRouteSegments(pathname, option)}
                hrefLang={LOCALE_META[option].hrefLang}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between gap-3 px-3 py-2 text-[0.8125rem] hover:bg-shell"
              >
                {LOCALE_META[option].endonym}
                {option === locale && <CheckIcon className="size-4 text-flame" />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
