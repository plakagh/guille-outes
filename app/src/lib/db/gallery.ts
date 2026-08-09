import { cache } from "react";
import type { ArtworkOrigin, ArtworkStatus } from "@/lib/gallery/model";
import { mediaUrl } from "@/lib/supabase/env";
import { createClient, getUser } from "@/lib/supabase/server";

/**
 * Reading the children's gallery.
 *
 * Every query here runs as the caller, so the RLS policies do the filtering:
 * `status = 'published'` for anyone, plus your own rows if you are signed in,
 * plus everything if you are an administrator. There is deliberately no
 * `.eq("status", "published")` in the public list — adding one would work today
 * and would quietly become the only thing standing between a hidden drawing and
 * the grid the day somebody edited a policy.
 */

export type Artwork = {
  id: string;
  slug: string;
  title: string;
  authorName: string;
  authorAge: number | null;
  origin: ArtworkOrigin;
  status: ArtworkStatus;
  imageUrl: string;
  storagePath: string;
  width: number;
  height: number;
  createdAt: string;
  /** True when the shop retired it: the owner cannot put it back. */
  hiddenByAdmin: boolean;
  /** True when the signed-in visitor is the account that published it. */
  mine: boolean;
};

type ArtworkRow = {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  author_name: string;
  author_age: number | null;
  origin: ArtworkOrigin;
  status: ArtworkStatus;
  storage_path: string;
  width: number;
  height: number;
  hidden_by_admin: boolean;
  created_at: string;
};

const SELECT = `
  id, user_id, slug, title, author_name, author_age, origin, status,
  storage_path, width, height, hidden_by_admin, created_at
`;

function toArtwork(row: ArtworkRow, viewerId: string | null): Artwork {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    authorName: row.author_name,
    authorAge: row.author_age,
    origin: row.origin,
    status: row.status,
    imageUrl: mediaUrl(row.storage_path),
    storagePath: row.storage_path,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
    hiddenByAdmin: row.hidden_by_admin,
    mine: viewerId !== null && row.user_id === viewerId,
  };
}

/**
 * The public grid, newest first.
 *
 * Signed in, this also returns your own hidden drawings — which is correct for
 * the account tab and wrong for the public wall, so the gallery page filters on
 * `status` for display. The alternative, a second query, would mean the wall and
 * "mis dibujos" could show different data for the same drawing.
 */
export const listArtworks = cache(async (limit = 120): Promise<Artwork[]> => {
  const [supabase, user] = await Promise.all([createClient(), getUser()]);

  const { data, error } = await supabase
    .from("artworks")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return (data as ArtworkRow[]).map((row) => toArtwork(row, user?.id ?? null));
});

/**
 * The same wall, oldest first.
 *
 * The homepage band leads with the drawing that started the gallery rather than
 * with the newest one: the first family to publish keeps its place there instead
 * of being pushed off the front page by whoever painted something this morning.
 *
 * Same rules as {@link listArtworks} — RLS does the filtering and the caller
 * filters `status` for display — so it can return the viewer's own hidden rows.
 * Fetch a few more than you mean to show.
 */
export const listFirstArtworks = cache(async (limit = 12): Promise<Artwork[]> => {
  const [supabase, user] = await Promise.all([createClient(), getUser()]);

  const { data, error } = await supabase
    .from("artworks")
    .select(SELECT)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error || !data) return [];
  return (data as ArtworkRow[]).map((row) => toArtwork(row, user?.id ?? null));
});

/** One drawing. Null when it does not exist, or is hidden and not yours. */
export const getArtworkBySlug = cache(async (slug: string): Promise<Artwork | null> => {
  const [supabase, user] = await Promise.all([createClient(), getUser()]);

  const { data, error } = await supabase
    .from("artworks")
    .select(SELECT)
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;
  return toArtwork(data as ArtworkRow, user?.id ?? null);
});

/** Everything the signed-in account has published, including what it hid. */
export const listMyArtworks = cache(async (): Promise<Artwork[]> => {
  const user = await getUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("artworks")
    .select(SELECT)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return (data as ArtworkRow[]).map((row) => toArtwork(row, user.id));
});

/**
 * The moderation list: everything, hidden included.
 *
 * Only an administrator gets more than the published rows back, and that is the
 * policy's doing rather than this function's — a customer who called it would
 * get the public wall.
 */
export const listArtworksForAdmin = cache(async (limit = 300): Promise<Artwork[]> => {
  const [supabase, user] = await Promise.all([createClient(), getUser()]);

  const { data, error } = await supabase
    .from("artworks")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return (data as ArtworkRow[]).map((row) => toArtwork(row, user?.id ?? null));
});
