"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

      {open && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button
            type="button"
            aria-label={t.header.closeMenu}
            onClick={close}
            className="absolute inset-0 bg-black/50"
          />

          <div className="absolute inset-y-0 left-0 flex w-[min(22rem,88vw)] flex-col bg-white">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
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
              <ul className="divide-y divide-line-soft">
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
                            item.accent && "text-flame",
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
                            className="grid w-12 place-items-center border-l border-line-soft"
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
                        <div className="space-y-4 bg-shell px-4 py-4">
                          {item.columns.map((column) => (
                            <div key={column.heading}>
                              <p className="eyebrow mb-2 text-mute">{column.heading}</p>
                              <ul className="space-y-1.5">
                                {column.links.map((link) => (
                                  <li key={link.href + link.label}>
                                    <Link
                                      href={link.href}
                                      onClick={close}
                                      className="text-[0.875rem]"
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

            <div className="space-y-3 border-t border-line px-4 py-4 text-[0.875rem]">
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
                  className="flex items-center gap-2 font-semibold text-flame"
                >
                  <ShieldIcon className="size-5" />
                  {t.header.adminPanel}
                </Link>
              )}
              <LocaleSwitcher locale={locale} t={t} tone="dark" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
