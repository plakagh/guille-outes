// Relative, not `@/lib/utils`, and deliberately so: `pnpm test` runs this file
// through Node directly (`node --test`), which resolves imports itself and knows
// nothing about the TypeScript path alias. Every other tested module in the
// codebase gets away with `@/` because its only such imports are `import type`,
// which type stripping erases; this one is a real value.
import { slugify } from "../utils.ts";

/**
 * The children's gallery, minus everything that needs a database or a browser.
 *
 * Kept pure so the rules that matter — what counts as a first name, what a title
 * may contain, how a slug is built — can be unit tested, and so the Server
 * Action and the form in the browser validate against exactly the same code
 * rather than two implementations that drift.
 */

export const ARTWORK_ORIGINS = ["upload", "painted"] as const;
export type ArtworkOrigin = (typeof ARTWORK_ORIGINS)[number];

export const ARTWORK_STATUSES = ["published", "hidden"] as const;
export type ArtworkStatus = (typeof ARTWORK_STATUSES)[number];

export function isArtworkOrigin(value: string): value is ArtworkOrigin {
  return (ARTWORK_ORIGINS as readonly string[]).includes(value);
}

export function isArtworkStatus(value: string): value is ArtworkStatus {
  return (ARTWORK_STATUSES as readonly string[]).includes(value);
}

export const TITLE_MAX = 60;
export const AUTHOR_NAME_MAX = 24;
export const AGE_MIN = 1;
export const AGE_MAX = 17;

/** Matches the CHECK constraints in `20260805100100_kids_gallery.sql`. */
export type FieldError =
  | "title_empty"
  | "title_too_long"
  | "name_empty"
  | "name_too_long"
  | "name_looks_like_full_name"
  | "age_out_of_range";

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: FieldError };

/** Collapses runs of whitespace, so a title is never padded into uniqueness. */
function tidy(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export function parseTitle(raw: string): Parsed<string> {
  const value = tidy(raw);
  if (!value) return { ok: false, error: "title_empty" };
  if (value.length > TITLE_MAX) return { ok: false, error: "title_too_long" };
  return { ok: true, value };
}

/**
 * The credit line is a **first name**, and the check is a word count rather than
 * a ban on spaces.
 *
 * Refusing spaces outright would be the obvious rule and it would be wrong here:
 * "Ana María" and "José Luis" are single first names in Castellano and Galego,
 * and a form that rejects them insults the child it is trying to credit. Three
 * or more words, on the other hand, is almost always a full name typed into the
 * wrong box — which is the one outcome worth designing out, because it is a
 * minor's full name on an indexable page.
 *
 * It is a heuristic, so it fails loudly rather than silently: the name is handed
 * back for correction, never truncated behind the typist's back.
 */
export function parseAuthorName(raw: string): Parsed<string> {
  const value = tidy(raw);
  if (!value) return { ok: false, error: "name_empty" };
  if (value.length > AUTHOR_NAME_MAX) return { ok: false, error: "name_too_long" };
  if (value.split(" ").length > 2) {
    return { ok: false, error: "name_looks_like_full_name" };
  }
  return { ok: true, value };
}

/**
 * The age, which nobody has to give.
 *
 * Blank is a valid answer and returns null — a shop has no business insisting on
 * knowing how old a child is, and a drawing is credited perfectly well without
 * it. Anything typed, though, has to be a real age.
 */
export function parseAuthorAge(raw: string): Parsed<number | null> {
  const value = raw.trim();
  if (!value) return { ok: true, value: null };

  const age = Number(value);
  if (!Number.isInteger(age) || age < AGE_MIN || age > AGE_MAX) {
    return { ok: false, error: "age_out_of_range" };
  }
  return { ok: true, value: age };
}

/**
 * `title` → `mi-perro-k3f9a1`.
 *
 * The suffix is not decoration. Children name drawings "mi perro" and "el mar",
 * and a collision that made the second child rename theirs would be the site
 * telling a seven-year-old their title was taken. Six random characters make
 * that impossible while keeping the URL readable, and they also guarantee no
 * artwork can ever shadow `/galeria/taller`, which contains no digits and no
 * suffix.
 *
 * A title made entirely of emoji or punctuation slugifies to nothing, which is
 * why there is a fallback: a URL is our problem, not theirs.
 */
export function artworkSlug(title: string, suffix: string): string {
  const base = slugify(title).slice(0, 48).replace(/-$/, "");
  return `${base || "dibujo"}-${suffix}`;
}

/** Six lowercase base-36 characters from the platform CSPRNG. */
export function slugSuffix(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => (byte % 36).toString(36)).join("");
}

/* ============================================================== the credit */

/**
 * "Martina, 7 años" — or just "Martina" when no age was given.
 *
 * The unit word is passed in rather than looked up, because this runs in both
 * Server and Client Components and the dictionary reaches them by different
 * routes.
 */
export function creditLine(
  name: string,
  age: number | null,
  yearsLabel: string,
): string {
  return age === null ? name : `${name}, ${age} ${yearsLabel}`;
}

/* =============================================================== uploads */

/**
 * What the gallery accepts.
 *
 * SVG is missing on purpose, and it is the one omission that is not about
 * quality: an SVG is a script container, and one served public-read from our own
 * origin is stored XSS as soon as anybody opens the file URL. The `media` bucket
 * allows SVG because the shop draws its own; the storage policy for the gallery
 * folder refuses the extension, and this list refuses the type.
 */
export const ARTWORK_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

/** The bucket's own ceiling. A phone photo of a drawing sits well under it. */
export const ARTWORK_MAX_BYTES = 8 * 1024 * 1024;

export function isArtworkType(type: string): boolean {
  return type in ARTWORK_TYPES;
}
