import { DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from "@/lib/i18n/config";

/**
 * Localized URLs, two layers:
 *
 *  1. **Route segments** (this file) — the folder names in `app/[locale]/…` are
 *     canonical English ids (`shop`, `product`), while the public URL uses the
 *     locale's own word (`tienda`, `tenda`, `shop`). `proxy.ts` rewrites the
 *     public path to the canonical one, so routes stay statically typed and the
 *     URLs stay indexable per language.
 *
 *  2. **Entity slugs** (the database) — each product, category, collection and
 *     author stores one slug per locale, resolved by the page itself.
 */

export const ROUTE_IDS = [
  "shop",
  "collection",
  "product",
  "search",
  "cart",
  "checkout",
  "help",
  "legal",
  "authors",
  "bibliography",
  "family",
  "gallery",
  "studio",
  "account",
  "order",
  "login",
  "register",
  "admin",
  "newsletter",
  "newsletterConfirm",
  "newsletterUnsubscribe",
] as const;

export type RouteId = (typeof ROUTE_IDS)[number];

/** Canonical id → the segment used in each locale's public URL. */
export const ROUTE_SEGMENTS: Record<RouteId, Record<Locale, string>> = {
  shop: { es: "tienda", gl: "tenda", en: "shop" },
  collection: { es: "coleccion", gl: "coleccion", en: "collection" },
  product: { es: "producto", gl: "produto", en: "product" },
  search: { es: "buscar", gl: "buscar", en: "search" },
  cart: { es: "carrito", gl: "carro", en: "cart" },
  checkout: { es: "pago", gl: "pago", en: "checkout" },
  help: { es: "ayuda", gl: "axuda", en: "help" },
  legal: { es: "legal", gl: "legal", en: "legal" },
  authors: { es: "autores", gl: "autoras", en: "authors" },
  bibliography: { es: "bibliografia", gl: "bibliografia", en: "bibliography" },
  // The project's own page. The segment carries the name rather than a generic
  // "about": it is what the poster says and what people will have read at the
  // stand before typing it in.
  family: { es: "familia-pintora", gl: "familia-pintora", en: "painting-family" },
  gallery: { es: "galeria", gl: "galeria", en: "gallery" },
  // The painting tool. It sits under the gallery segment, so its public path is
  // /es/galeria/taller — one word away from a drawing's own /es/galeria/<slug>.
  // Nothing collides: every artwork slug ends in a random suffix.
  studio: { es: "taller", gl: "obradoiro", en: "studio" },
  account: { es: "cuenta", gl: "conta", en: "account" },
  order: { es: "pedido", gl: "pedido", en: "order" },
  login: { es: "acceder", gl: "acceder", en: "login" },
  register: { es: "registro", gl: "rexistro", en: "register" },
  admin: { es: "admin", gl: "admin", en: "admin" },
  // "Newsletter" is the word actually used in all three languages here; the
  // actions under it are not.
  newsletter: { es: "newsletter", gl: "newsletter", en: "newsletter" },
  newsletterConfirm: { es: "confirmar", gl: "confirmar", en: "confirm" },
  newsletterUnsubscribe: { es: "baja", gl: "baixa", en: "unsubscribe" },
};

/**
 * Folder name under `app/[locale]/` when it differs from the route id.
 *
 * Everything else relies on id === folder name, which is what makes
 * `toCanonicalPath` a straight join. These two keep descriptive ids (`confirm`
 * alone would be a poor global name) while their folders sit under `newsletter/`.
 */
const CANONICAL_SEGMENT: Partial<Record<RouteId, string>> = {
  newsletterConfirm: "confirm",
  newsletterUnsubscribe: "unsubscribe",
};

/** Routes whose public path sits under another localized segment. */
const NESTED_UNDER: Partial<Record<RouteId, RouteId>> = {
  checkout: "cart",
  studio: "gallery",
  newsletterConfirm: "newsletter",
  newsletterUnsubscribe: "newsletter",
};

/** Public segment for a route in a given locale. */
export function segment(route: RouteId, locale: Locale): string {
  return ROUTE_SEGMENTS[route][locale];
}

/**
 * Builds a public, locale-prefixed path.
 *
 *   href("es", "product", "camiseta-court-series") → "/es/producto/camiseta-court-series"
 *   href("en", "checkout")                        → "/en/cart/checkout"
 *   href("gl")                                    → "/gl"
 */
export function href(
  locale: Locale,
  route?: RouteId,
  ...rest: (string | number)[]
): string {
  const parts: string[] = [locale];

  if (route) {
    const parent = NESTED_UNDER[route];
    if (parent) parts.push(segment(parent, locale));
    parts.push(segment(route, locale));
  }

  for (const item of rest) {
    const value = String(item);
    if (value) parts.push(value);
  }

  return `/${parts.join("/")}`;
}

/** Appends a query string, skipping it entirely when empty. */
export function withQuery(path: string, query: URLSearchParams | string): string {
  const qs = typeof query === "string" ? query : query.toString();
  return qs ? `${path}?${qs}` : path;
}

/* ------------------------------------------------------- reverse lookups */

type ReverseMap = Map<string, RouteId>;

const REVERSE: Record<Locale, ReverseMap> = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    new Map(
      ROUTE_IDS.map((route) => [ROUTE_SEGMENTS[route][locale], route] as const),
    ) as ReverseMap,
  ]),
) as Record<Locale, ReverseMap>;

/** Public segment → canonical route id, for a locale. */
export function routeFromSegment(value: string, locale: Locale): RouteId | undefined {
  return REVERSE[locale].get(value);
}

export type ParsedPath = {
  locale: Locale;
  /** Canonical route segments, e.g. ["cart", "checkout"] or ["product", "slug"]. */
  canonical: string[];
  /** Segments after the route (entity slug, section id, …). */
  rest: string[];
  route?: RouteId;
};

/**
 * Splits a public pathname into its locale, canonical route and trailing
 * segments. Returns `null` when the first segment is not a supported locale.
 */
export function parsePublicPath(pathname: string): ParsedPath | null {
  const raw = pathname.split("/").filter(Boolean);
  const [maybeLocale, ...tail] = raw;
  if (!isLocale(maybeLocale)) return null;

  const locale = maybeLocale;
  if (tail.length === 0) return { locale, canonical: [], rest: [] };

  const first = routeFromSegment(tail[0], locale);
  if (!first) return { locale, canonical: [tail[0]], rest: tail.slice(1) };

  // A nested localized segment (cart/checkout) needs a second translation pass.
  const second = tail[1] ? routeFromSegment(tail[1], locale) : undefined;
  if (second && NESTED_UNDER[second] === first) {
    return { locale, canonical: [first, second], rest: tail.slice(2), route: second };
  }

  return { locale, canonical: [first], rest: tail.slice(1), route: first };
}

/** Public path → the internal path that matches the `app/` folder names. */
export function toCanonicalPath(pathname: string): string | null {
  const parsed = parsePublicPath(pathname);
  if (!parsed) return null;

  const folders = parsed.canonical.map(
    (id) => CANONICAL_SEGMENT[id as RouteId] ?? id,
  );

  return `/${[parsed.locale, ...folders, ...parsed.rest].join("/")}`;
}

/**
 * Re-renders a public path in another locale, translating route segments only.
 * Entity slugs are locale-specific, so pages that own one supply explicit
 * alternates instead of relying on this.
 */
export function translateRouteSegments(pathname: string, target: Locale): string {
  const parsed = parsePublicPath(pathname);
  if (!parsed) return `/${target}`;

  const parts: string[] = [target];
  for (const canonical of parsed.canonical) {
    parts.push(
      (ROUTE_IDS as readonly string[]).includes(canonical)
        ? segment(canonical as RouteId, target)
        : canonical,
    );
  }
  parts.push(...parsed.rest);

  return `/${parts.join("/")}`;
}

/** Locale prefix used when none is present in the URL. */
export const FALLBACK_PREFIX = `/${DEFAULT_LOCALE}`;
