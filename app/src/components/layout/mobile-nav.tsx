"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Logo } from "@/components/brand/logo";
import { ChevronDown, CloseIcon, MenuIcon, ShieldIcon, UserIcon } from "@/components/icons";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";
import type { NavItem } from "@/lib/nav";
import type { Viewer } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

/** Slide-in drawer that mirrors the desktop mega nav as nested accordions. */
export function MobileNav({
  locale,
  t,
  nav,
  viewer,
}: {
  locale: Locale;
  t: Dictionary;
  nav: NavItem[];
  viewer: Viewer | null;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.header.openMenu}
        className="grid size-10 place-items-center lg:hidden"
      >
        <MenuIcon className="size-6" />
      </button>

      {/*
        The drawer is rendered into `document.body`, not where it is written.

        The button belongs in the masthead, but the sheet it opens cannot stay
        there: the masthead sits inside `<header class="sticky top-0 z-50">`, and a
        positioned element with a z-index opens a stacking context. Every layer
        inside it is then ordered *within* the header first, so the drawer's z-70
        never got the chance to mean what the scale in `globals.css` says it means
        — the announce bar (z-60) painted over the top of it, and the logo and the
        account icons, which merely come later in the DOM, painted over the rest.

        A portal is the same answer `CartDrawer` gets by being mounted in the
        layout root: overlays are ordered against the page, so they have to be
        children of it. The portal is only built when `open` is true, which cannot
        happen before hydration, so there is nothing here for the server to render.
      */}
      {open && createPortal(
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button
            type="button"
            aria-label={t.header.closeMenu}
            onClick={close}
            className="absolute inset-0 bg-black/50 animate-[scrim-in_200ms_ease-out]"
          />

          {/*
            Black, because this drawer *is* the mega-nav on a phone.

            §2.2 puts the flyout on the same surface as the nav row it belongs to,
            and the two are the same menu reached two ways — a white drawer would
            make the phone a different shop from the desktop. `data-chrome="dark"`
            carries the white focus ring in with it.
          */}
          <div
            data-chrome="dark"
            className="absolute inset-y-0 left-0 flex w-[min(22rem,88vw)] flex-col bg-black text-white animate-[drawer-in_300ms_var(--ease-out-quint)]"
            style={{ "--from": "-100%" } as React.CSSProperties}
          >
            <div className="flex items-center justify-between border-b border-white/15 px-4 py-3">
              <Link href={href(locale)} onClick={close}>
                <Logo className="h-5" />
              </Link>
              <button
                type="button"
                onClick={close}
                aria-label={t.header.closeMenu}
                className="grid size-9 place-items-center"
              >
                <CloseIcon className="size-5" />
              </button>
            </div>

            <nav aria-label={t.header.mobileNav} className="flex-1 overflow-y-auto">
              <ul className="divide-y divide-white/10">
                {nav.map((item) => {
                  const isExpanded = expanded === item.label;
                  return (
                    <li key={item.label}>
                      <div className="flex items-stretch">
                        <Link
                          href={item.href}
                          onClick={close}
                          className={cn(
                            "flex-1 px-4 py-3.5 font-display text-lg font-bold uppercase",
                            // The outlet keeps its red on the dark drawer too, in
                            // the tint that survives black.
                            item.accent && "text-flame-bright",
                          )}
                        >
                          {item.label}
                        </Link>
                        {item.columns && (
                          <button
                            type="button"
                            onClick={() => setExpanded(isExpanded ? null : item.label)}
                            aria-expanded={isExpanded}
                            aria-label={item.label}
                            className="grid w-12 place-items-center border-l border-white/10"
                          >
                            <ChevronDown
                              className={cn(
                                "size-5 transition-transform",
                                isExpanded && "rotate-180",
                              )}
                            />
                          </button>
                        )}
                      </div>

                      {isExpanded && item.columns && (
                        // The expanded group is a shade up from the drawer rather
                        // than a light well: `--surface-subtle` exists to separate
                        // bands, and on a black surface the equivalent is a lift,
                        // not an inversion.
                        <div className="space-y-4 bg-white/[0.07] px-4 py-4">
                          {item.columns.map((column) => (
                            <div key={column.heading}>
                              <p className="eyebrow mb-2 text-white/55">{column.heading}</p>
                              <ul className="space-y-1.5">
                                {column.links.map((link) => (
                                  <li key={link.href + link.label}>
                                    <Link
                                      href={link.href}
                                      onClick={close}
                                      className="text-[0.875rem] text-white/85"
                                    >
                                      {link.label}
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="space-y-3 border-t border-white/15 px-4 py-4 text-[0.875rem]">
              <Link
                href={viewer ? href(locale, "account") : href(locale, "login")}
                onClick={close}
                className="flex items-center gap-2 font-semibold"
              >
                <UserIcon className="size-5" />
                {viewer ? t.header.account : t.header.signIn}
              </Link>
              {viewer?.isAdmin && (
                <Link
                  href={href(locale, "admin")}
                  onClick={close}
                  className="flex items-center gap-2 font-semibold text-flame-bright"
                >
                  <ShieldIcon className="size-5" />
                  {t.header.adminPanel}
                </Link>
              )}
              {/* `tone="light"` is the on-dark tone — the drawer is black now. */}
              <LocaleSwitcher locale={locale} t={t} tone="light" />
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
