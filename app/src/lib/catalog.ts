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
  marron: { id: "marron", name: "Marrón", base: "#a8571f", trim: "#f4ece1" },
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
    marron: "Marrón",
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
    marron: "Marrón",
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
    marron: "Brown",
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
/**
 * Framed prints are sold in two formats rather than garment sizes, and the two
 * are priced differently — see `price_delta_cents` on the variant.
 */
export const PRINT_SIZES = ["Pequeño", "Grande"];
export const ONE_SIZE = "Única";

/** Every size that can appear in the catalogue, in display order. */
export function allSizes(): string[] {
  return [...APPAREL_SIZES, ...KIDS_SIZES, ...PRINT_SIZES, ONE_SIZE];
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

/**
 * What the shopper decided about the frame.
 *
 * A finish, or `"none"` for the print on its own. Not a nullable finish: null is
 * "this product has no frame to speak of" — a t-shirt — and `"none"` is a cuadro
 * somebody chose to buy unframed. The packer needs to tell those apart, and so
 * does the price.
 */
export type FrameChoice = FrameFinish | "none";

export function isFrameChoice(value: string): value is FrameChoice {
  return value === "none" || isFrameFinish(value);
}

/**
 * A printed size in centimetres: the paper itself, mount and moulding excluded.
 *
 * Its own type because it travels on its own — the wall view scales by it, the
 * CSS preview takes its proportions from it, and both need the measurements of
 * *one* format rather than of the product.
 */
export type FrameSize = { width: number; height: number };

export type FramePreview = {
  /** Ordered; the first is what the preview opens with. */
  finishes: FrameFinish[];
  /** Mount width as a percentage of the artwork's shorter side. */
  mount: number;
  /**
   * What the frame adds to the price of the print, in cents.
   *
   * The catalogue price is the paper: "el precio indicado es solo de la lámina"
   * is what the product page has always said, and this is the number that makes
   * it true when somebody wants it framed. One amount for the three finishes,
   * because that is what framing costs the shop; zero is a frame given away.
   */
  surcharge: number;
  /**
   * What each format is printed at, keyed by the product's own size names — the
   * same names the size buttons and the stock rows use ("Pequeño", "Grande").
   *
   * Per size and not per product because a cuadro is sold in more than one
   * format, at more than one price: hanging the shopper's chosen 30 × 40 as a
   * 50 × 70 answers the wrong question, and it is the only question the camera
   * view exists to answer.
   */
  sizes: Record<string, FrameSize>;
  /**
   * The measurements to use for a format nobody has measured, and before a size
   * is chosen at all. Kept alongside `sizes` rather than derived from it because
   * a product can be framed before its formats are filled in.
   */
  width: number;
  height: number;
};

/** Sensible framing for a product someone has just ticked "show framed" on. */
export const DEFAULT_FRAME_PREVIEW: FramePreview = {
  finishes: [...FRAME_FINISHES],
  mount: 10,
  // Nothing, until the shop says what a frame costs. A surcharge invented here
  // would be money charged to a customer that nobody decided to charge.
  surcharge: 0,
  sizes: {},
  // 50 × 70 is the standard European poster size.
  width: 50,
  height: 70,
};

/**
 * The standard paper size for each format a print is sold in — see
 * {@link PRINT_SIZES}, which is where these names come from.
 *
 * A fallback, not a rule: what a piece actually measures is per product and is
 * filled in from the admin panel. But a shop that has not got round to it yet is
 * better served by the two sizes those words mean everywhere than by one number
 * standing in for both.
 */
const PRINT_SIZE_CM: Record<string, FrameSize> = {
  Pequeño: { width: 30, height: 40 },
  Grande: { width: 50, height: 70 },
};

/** Below a postcard or above a doorway, it is a typo rather than a measurement. */
export const FRAME_MIN_CM = 5;
export const FRAME_MAX_CM = 300;

/** A thousand euros for a frame is a slipped decimal point, not a price. */
export const FRAME_MAX_SURCHARGE = 100_000;

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
    surcharge?: unknown;
    sizes?: unknown;
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
  const surcharge = typeof raw.surcharge === "number" ? raw.surcharge : Number(raw.surcharge);

  return {
    finishes,
    mount: Number.isFinite(mount) && mount >= 0 && mount <= 30 ? mount : DEFAULT_FRAME_PREVIEW.mount,
    // Unreadable falls back to free rather than to a guess: the server prices
    // every order from this number, and inventing one charges somebody for it.
    surcharge:
      Number.isFinite(surcharge) && surcharge >= 0 && surcharge <= FRAME_MAX_SURCHARGE
        ? Math.round(surcharge)
        : 0,
    sizes: parseFrameSizes(raw.sizes),
    // Rows written before the wall view existed have no measurements. Falling
    // back to the standard size keeps the feature available on them rather than
    // hiding it until someone edits the product.
    width: frameCm(raw.width, DEFAULT_FRAME_PREVIEW.width),
    height: frameCm(raw.height, DEFAULT_FRAME_PREVIEW.height),
  };
}

/** The `sizes` map, keeping only entries with two usable measurements. */
function parseFrameSizes(value: unknown): Record<string, FrameSize> {
  if (typeof value !== "object" || value === null) return {};

  const sizes: Record<string, FrameSize> = {};
  for (const [size, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry !== "object" || entry === null) continue;
    const raw = entry as { width?: unknown; height?: unknown };
    // 0 as the fallback so an unusable measurement drops the whole format rather
    // than pairing a real number with an invented one.
    const width = frameCm(raw.width, 0);
    const height = frameCm(raw.height, 0);
    if (width > 0 && height > 0) sizes[size] = { width, height };
  }
  return sizes;
}

/**
 * What one format measures.
 *
 * In order: what the shop typed for that size, the standard size those words
 * mean, and — for a format with a name we know nothing about — the product's own
 * default. Never an average of the two formats, which is a size no cuadro is.
 */
export function frameSizeFor(frame: FramePreview, size?: string | null): FrameSize {
  if (size) {
    const measured = frame.sizes[size];
    if (measured) return measured;
    const standard = PRINT_SIZE_CM[size];
    if (standard) return standard;
  }
  return { width: frame.width, height: frame.height };
}

/** One format the piece can be hung as. `size` is null only if it has no sizes. */
export type FrameSizeOption = FrameSize & { size: string | null };

/**
 * A frame, away from the catalogue: how wide its mount is and what format is
 * behind the glass.
 *
 * Carried by a basket line and by a cross-sell tile, both of which are drawn in
 * the browser with no catalogue to consult. The finish travels separately —
 * a line records it as a choice the shopper made, and `"none"` is a choice.
 */
export type FrameShot = { mount: number; print: FrameSize };

/**
 * The formats the wall view may hang, in the order the size buttons show them.
 *
 * Taken from the sizes the product is actually sold in, so the camera can only
 * ever be showing something buyable: a slider from 20 to 200 cm would answer
 * "would *a* picture fit" rather than "would *this* one".
 */
export function frameSizeOptions(
  product: { sizes: string[] },
  frame: FramePreview,
): FrameSizeOption[] {
  const named = [...product.sizes]
    .sort(compareSizes)
    .map((size) => ({ size, ...frameSizeFor(frame, size) }));

  return named.length > 0 ? named : [{ size: null, ...frameSizeFor(frame, null) }];
}

/**
 * Which way up the piece hangs.
 *
 * Derived from the measurements rather than stored beside them: a 70 × 50 *is*
 * landscape, and a separate flag could only ever contradict the numbers it sits
 * next to. Square counts as portrait, which is what the drawing does with it.
 */
export function frameOrientation(frame: FrameSize): ArtOrientation {
  return frame.width > frame.height ? "landscape" : "portrait";
}

/** The printed proportions, for the CSS box that holds the artwork. */
export function frameAspect(frame: FrameSize): string {
  return `${frame.width} / ${frame.height}`;
}

/** The measurements as the shopper reads them, e.g. `50 × 70 cm`. */
export function formatFrameSize(frame: FrameSize): string {
  const trim = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));
  return `${trim(frame.width)} × ${trim(frame.height)} cm`;
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
  /** Added to the product price for this variant; 0 for most of the catalogue. */
  priceDeltaCents: number;
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

/* ================================================================= pricing */

/**
 * What one size actually costs.
 *
 * Most of the catalogue prices per product, and every variant of it carries a
 * delta of zero. Framed prints do not: the large is twice the small, and the
 * product price is the "from" figure.
 *
 * A size with no variant falls back to the product price rather than throwing —
 * an unknown size means the shopper cannot buy anything anyway, and the checkout
 * re-prices from the catalogue before it charges.
 */
export function priceFor(product: Product, size?: string | null): number {
  if (!size) return product.price;
  const variant = product.variants.find((v) => v.size === size);
  return product.price + (variant?.priceDeltaCents ?? 0);
}

/**
 * What the frame adds to one unit.
 *
 * Zero for a print bought on its own, for a product that is not sold framed, and
 * for a finish this piece does not offer — the last one being a defensive zero
 * for display only. An order asking for a finish that is not on sale is refused
 * outright by `placeOrder` rather than quietly given a free frame.
 */
export function frameSurcharge(frame: FramePreview | null, choice?: FrameChoice | null): number {
  if (!frame || !choice || choice === "none") return 0;
  return frame.finishes.includes(choice) ? frame.surcharge : 0;
}

/**
 * How a chosen frame reads in a list of things somebody bought.
 *
 * Takes the strings rather than the whole dictionary so the cart, the order page
 * and the emails all say it the same way without this module knowing what a
 * Dictionary is.
 */
export function frameLabel(
  choice: FrameChoice,
  t: { frameFinish: string; frameNone: string; frameFinishes: Record<FrameFinish, string> },
): string {
  return choice === "none" ? t.frameNone : `${t.frameFinish}: ${t.frameFinishes[choice]}`;
}

/**
 * The price of one unit as it is charged: the chosen format, plus its frame.
 *
 * `priceFor` remains the price of the piece itself, which is what a listing card
 * and a "from" figure want. This is what goes in the basket.
 */
export function unitPriceFor(
  product: Product,
  size?: string | null,
  choice?: FrameChoice | null,
): number {
  return priceFor(product, size) + frameSurcharge(product.framePreview, choice);
}

/**
 * The cheapest and dearest a product gets, for listings.
 *
 * The frame counts towards the top of the range: the cheapest way to own a cuadro
 * is the paper on its own, and a card that says "40 €" flat for a piece that is
 * 55 € framed — which is how the product page opens — has told a half-truth. It
 * says "desde 40 €" instead.
 */
export function priceRange(product: Product): { from: number; to: number } {
  const deltas = product.variants.map((v) => v.priceDeltaCents);
  return {
    from: product.price + Math.min(0, ...deltas),
    to: product.price + Math.max(0, ...deltas) + (product.framePreview?.surcharge ?? 0),
  };
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

/* ============================================================= cross-sell */

/**
 * "También te puede interesar", for a basket rather than for a product.
 *
 * The product page already has {@link relatedProducts}, and it wants the
 * opposite of this: someone looking at a cuadro is shown *more cuadros*, because
 * they are still choosing. Someone who has already put one in the basket has
 * chosen, and another twelve of the same thing is the least useful shelf we
 * could draw them. What they have not seen is the rest of the shop — so a basket
 * with a cuadro in it is shown camisetas, and a basket with a camiseta is shown
 * cuadros.
 *
 * That is a rule about sections and not about those two, which is what keeps it
 * working as the shop grows: candidates from a section nobody has bought from
 * come first, and only when there are none left does it fall back to more of
 * what is already in the basket. Within each group the picks are spread across
 * the sections they come from, so four slots are never four of one thing.
 *
 * Ranking is deterministic — no shuffling — so the shelf does not rearrange
 * itself under the shopper's cursor every time a quantity changes.
 */
export function crossSell(products: Product[], basket: Product[], limit = 3): Product[] {
  if (basket.length === 0 || limit <= 0) return [];

  const bought = new Set(basket.map((p) => p.id));
  const boughtCategories = new Set(basket.map((p) => p.categoryId));
  const boughtCollections = new Set(
    basket.map((p) => p.collectionId).filter((id): id is string => id !== null),
  );
  const boughtAuthors = new Set(basket.flatMap((p) => p.credits.map((c) => c.authorId)));
  /** The dearest thing in the basket, as the ceiling for an easy add-on. */
  const dearest = Math.max(...basket.map((p) => p.price));

  const ranked = products
    .filter((p) => !bought.has(p.id) && inStock(p))
    .map((p) => ({
      p,
      score:
        // Same collection is the strongest signal there is that two pieces
        // belong together: it is the shop saying so.
        (p.collectionId !== null && boughtCollections.has(p.collectionId) ? 3 : 0) +
        (p.credits.some((c) => boughtAuthors.has(c.authorId)) ? 2 : 0) +
        // A basket suggestion is an impulse, not a second decision: something
        // dearer than what is already in there rarely is one.
        (p.price <= dearest ? 1 : 0) +
        (p.bestseller ? 1 : 0),
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.p.reviews - a.p.reviews ||
        b.p.arrived - a.p.arrived ||
        // A total order, so the shelf is the same on the server and the client
        // and does not depend on how the engine sorts equal elements.
        a.p.id.localeCompare(b.p.id),
    )
    .map((hit) => hit.p);

  const elsewhere = spreadBySection(ranked.filter((p) => !boughtCategories.has(p.categoryId)));
  const more = spreadBySection(ranked.filter((p) => boughtCategories.has(p.categoryId)));

  return [...elsewhere, ...more].slice(0, limit);
}

/**
 * The same list, taking one from each section in turn.
 *
 * Order within a section is preserved and the best-ranked section goes first, so
 * this only ever moves a pick forward past worse-ranked ones from a section that
 * is already represented.
 */
function spreadBySection(products: Product[]): Product[] {
  const sections = new Map<CategoryId, Product[]>();
  for (const product of products) {
    const section = sections.get(product.categoryId);
    if (section) section.push(product);
    else sections.set(product.categoryId, [product]);
  }

  const depth = Math.max(0, ...[...sections.values()].map((section) => section.length));
  const spread: Product[] = [];
  for (let index = 0; index < depth; index++) {
    for (const section of sections.values()) {
      const product = section[index];
      if (product) spread.push(product);
    }
  }
  return spread;
}
