"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { href as buildHref, withQuery, type RouteId } from "@/lib/i18n/routes";

type I18nValue = {
  locale: Locale;
  t: Dictionary;
  /** Locale-aware path builder, same signature as the server-side `href`. */
  href: (route?: RouteId, ...rest: (string | number)[]) => string;
  withQuery: typeof withQuery;
};

const I18nContext = createContext<I18nValue | null>(null);

/**
 * Makes the current locale and its dictionary available to Client Components.
 * Server Components should call `getDictionary(locale)` directly instead.
 */
export function I18nProvider({
  locale,
  dictionary,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  children: ReactNode;
}) {
  const value = useMemo<I18nValue>(
    () => ({
      locale,
      t: dictionary,
      href: (route, ...rest) => buildHref(locale, route, ...rest),
      withQuery,
    }),
    [locale, dictionary],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n debe usarse dentro de <I18nProvider>");
  return value;
}
