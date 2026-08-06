import type {
  ArtOrientation,
  ArtPrint,
  ArtShape,
  Colorway,
} from "@/components/brand/product-art";
import type { Locale } from "@/lib/i18n/config";

/* ============================================================== colorways */

/**
 * The colour palette lives in code, not the database: it is part of the design
 * system (it drives the generated vector artwork), and the admin picks from it
 * rather than inventing hex values.
 */
export const COLORWAYS = {
  negro: { id: "negro", name: "Negro", base: "#141414", trim: "#ffffff", print: "#ffffff" },
  blanco: { id: "blanco", name: "Blanco", base: "#f1f1ef", trim: "#141414", print: "#141414" },
  hueso: { id: "hueso", name: "Hueso", base: "#e5dfd2", trim: "#2b2b2b" },
  gris: { id: "gris", name: "Gris jaspeado", base: "#b8bbbf", trim: "#2b2b2b" },
  marino: { id: "marino", name: "Azul marino", base: "#152a52", trim: "#f4f4f4" },
  electrico: { id: "electrico", name: "Azul eléctrico", base: "#1d4ed8", trim: "#ffffff" },
  granate: { id: "granate", name: "Granate", base: "#7a1225", trim: "#f0e2c8" },
  rojo: { id: "rojo", name: "Rojo", base: "#c8102e", trim: "#ffffff" },
  verde: { id: "verde", name: "Verde pino", base: "#0f7a4f", trim: "#f6e7a6" },
  arena: { id: "arena", name: "Arena", base: "#c9b791", trim: "#20211f" },
  naranja: { id: "naranja", name: "Naranja", base: "#e2620f", trim: "#1b1b1b" },
  morado: { id: "morado", name: "Morado", base: "#52247f", trim: "#f2c94c" },
} satisfies Record<string, Colorway>;

export type ColorwayId = keyof typeof COLORWAYS;

/** Colour names per locale; the palette ids stay stable across languages. */
const COLOR_NAMES: Record<Locale, Record<ColorwayId, string>> = {
  es: {
    negro: "Negro",
    blanco: "Blanco",
    hueso: "Hueso",
    gris: "Gris jaspeado",
    marino: "Azul marino",
    electrico: "Azul eléctrico",
    granate: "Granate",
    rojo: "Rojo",
    verde: "Verde pino",
    arena: "Arena",
    naranja: "Naranja",
    morado: "Morado",
  },
  gl: {
    negro: "Negro",
    blanco: "Branco",
    hueso: "Óso",
    gris: "Gris xaspeado",
    marino: "Azul mariño",
    electrico: "Azul eléctrico",
    granate: "Granate",
    rojo: "Vermello",
    verde: "Verde piñeiro",
    arena: "Area",
    naranja: "Laranxa",
    morado: "Morado",
  },
  en: {
    negro: "Black",
    blanco: "White",
    hueso: "Bone",
    gris: "Heather grey",
    marino: "Navy",
    electrico: "Electric blue",
    granate: "Maroon",
    rojo: "Red",
    verde: "Pine green",
    arena: "Sand",
    naranja: "Orange",
    morado: "Purple",
  },
};

export function isColorwayId(value: string): value is ColorwayId {
  return value in COLORWAYS;
}

/** Palette entry with its name resolved for the current locale. */
export function colorway(id: string, locale: Locale): Colorway {
  const key = isColorwayId(id) ? id : "negro";
  return { ...COLORWAYS[key], name: COLOR_NAMES[locale][key] };
}

export function palette(locale: Locale): Colorway[] {
  return (Object.keys(COLORWAYS) as ColorwayId[]).map((id) => colorway(id, locale));
}

/* ================================================================== sizes */

export const APPAREL_SIZES = ["XS", "S", "M", "L", "XL", "2XL"];
export const KIDS_SIZES = ["4", "6", "8", "10", "12", "14"];
export const ONE_SIZE = "Única";

/** Every size that can appear in the catalogue, in display order. */
export function allSizes(): string[] {
  return [...APPAREL_SIZES, ...KIDS_SIZES, ONE_SIZE];
}

const SIZE_ORDER = new Map(allSizes().map((size, index) => [size, index]));

export function compareSizes(a: string, b: string): number {
  return (SIZE_ORDER.get(a) ?? 99) - (SIZE_ORDER.get(b) ?? 99);
}

/* =========================================================== size guides */

/**
 * The size guide belongs to the product, not to the shop.
 *
 * A size L jersey and a size L tee are not the same garment, and the useful
 * measurements differ between them — a tee has no inseam. So each product
 * carries measurements for *its own* sizes, in centimetres.
 *
 * Only the numbers are stored. The dimension keys below are labelled from the
 * dictionaries, which is what keeps the guide trilingual without asking whoever
 * fills it in to translate "chest" three times.
 */
export const SIZE_DIMENSIONS = [
  "chest",
  "length",
  "shoulder",
  "sleeve",
  "waist",
  "hip",
  "inseam",
  "head",
  "width",
] as const;

export type SizeDimension = (typeof SIZE_DIMENSIONS)[number];

export function isSizeDimension(value: string): value is SizeDimension {
  return (SIZE_DIMENSIONS as readonly string[]).includes(value);
}

export type SizeGuide = {
  dimensions: SizeDimension[];
  /** Keyed by the product's own size names, then by dimension. */
  measurements: Record<string, Partial<Record<SizeDimension, number>>>;
};

/**
 * Which measurements are worth showing for each garment, and a starting set of
 * numbers for a mid size.
 *
 * This is a baseline, not the truth: it is what a product falls back to before
 * anyone has filled in its own table, and what the admin form is pre-filled
 * with so the numbers only need correcting rather than typing from nothing.
 * Products where a size guide would be noise (a ball, a bottle, a poster) get
 * no dimensions and therefore no table.
 */
const SHAPE_BASELINE: Record<ArtShape, { dimensions: SizeDimension[]; base: number[] }> = {
  // [values in the order of `dimensions`, for the middle size]
  tee: { dimensions: ["chest", "length", "shoulder", "sleeve"], base: [52, 71, 45, 21] },
  hoodie: { dimensions: ["chest", "length", "shoulder", "sleeve"], base: [58, 70, 50, 62] },
  jersey: { dimensions: ["chest", "length", "shoulder"], base: [55, 74, 41] },
  jacket: { dimensions: ["chest", "length", "shoulder", "sleeve"], base: [57, 68, 47, 63] },
  shorts: { dimensions: ["waist", "hip", "length", "inseam"], base: [39, 54, 47, 23] },
  cap: { dimensions: ["head"], base: [57] },
  beanie: { dimensions: ["head"], base: [56] },
  tote: { dimensions: ["length", "width"], base: [42, 37] },
  // A ball, a bottle and a poster come in one size; a table would be noise.
  ball: { dimensions: [], base: [] },
  bottle: { dimensions: [], base: [] },
  poster: { dimensions: [], base: [] },
};

/**
 * How much a dimension grows per size step.
 *
 * Real grading is not uniform, but it is close enough to be a sensible starting
 * point for someone who will then correct the numbers. Girth grows faster than
 * length; a hat band barely changes.
 *
 * Every dimension is in centimetres, which is what lets the table print one unit
 * for the whole row.
 */
const STEP: Record<SizeDimension, number> = {
  chest: 3,
  length: 2,
  shoulder: 1.5,
  sleeve: 1,
  waist: 3,
  hip: 3,
  inseam: 1,
  head: 1,
  width: 1,
};

const EMPTY_GUIDE: SizeGuide = { dimensions: [], measurements: {} };

/**
 * A baseline table for one product: the shape's dimensions, graded across the
 * sizes this product is actually sold in.
 */
export function baselineSizeGuide(shape: ArtShape, sizes: string[]): SizeGuide {
  const spec = SHAPE_BASELINE[shape];
  if (!spec || spec.dimensions.length === 0 || sizes.length === 0) return EMPTY_GUIDE;

  const ordered = [...sizes].sort(compareSizes);
  // Grade outwards from the middle size so the baseline numbers land there.
  const middle = Math.floor((ordered.length - 1) / 2);

  const measurements: SizeGuide["measurements"] = {};
  ordered.forEach((size, index) => {
    const row: Partial<Record<SizeDimension, number>> = {};
    spec.dimensions.forEach((dimension, column) => {
      const value = spec.base[column] + (index - middle) * STEP[dimension];
      // Half-centimetre precision; nobody measures a garment finer than that.
      row[dimension] = Math.round(value * 2) / 2;
    });
    measurements[size] = row;
  });

  return { dimensions: spec.dimensions, measurements };
}

/** Reads a stored guide, ignoring anything malformed rather than throwing. */
export function parseSizeGuide(value: unknown): SizeGuide | null {
  if (typeof value !== "object" || value === null) return null;

  const raw = value as { dimensions?: unknown; measurements?: unknown };
  const dimensions = Array.isArray(raw.dimensions)
    ? raw.dimensions.filter((d): d is SizeDimension => typeof d === "string" && isSizeDimension(d))
    : [];

  if (dimensions.length === 0) return null;

  const measurements: SizeGuide["measurements"] = {};
  if (typeof raw.measurements === "object" && raw.measurements !== null) {
    for (const [size, row] of Object.entries(raw.measurements as Record<string, unknown>)) {
      if (typeof row !== "object" || row === null) continue;
      const parsed: Partial<Record<SizeDimension, number>> = {};
      for (const dimension of dimensions) {
        const cell = (row as Record<string, unknown>)[dimension];
        const number = typeof cell === "number" ? cell : Number(cell);
        if (Number.isFinite(number) && number > 0) parsed[dimension] = number;
      }
      if (Object.keys(parsed).length > 0) measurements[size] = parsed;
    }
  }

  return Object.keys(measurements).length > 0 ? { dimensions, measurements } : null;
}

/**
 * The guide to show for a product: its own if someone has filled it in, the
 * baseline for its shape otherwise, and null when a table would be meaningless.
 */
export function resolveSizeGuide(product: {
  shape: ArtShape;
  sizes: string[];
  sizeGuide: SizeGuide | null;
}): SizeGuide | null {
  if (product.sizeGuide) {
    // Only show rows for sizes this product actually has, in display order.
    const dimensions = product.sizeGuide.dimensions;
    const measurements: SizeGuide["measurements"] = {};
    for (const size of [...product.sizes].sort(compareSizes)) {
      const row = product.sizeGuide.measurements[size];
      if (row) measurements[size] = row;
    }
    if (Object.keys(measurements).length > 0) return { dimensions, measurements };
  }

  const baseline = baselineSizeGuide(product.shape, product.sizes);
  return baseline.dimensions.length > 0 ? baseline : null;
}

/* ========================================================== framed prints */

/**
 * "See it framed".
 *
 * A cuadro is sold as a piece of paper; what a buyer wants to know is how it will
 * look on a wall. The preview is drawn in CSS around the product's own artwork —
 * frame, white mount, bevel — so it works for every colourway and every print
 * without a single photograph, which is the same reason the product art itself is
 * generated rather than shot.
 *
 * Which finishes are offered is a property of the piece, not of the shop: a
 * numbered serigraph may only be sold in black. So it is stored per product.
 */
export const FRAME_FINISHES = ["black", "white", "wood"] as const;

export type FrameFinish = (typeof FRAME_FINISHES)[number];

export function isFrameFinish(value: string): value is FrameFinish {
  return (FRAME_FINISHES as readonly string[]).includes(value);
}

export type FramePreview = {
  /** Ordered; the first is what the preview opens with. */
  finishes: FrameFinish[];
  /** Mount width as a percentage of the artwork's shorter side. */
  mount: number;
  /**
   * Printed size of the artwork in centimetres, mount and moulding excluded.
   *
   * Only the wall view needs this, and it needs it badly: an overlay at the wrong
   * scale is worse than no overlay. Everything else about the frame is relative,
   * so these two numbers are the only physical fact the preview stores.
   */
  width: number;
  height: number;
};

/** Sensible framing for a product someone has just ticked "show framed" on. */
export const DEFAULT_FRAME_PREVIEW: FramePreview = {
  finishes: [...FRAME_FINISHES],
  mount: 10,
  // 50 × 70 is the standard European poster size, and what both pieces in the
  // catalogue are printed at.
  width: 50,
  height: 70,
};

/** Below a postcard or above a doorway, it is a typo rather than a measurement. */
export const FRAME_MIN_CM = 5;
export const FRAME_MAX_CM = 300;

/**
 * Reads a stored `frame_preview`, returning null when the product is not sold
 * framed — which is the case for everything that is not a cuadro.
 */
export function parseFramePreview(value: unknown): FramePreview | null {
  if (typeof value !== "object" || value === null) return null;

  const raw = value as {
    enabled?: unknown;
    finishes?: unknown;
    mount?: unknown;
    width?: unknown;
    height?: unknown;
  };
  if (raw.enabled !== true) return null;

  const finishes = Array.isArray(raw.finishes)
    ? raw.finishes.filter((item): item is FrameFinish => typeof item === "string" && isFrameFinish(item))
    : [];

  // Enabled but with every finish removed is a contradiction; treat the whole
  // preview as off rather than rendering a frameless "frame".
  if (finishes.length === 0) return null;

  const mount = typeof raw.mount === "number" ? raw.mount : Number(raw.mount);

  return {
    finishes,
    mount: Number.isFinite(mount) && mount >= 0 && mount <= 30 ? mount : DEFAULT_FRAME_PREVIEW.mount,
    // Rows written before the wall view existed have no measurements. Falling
    // back to the standard size keeps the feature available on them rather than
    // hiding it until someone edits the product.
    width: frameCm(raw.width, DEFAULT_FRAME_PREVIEW.width),
    height: frameCm(raw.height, DEFAULT_FRAME_PREVIEW.height),
  };
}

/**
 * Which way up the piece hangs.
 *
 * Derived from the measurements rather than stored beside them: a 70 × 50 *is*
 * landscape, and a separate flag could only ever contradict the numbers it sits
 * next to. Square counts as portrait, which is what the drawing does with it.
 */
export function frameOrientation(frame: FramePreview): ArtOrientation {
  return frame.width > frame.height ? "landscape" : "portrait";
}

/** The printed proportions, for the CSS box that holds the artwork. */
export function frameAspect(frame: FramePreview): string {
  return `${frame.width} / ${frame.height}`;
}

/** A stored measurement in centimetres, or the fallback when it is unusable. */
function frameCm(value: unknown, fallback: number): number {
  const cm = typeof value === "number" ? value : Number(value);
  return Number.isFinite(cm) && cm >= FRAME_MIN_CM && cm <= FRAME_MAX_CM ? cm : fallback;
}

/* ================================================================== video */

/**
 * The product video.
 *
 * Where it plays from decides how it plays: a platform page becomes an embed, a
 * file becomes a `<video>` tag. Anything we cannot recognise as one of the two is
 * not stored at all — a src the browser will not play is worse than no video,
 * because the zone would appear empty.
 */
export type VideoProvider = "youtube" | "vimeo" | "file";

export type ProductVideo = {
  provider: VideoProvider;
  /** What the player loads: the embed for a platform, the file itself otherwise. */
  src: string;
  /** The address as typed, for the "watch it there" link. */
  url: string;
  /** The caption under the player; null when nobody wrote one. */
  caption: string | null;
};

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "m.youtube.com",
  "youtube-nocookie.com",
  "youtu.be",
]);
const VIMEO_HOSTS = new Set(["vimeo.com", "player.vimeo.com"]);

/** A file we can hand straight to a `<video>` element. */
const VIDEO_FILE = /\.(mp4|webm|ogv|mov)$/i;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,20}$/;
const VIMEO_ID = /^\d{6,12}$/;

/**
 * Reads a typed address into something playable, or null.
 *
 * Shared by the storefront and the admin form: the panel refuses to save an
 * address this cannot make sense of, which is why the storefront never has to
 * cope with one.
 */
export function parseVideoUrl(raw: string): Omit<ProductVideo, "caption"> | null {
  const url = raw.trim();
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  // A video over http breaks a page served over https, and a `javascript:` src
  // is not a video at all.
  if (parsed.protocol !== "https:") return null;

  const host = parsed.hostname.replace(/^www\./, "");
  /** The last non-empty path segment: the id in every URL shape below. */
  const tail = parsed.pathname.split("/").filter(Boolean).pop() ?? "";

  if (YOUTUBE_HOSTS.has(host)) {
    // youtu.be/<id>, /watch?v=<id>, /shorts/<id>, /embed/<id> — all the same video.
    const id = parsed.searchParams.get("v") ?? tail;
    if (!YOUTUBE_ID.test(id)) return null;
    return {
      provider: "youtube",
      // nocookie, and no related videos from other channels at the end.
      src: `https://www.youtube-nocookie.com/embed/${id}?rel=0`,
      url,
    };
  }

  if (VIMEO_HOSTS.has(host)) {
    if (!VIMEO_ID.test(tail)) return null;
    // dnt=1 asks Vimeo not to track the viewer.
    return { provider: "vimeo", src: `https://player.vimeo.com/video/${tail}?dnt=1`, url };
  }

  if (VIDEO_FILE.test(parsed.pathname)) {
    return { provider: "file", src: url, url };
  }

  return null;
}

/** A stored `video_url` + `video_caption` pair, or null when there is no video. */
export function parseProductVideo(url: unknown, caption: string): ProductVideo | null {
  const video = typeof url === "string" ? parseVideoUrl(url) : null;
  if (!video) return null;
  return { ...video, caption: caption.trim() || null };
}

/* ================================================================= shapes */

export type CategoryId = string;
export type Audience = "hombre" | "mujer" | "ninos" | "unisex";

export const AUDIENCE_IDS: Audience[] = ["hombre", "mujer", "ninos", "unisex"];

/** A localized string bundle as stored in Postgres. */
export type I18nText = Partial<Record<Locale, string>> & { es: string };
export type I18nList = Partial<Record<Locale, string[]>>;

export type Category = {
  id: CategoryId;
  slug: string;
  slugs: Record<Locale, string>;
  name: string;
  heading: string;
  blurb: string;
  keywords: string[];
};

export type Collection = {
  id: string;
  slug: string;
  slugs: Record<Locale, string>;
  name: string;
  tagline: string;
  blurb: string;
  keywords: string[];
  accent: string;
};

export type AuthorWork = {
  id: string;
  year: number | null;
  title: string;
  publisher: string | null;
  kind: string;
  url: string | null;
  note: string | null;
};

export type Author = {
  id: string;
  slug: string;
  slugs: Record<Locale, string>;
  name: string;
  role: string;
  bio: string;
  statement: string | null;
  photoPath: string | null;
  links: { label: string; url: string }[];
  keywords: string[];
  works: AuthorWork[];
};

/** An author credited on a specific product. */
export type Credit = {
  authorId: string;
  slug: string;
  name: string;
  /** Contribution to this product, e.g. "Ilustración". */
  role: string | null;
};

export type Variant = {
  id: string;
  size: string;
  colorwayId: string;
  sku: string | null;
  stock: number;
};

export type ProductImage = {
  id: string;
  path: string;
  alt: string | null;
  colorwayId: string | null;
};

export type Product = {
  id: string;
  ref: string;
  slug: string;
  slugs: Record<Locale, string>;
  name: string;
  description: string;
  details: string[];
  keywords: string[];
  categoryId: CategoryId;
  collectionId: string | null;
  audience: Audience;
  shape: ArtShape;
  print: ArtPrint;
  /** Integer cents. */
  price: number;
  compareAt?: number;
  colorways: Colorway[];
  sizes: string[];
  soldOutSizes: string[];
  /** This product's own measurements; null until someone fills them in. */
  sizeGuide: SizeGuide | null;
  /** Framing options when the piece is sold as a cuadro; null otherwise. */
  framePreview: FramePreview | null;
  /** The product video and its caption; null when there is none to show. */
  video: ProductVideo | null;
  /** Can be printed with a drawing from the children's gallery. */
  artworkPrintable: boolean;
  variants: Variant[];
  images: ProductImage[];
  credits: Credit[];
  rating: number;
  reviews: number;
  bestseller: boolean;
  exclusive: boolean;
  published: boolean;
  arrived: number;
};

/** Everything the storefront needs for one locale, fetched once per request. */
export type Catalog = {
  locale: Locale;
  products: Product[];
  categories: Category[];
  collections: Collection[];
  authors: Author[];
};

/* ================================================================ derived */

export function inStock(product: Product): boolean {
  return product.variants.some((variant) => variant.stock > 0);
}

export function isNew(product: Product): boolean {
  return product.arrived >= 92;
}

export function onSale(product: Product): boolean {
  return product.compareAt !== undefined && product.compareAt > product.price;
}

/**
 * Is there an outlet at all?
 *
 * The outlet is not a section someone switches on: it is whatever happens to be
 * discounted right now. With nothing discounted there is no outlet, and every
 * part of the site that talks about one — the hero slide, the menus, the footer,
 * the home band, the announcement bar, the listing itself — has to stop talking
 * about it, rather than send people to an empty page promising -50 %.
 */
export function hasOutlet(products: Product[]): boolean {
  return products.some(onSale);
}

/** Units available for a size, summed across every colourway. */
export function stockForSize(product: Product, size: string): number {
  return product.variants
    .filter((variant) => variant.size === size)
    .reduce((total, variant) => total + variant.stock, 0);
}

export function stockFor(product: Product, size: string, colorwayId: string): number {
  return (
    product.variants.find((v) => v.size === size && v.colorwayId === colorwayId)?.stock ?? 0
  );
}

/* ================================================================ queries */

export type SortKey = "destacados" | "novedades" | "precio-asc" | "precio-desc" | "valoracion";

export const SORT_KEYS: SortKey[] = [
  "destacados",
  "novedades",
  "precio-asc",
  "precio-desc",
  "valoracion",
];

export type Filters = {
  categories?: CategoryId[];
  audiences?: Audience[];
  collections?: string[];
  colors?: string[];
  sizes?: string[];
  authors?: string[];
  /** Integer cents, inclusive. */
  maxPrice?: number;
  onSale?: boolean;
  sort?: SortKey;
};

function matches(product: Product, f: Filters): boolean {
  if (f.categories?.length && !f.categories.includes(product.categoryId)) return false;
  if (f.audiences?.length && !f.audiences.includes(product.audience)) return false;
  if (f.collections?.length) {
    if (!product.collectionId || !f.collections.includes(product.collectionId)) return false;
  }
  if (f.colors?.length) {
    const wanted = f.colors;
    if (!product.colorways.some((c) => wanted.includes(c.id))) return false;
  }
  if (f.sizes?.length) {
    const wanted = f.sizes;
    const available = product.sizes.filter((s) => !product.soldOutSizes.includes(s));
    if (!available.some((s) => wanted.includes(s))) return false;
  }
  if (f.authors?.length) {
    const wanted = f.authors;
    if (!product.credits.some((c) => wanted.includes(c.authorId))) return false;
  }
  if (f.maxPrice !== undefined && product.price > f.maxPrice) return false;
  if (f.onSale && !onSale(product)) return false;
  return true;
}

const SORTERS: Record<SortKey, (a: Product, b: Product) => number> = {
  destacados: (a, b) =>
    Number(b.bestseller) - Number(a.bestseller) || b.reviews - a.reviews || b.arrived - a.arrived,
  novedades: (a, b) => b.arrived - a.arrived || b.reviews - a.reviews,
  "precio-asc": (a, b) => a.price - b.price,
  "precio-desc": (a, b) => b.price - a.price,
  valoracion: (a, b) => b.rating - a.rating || b.reviews - a.reviews,
};

/**
 * Filters and sorts in memory. The published catalogue is small (tens of rows)
 * and is fetched once per request, so this avoids a round trip per facet while
 * keeping counts exact. Move to SQL when the catalogue outgrows a single page
 * of results — `products.search_doc` and the facet columns are already indexed.
 */
export function listProducts(products: Product[], filters: Filters = {}): Product[] {
  const sorter = SORTERS[filters.sort ?? "destacados"];
  return products.filter((p) => matches(p, filters)).sort(sorter);
}

export type FacetKey = "categories" | "audiences" | "collections" | "colors" | "sizes" | "authors";

const FACET_TESTS: Record<FacetKey, (p: Product, value: string) => boolean> = {
  categories: (p, value) => p.categoryId === value,
  audiences: (p, value) => p.audience === value,
  collections: (p, value) => p.collectionId === value,
  colors: (p, value) => p.colorways.some((c) => c.id === value),
  sizes: (p, value) => p.sizes.includes(value) && !p.soldOutSizes.includes(value),
  authors: (p, value) => p.credits.some((c) => c.authorId === value),
};

export function facetCounts(
  products: Product[],
  filters: Filters,
  facet: FacetKey,
  values: string[],
): Record<string, number> {
  // Self-exclusion: a facet's own selection must not shrink its sibling counts,
  // otherwise every unchecked option in the group would read 0.
  const rest: Filters = { ...filters, [facet]: undefined };
  const pool = products.filter((p) => matches(p, rest));
  const test = FACET_TESTS[facet];

  const counts: Record<string, number> = {};
  for (const value of values) {
    counts[value] = pool.reduce((total, p) => total + (test(p, value) ? 1 : 0), 0);
  }
  return counts;
}

export function searchProducts(products: Product[], query: string): Product[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/);

  return products
    .map((product) => {
      const haystack = [
        product.name,
        product.description,
        ...product.keywords,
        ...product.colorways.map((c) => c.name),
        ...product.credits.map((c) => c.name),
      ]
        .join(" ")
        .toLowerCase();

      const name = product.name.toLowerCase();
      const score = terms.reduce((total, term) => {
        if (name.includes(term)) return total + 3;
        if (haystack.includes(term)) return total + 1;
        return total;
      }, 0);

      return { product, score };
    })
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || b.product.reviews - a.product.reviews)
    .map((hit) => hit.product);
}

export function relatedProducts(
  products: Product[],
  product: Product,
  limit = 10,
): Product[] {
  return products
    .filter((p) => p.id !== product.id)
    .map((p) => ({
      p,
      score:
        (p.collectionId === product.collectionId ? 3 : 0) +
        (p.categoryId === product.categoryId ? 2 : 0) +
        (p.audience === product.audience ? 1 : 0) +
        (p.credits.some((c) => product.credits.some((d) => d.authorId === c.authorId)) ? 2 : 0),
    }))
    .sort((a, b) => b.score - a.score || b.p.reviews - a.p.reviews)
    .slice(0, limit)
    .map((hit) => hit.p);
}
