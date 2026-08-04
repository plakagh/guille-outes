import {
  allSizes,
  AUDIENCE_IDS,
  COLORWAYS,
  colorway,
  facetCounts,
  SORT_KEYS,
  type Audience,
  type Catalog,
  type Filters,
  type SortKey,
} from "@/lib/catalog";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";

export type SearchParamsInput = Record<string, string | string[] | undefined>;

/**
 * Query-string keys. Deliberately short and language-neutral: the *path* is what
 * gets indexed per locale, while refinements are ephemeral state.
 */
export const QK = {
  category: "cat",
  audience: "genero",
  collection: "coleccion",
  color: "color",
  size: "talla",
  author: "autor",
  maxPrice: "max",
  onSale: "oferta",
  sort: "sort",
  page: "pagina",
  query: "q",
} as const;

export const PAGE_SIZE = 24;

function list(input: SearchParamsInput, key: string): string[] {
  const raw = input[key];
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return values.flatMap((value) => value.split(",")).filter(Boolean);
}

const AUDIENCE_SET = new Set<string>(AUDIENCE_IDS);
const COLOR_SET = new Set<string>(Object.keys(COLORWAYS));
const SIZE_SET = new Set<string>(allSizes());
const SORT_SET = new Set<string>(SORT_KEYS);

/**
 * Turns raw search params into catalog filters, dropping anything the catalogue
 * does not know about so a hand-edited URL can never produce a broken query or
 * reach data it should not.
 */
export function parseFilters(
  input: SearchParamsInput,
  catalog: Catalog,
  base: Filters = {},
): Filters {
  const categoryIds = new Set(catalog.categories.map((c) => c.id));
  const collectionIds = new Set(catalog.collections.map((c) => c.id));
  const authorIds = new Set(catalog.authors.map((a) => a.id));

  const categories = list(input, QK.category).filter((v) => categoryIds.has(v));
  const audiences = list(input, QK.audience).filter((v) => AUDIENCE_SET.has(v)) as Audience[];
  const collections = list(input, QK.collection).filter((v) => collectionIds.has(v));
  const colors = list(input, QK.color).filter((v) => COLOR_SET.has(v));
  const sizes = list(input, QK.size).filter((v) => SIZE_SET.has(v));
  const authors = list(input, QK.author).filter((v) => authorIds.has(v));

  const rawMax = Number(input[QK.maxPrice]);
  const maxPrice = Number.isFinite(rawMax) && rawMax > 0 ? rawMax : undefined;

  const rawSort = typeof input[QK.sort] === "string" ? (input[QK.sort] as string) : undefined;
  const sort = rawSort && SORT_SET.has(rawSort) ? (rawSort as SortKey) : base.sort;

  return {
    // A route preset (e.g. /es/tienda/camisetas) wins over the query string, so
    // a section page can never be widened by editing the URL.
    categories: base.categories ?? (categories.length ? categories : undefined),
    audiences: base.audiences ?? (audiences.length ? audiences : undefined),
    collections: base.collections ?? (collections.length ? collections : undefined),
    authors: base.authors ?? (authors.length ? authors : undefined),
    colors: colors.length ? colors : undefined,
    sizes: sizes.length ? sizes : undefined,
    maxPrice,
    onSale: base.onSale ?? input[QK.onSale] === "1",
    sort,
  };
}

export function parsePage(input: SearchParamsInput): number {
  const raw = Number(input[QK.page]);
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;
}

export function readQuery(input: SearchParamsInput): string {
  const raw = input[QK.query];
  return (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
}

/* ================================================================= facets */

export type FacetOption = {
  value: string;
  label: string;
  count: number;
  /** Present on colour options so the control can draw a swatch. */
  base?: string;
  trim?: string;
};

export type FacetGroup = {
  key: string;
  heading: string;
  kind: "check" | "swatch" | "chip";
  options: FacetOption[];
};

/** Facet groups for a listing page, minus whichever dimension the route locks. */
export function buildFacets(
  catalog: Catalog,
  filters: Filters,
  t: Dictionary,
  locale: Locale,
  locked: string[] = [],
): FacetGroup[] {
  const { products } = catalog;
  const groups: FacetGroup[] = [];

  if (!locked.includes(QK.category)) {
    const ids = catalog.categories.map((c) => c.id);
    const counts = facetCounts(products, filters, "categories", ids);
    groups.push({
      key: QK.category,
      heading: t.plp.category,
      kind: "check",
      options: catalog.categories.map((c) => ({
        value: c.id,
        label: c.name,
        count: counts[c.id],
      })),
    });
  }

  if (!locked.includes(QK.audience)) {
    const counts = facetCounts(products, filters, "audiences", AUDIENCE_IDS);
    const labels: Record<Audience, string> = {
      hombre: t.nav.men,
      mujer: t.nav.women,
      ninos: t.nav.kids,
      unisex: t.nav.everyone,
    };
    groups.push({
      key: QK.audience,
      heading: t.plp.audience,
      kind: "check",
      options: AUDIENCE_IDS.map((id) => ({
        value: id,
        label: labels[id],
        count: counts[id],
      })),
    });
  }

  if (!locked.includes(QK.collection)) {
    const ids = catalog.collections.map((c) => c.id);
    const counts = facetCounts(products, filters, "collections", ids);
    groups.push({
      key: QK.collection,
      heading: t.plp.collection,
      kind: "check",
      options: catalog.collections.map((c) => ({
        value: c.id,
        label: c.name,
        count: counts[c.id],
      })),
    });
  }

  if (!locked.includes(QK.author)) {
    const ids = catalog.authors.map((a) => a.id);
    const counts = facetCounts(products, filters, "authors", ids);
    const options = catalog.authors
      .map((a) => ({ value: a.id, label: a.name, count: counts[a.id] }))
      .filter((option) => option.count > 0);
    if (options.length > 1) {
      groups.push({
        key: QK.author,
        heading: t.pdp.creditsHeading,
        kind: "check",
        options,
      });
    }
  }

  const sizeValues = allSizes();
  const sizeCounts = facetCounts(products, filters, "sizes", sizeValues);
  groups.push({
    key: QK.size,
    heading: t.plp.size,
    kind: "chip",
    options: sizeValues
      .map((size) => ({ value: size, label: size, count: sizeCounts[size] }))
      .filter((option) => option.count > 0),
  });

  const colorIds = Object.keys(COLORWAYS);
  const colorCounts = facetCounts(products, filters, "colors", colorIds);
  groups.push({
    key: QK.color,
    heading: t.common.color,
    kind: "swatch",
    options: colorIds
      .map((id) => {
        const swatch = colorway(id, locale);
        return {
          value: id,
          label: swatch.name,
          count: colorCounts[id],
          base: swatch.base,
          trim: swatch.trim,
        };
      })
      .filter((option) => option.count > 0),
  });

  return groups;
}

/** Chips shown above the grid for every active refinement. */
export function activeChips(
  input: SearchParamsInput,
  facets: FacetGroup[],
  t: Dictionary,
): { key: string; value: string; label: string }[] {
  const chips: { key: string; value: string; label: string }[] = [];

  for (const group of facets) {
    for (const value of list(input, group.key)) {
      const option = group.options.find((o) => o.value === value);
      if (option) chips.push({ key: group.key, value, label: option.label });
    }
  }

  const max = Number(input[QK.maxPrice]);
  if (Number.isFinite(max) && max > 0) {
    chips.push({
      key: QK.maxPrice,
      value: String(max),
      label: `${t.plp.upTo} ${(max / 100).toFixed(0)} €`,
    });
  }

  if (input[QK.onSale] === "1") {
    chips.push({ key: QK.onSale, value: "1", label: t.plp.onSale });
  }

  return chips;
}
