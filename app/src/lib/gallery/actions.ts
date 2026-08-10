"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";
import { recordConsent } from "@/lib/legal/consent";
import { LEGAL_VERSION } from "@/lib/legal/version";
import {
  ARTWORK_MAX_BYTES,
  ARTWORK_TYPES,
  artworkSlug,
  isArtworkOrigin,
  isArtworkType,
  matchesArtworkBytes,
  parseAuthorAge,
  parseAuthorName,
  parseTitle,
  slugSuffix,
  type FieldError,
} from "@/lib/gallery/model";
import { createClient, getUser } from "@/lib/supabase/server";

/**
 * Publishing, editing and withdrawing a child's drawing.
 *
 * The account requirement is the design, not friction for its own sake:
 * painting needs nobody's permission, but putting a child's drawing and first
 * name on a public page is something an identifiable adult has to have agreed
 * to. `user_id` therefore always comes from the validated session and never
 * from the form — and the insert policy in Postgres says the same thing again,
 * so a crafted request cannot publish under somebody else's name.
 */

export type PublishError =
  | FieldError
  | "not_signed_in"
  | "consent"
  | "no_image"
  | "unsupported_type"
  | "too_large"
  | "upload_failed"
  | "unknown";

export type PublishState = { error?: PublishError };

function str(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function safeLocale(form: FormData): Locale {
  const raw = str(form, "locale").trim();
  return isLocale(raw) ? raw : DEFAULT_LOCALE;
}

/**
 * The gallery shows up on the home page and in the wall, and both are rendered
 * per request anyway (they read cookies). This keeps the intent explicit for the
 * day one of them becomes static.
 */
function revalidateGallery() {
  revalidatePath("/", "layout");
}

/** Dimensions are display metadata; the clamp is what makes them harmless. */
function dimension(form: FormData, key: string): number {
  const value = Number(str(form, key));
  if (!Number.isFinite(value)) return 1000;
  return Math.min(12000, Math.max(1, Math.round(value)));
}

export async function publishArtwork(
  _previous: PublishState,
  form: FormData,
): Promise<PublishState> {
  const locale = safeLocale(form);

  const user = await getUser();
  if (!user) return { error: "not_signed_in" };

  // Never pre-ticked, and checked here rather than only in the browser — the
  // same rule the newsletter box gets, for the same reason.
  if (form.get("consent") !== "on") return { error: "consent" };

  const title = parseTitle(str(form, "title"));
  if (!title.ok) return { error: title.error };

  const authorName = parseAuthorName(str(form, "author_name"));
  if (!authorName.ok) return { error: authorName.error };

  const authorAge = parseAuthorAge(str(form, "author_age"));
  if (!authorAge.ok) return { error: authorAge.error };

  const rawOrigin = str(form, "origin");
  const origin = isArtworkOrigin(rawOrigin) ? rawOrigin : "upload";

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "no_image" };
  if (!isArtworkType(file.type)) return { error: "unsupported_type" };
  if (file.size > ARTWORK_MAX_BYTES) return { error: "too_large" };

  // The path is derived on the server from the account and a hash of the bytes.
  // The uploaded filename never reaches it, so a crafted name cannot climb out
  // of the one folder the storage policy lets this account write to.
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesArtworkBytes(file.type, bytes)) return { error: "unsupported_type" };

  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const fingerprint = Array.from(new Uint8Array(digest).slice(0, 10))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  const path = `gallery/${user.id}/${fingerprint}.${ARTWORK_TYPES[file.type]}`;

  const supabase = await createClient();

  const { error: uploadError } = await supabase.storage
    .from("media")
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (uploadError) {
    console.error("publishArtwork: upload failed", uploadError);
    return { error: "upload_failed" };
  }

  /*
    What was on screen, word for word — including the name of the document the
    link pointed at, which is why it is spliced in here rather than left out.
    Storing "…según la" and a URL would record a sentence nobody was shown, and a
    link resolves to whatever the notice says today rather than what it said on
    the day. Same composition as the newsletter's consent record.
  */
  const t = await getDictionary(locale);
  const g = t.gallery.publish;
  const consentText = `${g.consentLabel} ${t.footer.legal.privacy}. ${g.consentDetail}`;

  const payload = {
    user_id: user.id,
    title: title.value,
    author_name: authorName.value,
    author_age: authorAge.value,
    origin,
    status: "published" as const,
    storage_path: path,
    width: dimension(form, "width"),
    height: dimension(form, "height"),
    consent_text: consentText,
    consent_version: LEGAL_VERSION,
    consent_locale: locale,
    guardian_confirmed: true,
  };

  // Slugs carry six random characters, so a clash is a lottery win rather than
  // an everyday event — but `slug` is UNIQUE and a lottery win must not surface
  // to a child as "something went wrong". Draw again, twice, then give up.
  let slug = "";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    slug = artworkSlug(title.value, slugSuffix());
    const { error } = await supabase.from("artworks").insert({ ...payload, slug });

    if (!error) break;
    // 23505 = unique_violation. Anything else is not going to fix itself.
    if (error.code !== "23505" || attempt === 2) {
      console.error("publishArtwork: insert failed", error);
      await supabase.storage.from("media").remove([path]);
      return { error: "unknown" };
    }
  }

  // The artwork row is the per-drawing consent record; this is the one that
  // outlives it. A guardian who deletes the drawing still leaves behind the
  // proof that publishing it was agreed to, which is what Art. 7(1) asks for.
  await recordConsent({ kind: "gallery", granted: true, source: "gallery", locale });

  revalidateGallery();
  redirect(href(locale, "gallery", slug));
}

/* ------------------------------------------------------------- own edits */

export type EditResult = { ok: true } | { ok: false; error: PublishError };

/** Retitle or re-credit a drawing. The image itself is immutable. */
export async function updateArtwork(form: FormData): Promise<EditResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "not_signed_in" };

  const id = str(form, "id").trim();
  if (!id) return { ok: false, error: "unknown" };

  const title = parseTitle(str(form, "title"));
  if (!title.ok) return { ok: false, error: title.error };

  const authorName = parseAuthorName(str(form, "author_name"));
  if (!authorName.ok) return { ok: false, error: authorName.error };

  const authorAge = parseAuthorAge(str(form, "author_age"));
  if (!authorAge.ok) return { ok: false, error: authorAge.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("artworks")
    .update({
      title: title.value,
      author_name: authorName.value,
      author_age: authorAge.value,
    })
    .eq("id", id);

  if (error) return { ok: false, error: "unknown" };

  // The slug is left alone deliberately. Renaming a drawing should not break the
  // link a family already sent to their grandparents.
  revalidateGallery();
  return { ok: true };
}

/**
 * Take it down, or put it back.
 *
 * The owner's update policy refuses rows the shop has retired, so a drawing
 * removed by moderation cannot be restored from here — the request simply
 * affects no rows, which is the correct outcome and not an error worth
 * explaining to the person who tried.
 */
export async function setArtworkVisibility(form: FormData): Promise<EditResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "not_signed_in" };

  const id = str(form, "id").trim();
  if (!id) return { ok: false, error: "unknown" };

  const publish = form.get("publish") === "true";

  const supabase = await createClient();
  const { error } = await supabase
    .from("artworks")
    .update({
      status: publish ? "published" : "hidden",
      hidden_at: publish ? null : new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { ok: false, error: "unknown" };

  revalidateGallery();
  return { ok: true };
}

/**
 * Erase it.
 *
 * The row goes unconditionally: a guardian asking for their child's drawing to
 * be gone is exercising Art. 17, and that does not wait on anything.
 *
 * The **file** is a separate question. If somebody has bought a t-shirt with
 * this drawing on it, the shop still has a shirt to print, and finishing a sale
 * that has been paid for is contract performance rather than continued
 * publication — so the object stays and the order keeps its own copy of the
 * path. With nothing ordered there is nothing to keep, and the file goes too.
 *
 * `artwork_in_use` answers that from the database, because orders placed by
 * other people are not rows this account can read.
 */
export async function deleteArtwork(form: FormData): Promise<EditResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "not_signed_in" };

  const id = str(form, "id").trim();
  if (!id) return { ok: false, error: "unknown" };

  const supabase = await createClient();

  const { data: row } = await supabase
    .from("artworks")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  const { data: inUse } = await supabase.rpc("artwork_in_use", { p_artwork: id });

  const { error } = await supabase.from("artworks").delete().eq("id", id);
  if (error) return { ok: false, error: "unknown" };

  const path = (row as { storage_path: string } | null)?.storage_path;
  if (path && inUse !== true) {
    await supabase.storage.from("media").remove([path]);
  }

  revalidateGallery();
  return { ok: true };
}
