import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/i18n/config";
import type { Audience } from "@/lib/catalog";

/**
 * Listing sections that are not database rows — audiences and curated views —
 * still need a localized slug so `/en/shop/best-sellers` is indexable in its
 * own right rather than hiding behind a Spanish word.
 */

export const AUDIENCE_SLUGS: Record<Audience, Record<Locale, string>> = {
  hombre: { es: "hombre", gl: "home", en: "men" },
  mujer: { es: "mujer", gl: "muller", en: "women" },
  ninos: { es: "ninos", gl: "nenos", en: "kids" },
  unisex: { es: "unisex", gl: "unisex", en: "unisex" },
};

export type CuratedId = "novedades" | "outlet" | "mas-vendido";

export const CURATED_SLUGS: Record<CuratedId, Record<Locale, string>> = {
  novedades: { es: "novedades", gl: "novidades", en: "new-in" },
  outlet: { es: "outlet", gl: "outlet", en: "outlet" },
  "mas-vendido": { es: "mas-vendido", gl: "mais-vendido", en: "best-sellers" },
};

export function audienceSlug(audience: Audience, locale: Locale): string {
  return AUDIENCE_SLUGS[audience][locale];
}

export function curatedSlug(id: CuratedId, locale: Locale): string {
  return CURATED_SLUGS[id][locale];
}

/** Reverse lookup, tolerant of a slug written in another language. */
export function audienceFromSlug(slug: string): Audience | undefined {
  return (Object.keys(AUDIENCE_SLUGS) as Audience[]).find((audience) =>
    Object.values(AUDIENCE_SLUGS[audience]).includes(slug),
  );
}

export function curatedFromSlug(slug: string): CuratedId | undefined {
  return (Object.keys(CURATED_SLUGS) as CuratedId[]).find((id) =>
    Object.values(CURATED_SLUGS[id]).includes(slug),
  );
}

/** Every locale's slug for a section, for hreflang alternates. */
export function sectionAlternates(
  slugs: Record<Locale, string>,
): Record<Locale, string> {
  const fallback = slugs[DEFAULT_LOCALE];
  return Object.fromEntries(
    LOCALES.map((locale) => [locale, slugs[locale] || fallback]),
  ) as Record<Locale, string>;
}
