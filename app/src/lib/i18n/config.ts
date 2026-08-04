export const LOCALES = ["es", "gl", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "es";

/** Cookie that remembers an explicit locale choice, so detection runs only once. */
export const LOCALE_COOKIE = "go_locale";

export const LOCALE_META: Record<
  Locale,
  { label: string; endonym: string; htmlLang: string; hrefLang: string; ogLocale: string }
> = {
  es: {
    label: "Castellano",
    endonym: "Castellano",
    htmlLang: "es-ES",
    hrefLang: "es-ES",
    ogLocale: "es_ES",
  },
  gl: {
    label: "Galego",
    endonym: "Galego",
    htmlLang: "gl-ES",
    hrefLang: "gl-ES",
    ogLocale: "gl_ES",
  },
  en: {
    label: "English",
    endonym: "English",
    htmlLang: "en",
    hrefLang: "en",
    ogLocale: "en_GB",
  },
};

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (LOCALES as readonly string[]).includes(value);
}

/**
 * Picks the best supported locale from an `Accept-Language` header.
 *
 * Deliberately dependency-free: parses `q` weights, matches on the primary
 * language subtag so `es-AR` and `es-419` both land on `es`, and falls back to
 * the default when nothing matches.
 */
export function matchLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params
        .map((param) => param.trim())
        .find((param) => param.startsWith("q="));
      const quality = q ? Number.parseFloat(q.slice(2)) : 1;
      return {
        tag: tag.trim().toLowerCase(),
        quality: Number.isFinite(quality) ? quality : 0,
      };
    })
    .filter((entry) => entry.tag.length > 0 && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const { tag } of ranked) {
    if (tag === "*") return DEFAULT_LOCALE;
    const primary = tag.split("-")[0];
    if (isLocale(primary)) return primary;
  }

  return DEFAULT_LOCALE;
}
