"use server";

import { revalidatePath } from "next/cache";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import {
  DEFAULT_FRAME_PREVIEW,
  FRAME_MAX_CM,
  FRAME_MIN_CM,
  isColorwayId,
  isFrameFinish,
  isSizeDimension,
  parseVideoUrl,
} from "@/lib/catalog";
import { createClient, getViewer } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

/**
 * Admin mutations.
 *
 * Two independent gates, on purpose:
 *
 *  1. `requireAdmin()` here, so a non-admin gets a clean error instead of a
 *     confusing empty result.
 *  2. Row Level Security in Postgres, which is the gate that actually matters.
 *     Every statement below runs as the caller's own Supabase session — nothing
 *     here touches the service-role client (only the payment callback does, and
 *     only because the bank has no session) — so if `requireAdmin` were ever
 *     removed or bypassed, the database would still refuse the write.
 */

export type ActionResult = { ok: true } | { ok: false; error: string };

const FORBIDDEN = "forbidden";
const INVALID = "invalid";

async function requireAdmin() {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return null;
  return viewer;
}

/** Refresh every storefront route after a catalogue change. */
function revalidateStore() {
  revalidatePath("/", "layout");
}

/* --------------------------------------------------------------- parsing */

function str(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function int(form: FormData, key: string): number | null {
  const raw = str(form, key);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.round(value) : null;
}

/** A measurement in centimetres, or the fallback when it is missing or absurd. */
function cm(form: FormData, key: string, fallback: number): number {
  const value = Number(str(form, key).replace(",", "."));
  return Number.isFinite(value) && value >= FRAME_MIN_CM && value <= FRAME_MAX_CM
    ? value
    : fallback;
}

/** Euros in the form, integer cents in the database. */
function cents(form: FormData, key: string): number | null {
  const raw = str(form, key).replace(",", ".");
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null;
}

/**
 * Collects a `field_es` / `field_gl` / `field_en` group into a JSONB bundle.
 * Castellano is required; blank translations fall back to it so a half-filled
 * form can never produce an empty page in another language.
 */
function bundle(form: FormData, prefix: string): Record<Locale, string> | null {
  const es = str(form, `${prefix}_es`);
  if (!es) return null;
  return Object.fromEntries(
    LOCALES.map((locale) => [locale, str(form, `${prefix}_${locale}`) || es]),
  ) as Record<Locale, string>;
}

/**
 * Same as `bundle`, for a field nobody is obliged to fill in.
 *
 * Null when every language is blank — which is exactly what makes the zone
 * disappear from the storefront. A translation typed without its Castellano is
 * not thrown away: the `i18n_text` domain insists on an `es` key, so the first
 * language that *was* filled in stands in for it.
 */
function optionalBundle(form: FormData, prefix: string): Record<Locale, string> | null {
  const typed = Object.fromEntries(
    LOCALES.map((locale) => [locale, str(form, `${prefix}_${locale}`)]),
  ) as Record<Locale, string>;

  const fallback = typed.es || LOCALES.map((locale) => typed[locale]).find(Boolean);
  if (!fallback) return null;

  return Object.fromEntries(
    LOCALES.map((locale) => [locale, typed[locale] || fallback]),
  ) as Record<Locale, string>;
}

/** Same, for comma-separated keyword lists. */
function listBundle(form: FormData, prefix: string): Record<Locale, string[]> {
  const split = (value: string) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const es = split(str(form, `${prefix}_es`));
  return Object.fromEntries(
    LOCALES.map((locale) => {
      const own = split(str(form, `${prefix}_${locale}`));
      return [locale, own.length ? own : es];
    }),
  ) as Record<Locale, string[]>;
}

/** Slug bundle, normalised so a typed slug can never be URL-unsafe. */
function slugBundle(form: FormData, name: Record<Locale, string>): Record<Locale, string> {
  return Object.fromEntries(
    LOCALES.map((locale) => {
      const typed = str(form, `slug_${locale}`);
      return [locale, slugify(typed || name[locale])];
    }),
  ) as Record<Locale, string>;
}

/* -------------------------------------------------------------- products */

export async function saveProduct(form: FormData): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: FORBIDDEN };

  const id = str(form, "id");
  const name = bundle(form, "name");
  const description = bundle(form, "description");
  const price = cents(form, "price");
  const categoryId = str(form, "category_id");

  if (!name || !description || price === null || !categoryId) {
    return { ok: false, error: INVALID };
  }

  const compareAt = cents(form, "compare_at");
  if (compareAt !== null && compareAt <= price) {
    // The database has the same CHECK; fail early with a useful message.
    return { ok: false, error: "compare_at_must_exceed_price" };
  }

  const colorways = form
    .getAll("colorways")
    .map(String)
    .filter((value) => isColorwayId(value));
  if (colorways.length === 0) return { ok: false, error: "needs_a_colour" };

  /**
   * The video is optional, but a video the browser cannot play is not: an address
   * we do not recognise is rejected here rather than stored, so the ficha never
   * has to render a player that will not start. The caption goes with it — a pie
   * de foto with no video is not a zone anyone wants to see.
   */
  const typedVideo = str(form, "video_url");
  const video = typedVideo ? parseVideoUrl(typedVideo) : null;
  if (typedVideo && !video) return { ok: false, error: "video_url_not_playable" };

  const payload = {
    slug: slugBundle(form, name),
    name,
    description,
    keywords: listBundle(form, "keywords"),
    details: listBundle(form, "details"),
    category_id: categoryId,
    collection_id: str(form, "collection_id") || null,
    audience: str(form, "audience") || "unisex",
    shape: str(form, "shape") || "tee",
    print: str(form, "print") || "wordmark",
    price_cents: price,
    compare_at_cents: compareAt,
    colorways,
    video_url: video?.url ?? null,
    video_caption: video ? optionalBundle(form, "video_caption") : null,
    artwork_printable: form.get("artwork_printable") === "on",
    published: form.get("published") === "on",
    arrived: int(form, "arrived") ?? 50,
  };

  const supabase = await createClient();

  if (id) {
    const { error } = await supabase.from("products").update(payload).eq("id", id);
    if (error) return { ok: false, error: error.message };
  } else {
    const ref = str(form, "ref");
    if (!ref) return { ok: false, error: "ref_required" };
    const { error } = await supabase.from("products").insert({ ...payload, ref });
    if (error) return { ok: false, error: error.message };
  }

  revalidateStore();
  return { ok: true };
}

export async function setPublished(form: FormData): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: FORBIDDEN };

  const id = str(form, "id");
  if (!id) return { ok: false, error: INVALID };

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ published: form.get("published") === "true" })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidateStore();
  return { ok: true };
}

export async function deleteProduct(form: FormData): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: FORBIDDEN };

  const id = str(form, "id");
  if (!id) return { ok: false, error: INVALID };

  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidateStore();
  return { ok: true };
}

/* ----------------------------------------------------------- framing */

/**
 * Whether this piece is shown framed, and in which finishes.
 *
 * Enabling with no finish ticked is stored as *off* rather than as a frame with
 * no colour: the storefront would otherwise have to invent one, and a preview the
 * shop did not choose is worse than no preview.
 */
export async function saveFramePreview(form: FormData): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: FORBIDDEN };

  const id = str(form, "id");
  if (!id) return { ok: false, error: INVALID };

  const finishes = form
    .getAll("finishes")
    .map(String)
    .filter((value) => isFrameFinish(value));

  const enabled = form.get("frame_enabled") === "on" && finishes.length > 0;

  // Mount width in percent. Beyond 30 the artwork disappears into the board.
  const rawMount = str(form, "mount").replace(",", ".");
  const mount = Number(rawMount);
  const safeMount = Number.isFinite(mount) && mount >= 0 && mount <= 30 ? mount : 10;

  // The printed size. This one is not cosmetic: it is the scale the camera view
  // hangs the piece at, so a wrong number here is a wrong answer to the only
  // question that view exists to answer.
  const width = cm(form, "frame_width", DEFAULT_FRAME_PREVIEW.width);
  const height = cm(form, "frame_height", DEFAULT_FRAME_PREVIEW.height);

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({
      frame_preview: enabled
        ? { enabled: true, finishes, mount: safeMount, width, height }
        : {},
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidateStore();
  return { ok: true };
}

/* ----------------------------------------------------------------- stock */

/** Absolute set, used by the editable stock grid. */
export async function setStock(form: FormData): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: FORBIDDEN };

  const variantId = str(form, "variant_id");
  const stock = int(form, "stock");
  if (!variantId || stock === null || stock < 0) return { ok: false, error: INVALID };

  const supabase = await createClient();
  const { error } = await supabase
    .from("product_variants")
    .update({ stock })
    .eq("id", variantId);

  if (error) return { ok: false, error: error.message };
  revalidateStore();
  return { ok: true };
}

/* ----------------------------------------------------------- size guides */

/**
 * The measurements for one product's own sizes.
 *
 * The form posts a `dimensions` checkbox per measurement and an `m_<size>_<key>`
 * number per cell. Anything blank, non-numeric or out of range is dropped rather
 * than stored as zero, because a table full of `0 cm` is worse than a gap: the
 * storefront prints "—" for a missing cell.
 *
 * Sizes are checked against the product's actual variants, so a stale form
 * cannot introduce measurements for a size that is not sold.
 */
export async function saveSizeGuide(form: FormData): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: FORBIDDEN };

  const id = str(form, "id");
  if (!id) return { ok: false, error: INVALID };

  const supabase = await createClient();

  const { data: variants } = await supabase
    .from("product_variants")
    .select("size")
    .eq("product_id", id);

  const sizes = new Set(((variants ?? []) as { size: string }[]).map((row) => row.size));
  if (sizes.size === 0) return { ok: false, error: "no_sizes" };

  const dimensions = form
    .getAll("dimensions")
    .map(String)
    .filter((value) => isSizeDimension(value));

  // Clearing every dimension is a legitimate way to say "no guide for this one",
  // which sends the storefront back to the baseline for the garment shape.
  if (dimensions.length === 0) {
    const { error } = await supabase.from("products").update({ size_guide: {} }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidateStore();
    return { ok: true };
  }

  const measurements: Record<string, Record<string, number>> = {};
  for (const size of sizes) {
    const row: Record<string, number> = {};
    for (const dimension of dimensions) {
      const raw = str(form, `m_${size}_${dimension}`);
      if (!raw) continue;
      // Commas are what people actually type for half centimetres.
      const value = Number(raw.replace(",", "."));
      if (!Number.isFinite(value) || value <= 0 || value > 400) continue;
      row[dimension] = Math.round(value * 2) / 2;
    }
    if (Object.keys(row).length > 0) measurements[size] = row;
  }

  const { error } = await supabase
    .from("products")
    .update({ size_guide: { dimensions, measurements } })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidateStore();
  return { ok: true };
}

/**
 * Relative movement (+/-), via the `adjust_stock` database function so two
 * simultaneous adjustments cannot lose one another.
 */
export async function adjustStock(form: FormData): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: FORBIDDEN };

  const variantId = str(form, "variant_id");
  const delta = int(form, "delta");
  if (!variantId || delta === null || delta === 0) return { ok: false, error: INVALID };

  const supabase = await createClient();
  const { error } = await supabase.rpc("adjust_stock", {
    variant_id: variantId,
    delta,
  });

  if (error) return { ok: false, error: error.message };
  revalidateStore();
  return { ok: true };
}

export async function addVariant(form: FormData): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: FORBIDDEN };

  const productId = str(form, "product_id");
  const size = str(form, "size");
  const colorwayId = str(form, "colorway_id");
  const stock = int(form, "stock") ?? 0;

  if (!productId || !size || !isColorwayId(colorwayId)) return { ok: false, error: INVALID };

  const supabase = await createClient();
  const { error } = await supabase.from("product_variants").insert({
    product_id: productId,
    size,
    colorway_id: colorwayId,
    stock: Math.max(0, stock),
  });

  if (error) return { ok: false, error: error.message };
  revalidateStore();
  return { ok: true };
}

export async function deleteVariant(form: FormData): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: FORBIDDEN };

  const variantId = str(form, "variant_id");
  if (!variantId) return { ok: false, error: INVALID };

  const supabase = await createClient();
  const { error } = await supabase.from("product_variants").delete().eq("id", variantId);
  if (error) return { ok: false, error: error.message };

  revalidateStore();
  return { ok: true };
}

/* --------------------------------------------------------------- credits */

export async function addCredit(form: FormData): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: FORBIDDEN };

  const productId = str(form, "product_id");
  const authorId = str(form, "author_id");
  if (!productId || !authorId) return { ok: false, error: INVALID };

  const role = bundle(form, "role");
  const position = int(form, "position") ?? 0;

  const supabase = await createClient();
  const { error } = await supabase.from("product_authors").insert({
    product_id: productId,
    author_id: authorId,
    role,
    position,
  });

  if (error) return { ok: false, error: error.message };
  revalidateStore();
  return { ok: true };
}

export async function removeCredit(form: FormData): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: FORBIDDEN };

  const productId = str(form, "product_id");
  const authorId = str(form, "author_id");
  if (!productId || !authorId) return { ok: false, error: INVALID };

  const supabase = await createClient();
  const { error } = await supabase
    .from("product_authors")
    .delete()
    .eq("product_id", productId)
    .eq("author_id", authorId);

  if (error) return { ok: false, error: error.message };
  revalidateStore();
  return { ok: true };
}

/* ----------------------------------------------------------------- media */

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/svg+xml",
]);
const MAX_BYTES = 8 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/svg+xml": "svg",
};

/**
 * Uploads to the `media` bucket and records the row.
 *
 * The path is built here from the product id and a hash of the file, never from
 * the client-supplied filename — so a crafted name cannot traverse out of the
 * folder the storage policy allows. Type and size are checked here and again by
 * the bucket configuration.
 */
export async function uploadProductImage(form: FormData): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: FORBIDDEN };

  const productId = str(form, "product_id");
  const file = form.get("file");
  if (!productId || !(file instanceof File) || file.size === 0) {
    return { ok: false, error: INVALID };
  }
  if (!ALLOWED_TYPES.has(file.type)) return { ok: false, error: "unsupported_type" };
  if (file.size > MAX_BYTES) return { ok: false, error: "too_large" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const fingerprint = Array.from(new Uint8Array(digest).slice(0, 8))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  const path = `products/${productId}/${fingerprint}.${EXTENSIONS[file.type]}`;

  const supabase = await createClient();

  const { error: uploadError } = await supabase.storage
    .from("media")
    .upload(path, bytes, { contentType: file.type, upsert: true });
  if (uploadError) return { ok: false, error: uploadError.message };

  const alt = bundle(form, "alt");
  const { error } = await supabase.from("product_images").insert({
    product_id: productId,
    storage_path: path,
    alt,
    colorway_id: str(form, "colorway_id") || null,
    position: int(form, "position") ?? 0,
  });
  if (error) return { ok: false, error: error.message };

  revalidateStore();
  return { ok: true };
}

export async function deleteProductImage(form: FormData): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: FORBIDDEN };

  const imageId = str(form, "image_id");
  const path = str(form, "path");
  if (!imageId || !path) return { ok: false, error: INVALID };

  const supabase = await createClient();

  const { error } = await supabase.from("product_images").delete().eq("id", imageId);
  if (error) return { ok: false, error: error.message };

  // Best effort: if the object is already gone, the row removal still stands.
  await supabase.storage.from("media").remove([path]);

  revalidateStore();
  return { ok: true };
}
