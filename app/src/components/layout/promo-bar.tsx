"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";

export type PromoBarMessage = { id: string; text: string; href: string | null };

/**
 * The rotating announcement bar.
 *
 * The messages come from `promo_messages` via the layout, not from the dictionary:
 * "free shipping over 60 €" is campaign copy that has to change without a deploy,
 * and it has to be able to agree with the shipping settings.
 *
 * A message need not link anywhere — an announcement with nothing to click is a
 * legitimate thing to want — so the link is optional.
 */
export function PromoBar({
  locale,
  t,
  messages,
}: {
  locale: Locale;
  t: Dictionary;
  messages: PromoBarMessage[];
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    // Nothing to rotate through, or only one line: no timer at all.
    if (messages.length < 2) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % messages.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, [messages.length]);

  // The admin can switch every message off, and the bar still has to render: it
  // also holds the language switcher and the help links.
  const current = messages[index % Math.max(1, messages.length)] ?? null;

  return (
    // z-[60] lifts the bar above the sticky masthead (z-50) that follows it in
    // the DOM — otherwise the locale dropdown paints behind the header.
    //
    // White, and it is the top of three bands that each take a different one:
    // white here, black in the masthead, blue in the nav row. The announce bar
    // was black too, which made the whole chrome one dark mass — this is the
    // lightest thing on the page carrying the lightest-weight content, and the
    // black under it now has an edge to start at without a rule.
    //
    // No `data-chrome="dark"`: the focus ring goes back to the institutional blue
    // in here, which is what it is for on a light surface.
    <div className="relative z-[60] bg-white text-ink">
      <div className="shell flex h-promo items-center justify-between gap-4 text-[0.75rem]">
        {/* Left slot keeps the message optically centred on wide screens */}
        <div className="hidden flex-1 items-center gap-4 lg:flex">
          <LocaleSwitcher locale={locale} t={t} tone="dark" />
        </div>

        {/*
          Caps, bold, tracking opened to .06em — the announce-bar voice from §5.1.
          Only the message takes it: the locale switcher and the help links either
          side are the utility bar, and shouting those would flatten the one line
          of the three that is actually an announcement.
        */}
        {current ? (
          <p
            key={current.id}
            className="flex-1 truncate text-center font-bold uppercase tracking-cta animate-[fade-up_400ms_var(--ease-out-quint)]"
          >
            {current.href ? (
              <Link href={current.href} className="hover:underline">
                {current.text}
              </Link>
            ) : (
              current.text
            )}
          </p>
        ) : (
          <p className="flex-1" />
        )}

        <div className="hidden flex-1 items-center justify-end gap-5 text-mute lg:flex">
          <Link href={href(locale, "help", "pedidos")} className="transition hover:text-ink">
            {t.promo.trackOrder}
          </Link>
          <Link href={href(locale, "help", "contacto")} className="transition hover:text-ink">
            {t.promo.help}
          </Link>
        </div>
      </div>
    </div>
  );
}
