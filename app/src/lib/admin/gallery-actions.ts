"use server";

import { revalidatePath } from "next/cache";
import { createClient, getViewer } from "@/lib/supabase/server";

/**
 * Moderating the children's gallery.
 *
 * Drawings appear the moment they are published — a child at a stand who is told
 * "it will show up in a few days" has been told nothing — so moderation here is
 * retirement after the fact rather than approval before it. What makes that
 * workable is that publishing needs an account: every drawing has an adult
 * attached to it, and that is a far higher bar than an open upload box.
 *
 * Retiring sets `hidden_by_admin`, and the owner's update policy refuses any row
 * where that is true. Without it, "hide" would be a button the moderated party
 * could press straight back.
 *
 * As everywhere else in the admin panel, `requireAdmin()` is the courtesy and
 * the RLS policy is the gate: these statements run as the administrator's own
 * session, so removing this check would not make the writes succeed.
 */

export type GalleryActionResult = { ok: true } | { ok: false; error: string };

const FORBIDDEN = "forbidden";
const INVALID = "invalid";

async function requireAdmin() {
  const viewer = await getViewer();
  return viewer?.isAdmin ? viewer : null;
}

function id(form: FormData): string {
  const value = form.get("id");
  return typeof value === "string" ? value.trim() : "";
}

export async function retireArtwork(form: FormData): Promise<GalleryActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: FORBIDDEN };

  const artworkId = id(form);
  if (!artworkId) return { ok: false, error: INVALID };

  const supabase = await createClient();
  const { error } = await supabase
    .from("artworks")
    .update({
      status: "hidden",
      hidden_by_admin: true,
      hidden_at: new Date().toISOString(),
    })
    .eq("id", artworkId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Puts a retired drawing back, and hands control of it to its owner again. */
export async function restoreArtwork(form: FormData): Promise<GalleryActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: FORBIDDEN };

  const artworkId = id(form);
  if (!artworkId) return { ok: false, error: INVALID };

  const supabase = await createClient();
  const { error } = await supabase
    .from("artworks")
    .update({ status: "published", hidden_by_admin: false, hidden_at: null })
    .eq("id", artworkId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Delete it outright.
 *
 * Reserved for what should never have been uploaded, where hiding is not
 * enough. The image is removed with the row unless an order depends on it —
 * the same rule the owner's own delete follows, and for the same reason.
 */
export async function removeArtwork(form: FormData): Promise<GalleryActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: FORBIDDEN };

  const artworkId = id(form);
  if (!artworkId) return { ok: false, error: INVALID };

  const supabase = await createClient();

  const { data: row } = await supabase
    .from("artworks")
    .select("storage_path")
    .eq("id", artworkId)
    .maybeSingle();

  const { data: inUse } = await supabase.rpc("artwork_in_use", { p_artwork: artworkId });

  const { error } = await supabase.from("artworks").delete().eq("id", artworkId);
  if (error) return { ok: false, error: error.message };

  const path = (row as { storage_path: string } | null)?.storage_path;
  if (path && inUse !== true) {
    await supabase.storage.from("media").remove([path]);
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
