import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/es";

/**
 * Loads a locale's UI strings. Dynamic imports keep the unused locales out of
 * the bundle for a given render.
 */
const LOADERS: Record<Locale, () => Promise<{ default: Dictionary }>> = {
  es: () => import("@/lib/i18n/dictionaries/es"),
  gl: () => import("@/lib/i18n/dictionaries/gl"),
  en: () => import("@/lib/i18n/dictionaries/en"),
};

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  const loaded = await LOADERS[locale]();
  return loaded.default;
}

export type { Dictionary };
