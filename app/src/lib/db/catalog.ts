import { cache } from "react";
import type { ArtPrint, ArtShape } from "@/components/brand/product-art";
import {
  colorway,
  compareSizes,
  parseFramePreview,
  parseProductVideo,
  parseSizeGuide,
  type Audience,
  type Author,
  type AuthorWork,
  type Catalog,
  type Category,
  type Collection,
  type Credit,
  type FramingSettings,
  type Product,
  type ProductImage,
  type Variant,
} from "@/lib/catalog";
import { getFramingSettings } from "@/lib/db/settings";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";

/* ============================================================ localisation */

type Bundle = Record<string, unknown> | null | undefined;

/** Resolves a localized JSONB column, falling back to Castellano. */
function text(bundle: Bundle, locale: Locale): string {
  if (!bundle) return "";
  const value = bundle[locale] ?? bundle[DEFAULT_LOCALE];
  return typeof value === "string" ? value : "";
}

function list(bundle: Bundle, locale: Locale): string[] {
  if (!bundle) return [];
  const value = bundle[locale] ?? bundle[DEFAULT_LOCALE];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/** Every locale's variant of a slug, used for hreflang alternates. */
function slugs(bundle: Bundle): Record<Locale, string> {
  const fallback = text(bundle, DEFAULT_LOCALE);
  return Object.fromEntries(
    LOCALES.map((locale) => [locale, text(bundle, locale) || fallback]),
  ) as Record<Locale, string>;
}

/* ================================================================== rows */

type CategoryRow = {
  id: string;
  slug: Bundle;
  name: Bundle;
  heading: Bundle;
  blurb: Bundle;
  keywords: Bundle;
  position: number;
};

type CollectionRow = CategoryRow & { tagline: Bundle; accent: string };

type VariantRow = {
  id: string;
  size: string;
  colorway_id: string;
  sku: string | null;
  stock: number;
  price_delta_cents: number;
  position: number;
};

type ImageRow = {
  id: string;
  storage_path: string;
  alt: Bundle;
  colorway_id: string | null;
  position: number;
};

type CreditRow = {
  author_id: string;
  role: Bundle;
  position: number;
  authors: { id: string; name: string; slug: Bundle } | null;
};

type ProductRow = {
  id: string;
  ref: string;
  slug: Bundle;
  name: Bundle;
  description: Bundle;
  details: Bundle;
  keywords: Bundle;
  category_id: string;
  collection_id: string | null;
  audience: Audience;
  shape: ArtShape;
  print: ArtPrint;
  price_cents: number;
  compare_at_cents: number | null;
  colorways: unknown;
  size_guide: unknown;
  frame_preview: unknown;
  video_url: string | null;
  video_caption: Bundle;
  artwork_printable: boolean;
  rating: number | string;
  reviews: number;
  bestseller: boolean;
  exclusive: boolean;
  published: boolean;
  arrived: number;
  product_variants: VariantRow[] | null;
  product_images: ImageRow[] | null;
  product_authors: CreditRow[] | null;
};

type WorkRow = {
  id: string;
  year: number | null;
  title: string;
  publisher: string | null;
  kind: string;
  url: string | null;
  note: Bundle;
  position: number;
};

type AuthorRow = {
  id: string;
  slug: Bundle;
  name: string;
  role: Bundle;
  bio: Bundle;
  statement: Bundle;
  photo_path: string | null;
  links: unknown;
  keywords: Bundle;
  position: number;
  author_works: WorkRow[] | null;
};

/* =============================================================== mappers */

function mapCategory(row: CategoryRow, locale: Locale): Category {
  return {
    id: row.id,
    slug: text(row.slug, locale),
    slugs: slugs(row.slug),
    name: text(row.name, locale),
    heading: text(row.heading, locale),
    blurb: text(row.blurb, locale),
    keywords: list(row.keywords, locale),
  };
}

function mapCollection(row: CollectionRow, locale: Locale): Collection {
  return {
    ...mapCategory(row, locale),
    tagline: text(row.tagline, locale),
    accent: row.accent,
  };
}

function mapWork(row: WorkRow, locale: Locale): AuthorWork {
  return {
    id: row.id,
    year: row.year,
    title: row.title,
    publisher: row.publisher,
    kind: row.kind,
    url: row.url,
    note: text(row.note, locale) || null,
  };
}

function mapAuthor(row: AuthorRow, locale: Locale): Author {
  const links = Array.isArray(row.links)
    ? row.links.filter(
        (link): link is { label: string; url: string } =>
          typeof link === "object" &&
          link !== null &&
          typeof (link as { label?: unknown }).label === "string" &&
          typeof (link as { url?: unknown }).url === "string",
      )
    : [];

  return {
    id: row.id,
    slug: text(row.slug, locale),
    slugs: slugs(row.slug),
    name: row.name,
    role: text(row.role, locale),
    bio: text(row.bio, locale),
    statement: text(row.statement, locale) || null,
    photoPath: row.photo_path,
    links,
    keywords: list(row.keywords, locale),
    works: (row.author_works ?? [])
      .slice()
      .sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || a.position - b.position)
      .map((work) => mapWork(work, locale)),
  };
}

/**
 * `framing` is the shop's frame prices, folded into every product here so that
 * anything holding a `Product` — a listing card, a cross-sell tile, the buybox,
 * the server that prices an order — can price a frame without a settings query of
 * its own. A piece that prices its own frames ignores them.
 */
function mapProduct(row: ProductRow, locale: Locale, framing: FramingSettings): Product {
  const variants: Variant[] = (row.product_variants ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((v) => ({
      id: v.id,
      size: v.size,
      colorwayId: v.colorway_id,
      sku: v.sku,
      stock: v.stock,
      priceDeltaCents: v.price_delta_cents ?? 0,
    }));

  // Display order comes from the product's own colourway list; stock comes from
  // the variants, so the two can never disagree about what exists.
  const declared = Array.isArray(row.colorways)
    ? row.colorways.filter((id): id is string => typeof id === "string")
    : [];
  const fromVariants = [...new Set(variants.map((v) => v.colorwayId))];
  const colorIds = declared.length ? declared : fromVariants;

  const sizes = [...new Set(variants.map((v) => v.size))].sort(compareSizes);
  const soldOutSizes = sizes.filter((size) =>
    variants.filter((v) => v.size === size).every((v) => v.stock <= 0),
  );

  const images: ProductImage[] = (row.product_images ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((image) => ({
      id: image.id,
      path: image.storage_path,
      alt: text(image.alt, locale) || null,
      colorwayId: image.colorway_id,
    }));

  const credits: Credit[] = (row.product_authors ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .flatMap((credit) =>
      credit.authors
        ? [
            {
              authorId: credit.authors.id,
              slug: text(credit.authors.slug, locale),
              name: credit.authors.name,
              role: text(credit.role, locale) || null,
            },
          ]
        : [],
    );

  return {
    id: row.id,
    ref: row.ref,
    slug: text(row.slug, locale),
    slugs: slugs(row.slug),
    name: text(row.name, locale),
    description: text(row.description, locale),
    details: list(row.details, locale),
    keywords: list(row.keywords, locale),
    categoryId: row.category_id,
    collectionId: row.collection_id,
    audience: row.audience,
    shape: row.shape,
    print: row.print,
    price: row.price_cents,
    compareAt: row.compare_at_cents ?? undefined,
    colorways: colorIds.map((id) => colorway(id, locale)),
    sizes,
    soldOutSizes,
    sizeGuide: parseSizeGuide(row.size_guide),
    framePreview: parseFramePreview(row.frame_preview, framing),
    video: parseProductVideo(row.video_url, text(row.video_caption, locale)),
    artworkPrintable: row.artwork_printable === true,
    variants,
    images,
    credits,
    rating: Number(row.rating),
    reviews: row.reviews,
    bestseller: row.bestseller,
    exclusive: row.exclusive,
    published: row.published,
    arrived: row.arrived,
  };
}

/* =============================================================== selects */

const PRODUCT_SELECT = `
  id, ref, slug, name, description, details, keywords,
  category_id, collection_id, audience, shape, print,
  price_cents, compare_at_cents, colorways, size_guide, frame_preview,
  video_url, video_caption, artwork_printable,
  rating, reviews, bestseller, exclusive, published, arrived,
  product_variants ( id, size, colorway_id, sku, stock, price_delta_cents, position ),
  product_images ( id, storage_path, alt, colorway_id, position ),
  product_authors ( author_id, role, position, authors ( id, name, slug ) )
`;

const AUTHOR_SELECT = `
  id, slug, name, role, bio, statement, photo_path, links, keywords, position,
  author_works ( id, year, title, publisher, kind, url, note, position )
`;

/* =============================================================== fetching */

/**
 * The whole published catalogue for one locale.
 *
 * Wrapped in React's `cache()` so several components in the same render share
 * one round trip. Reads go through the visitor's own Supabase client, so RLS
 * decides what comes back: unpublished rows are invisible to the public and
 * visible to admins, with no branching in this code.
 */
export const getCatalog = cache(async (locale: Locale): Promise<Catalog> => {
  const supabase = await createClient();

  // The shop's frame prices travel with the catalogue: they are part of what a
  // cuadro costs, and reading them here is what keeps every card and every buybox
  // out of the settings table.
  const [categories, collections, products, authors, framing] = await Promise.all([
    supabase.from("categories").select("*").order("position"),
    supabase.from("collections").select("*").order("position"),
    supabase.from("products").select(PRODUCT_SELECT).order("arrived", { ascending: false }),
    supabase.from("authors").select(AUTHOR_SELECT).order("position"),
    getFramingSettings(),
  ]);

  const failure = [categories, collections, products, authors].find((result) => result.error);
  if (failure?.error) {
    throw new Error(`No se pudo cargar el catálogo: ${failure.error.message}`);
  }

  return {
    locale,
    categories: ((categories.data ?? []) as unknown as CategoryRow[]).map((row) =>
      mapCategory(row, locale),
    ),
    collections: ((collections.data ?? []) as unknown as CollectionRow[]).map((row) =>
      mapCollection(row, locale),
    ),
    products: ((products.data ?? []) as unknown as ProductRow[]).map((row) =>
      mapProduct(row, locale, framing),
    ),
    authors: ((authors.data ?? []) as unknown as AuthorRow[]).map((row) =>
      mapAuthor(row, locale),
    ),
  };
});

/* ================================================================ lookups */

export function findCategory(catalog: Catalog, slug: string): Category | undefined {
  return catalog.categories.find((c) => c.slug === slug || c.id === slug);
}

export function findCollection(catalog: Catalog, slug: string): Collection | undefined {
  return catalog.collections.find((c) => c.slug === slug || c.id === slug);
}

export function findProduct(catalog: Catalog, slug: string): Product | undefined {
  return (
    catalog.products.find((p) => p.slug === slug) ??
    // Tolerate a slug from another language so old links keep resolving.
    catalog.products.find((p) => Object.values(p.slugs).includes(slug))
  );
}

export function findAuthor(catalog: Catalog, slug: string): Author | undefined {
  return (
    catalog.authors.find((a) => a.slug === slug) ??
    catalog.authors.find((a) => Object.values(a.slugs).includes(slug))
  );
}

export function productsByAuthor(catalog: Catalog, authorId: string): Product[] {
  return catalog.products.filter((p) => p.credits.some((c) => c.authorId === authorId));
}
