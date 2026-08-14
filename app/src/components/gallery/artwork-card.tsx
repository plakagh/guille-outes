import Link from "next/link";
import { Badge } from "@/components/ui/bits";
import type { Artwork } from "@/lib/db/gallery";
import { creditLine } from "@/lib/gallery/model";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";

/**
 * One drawing on the wall.
 *
 * Square tiles, uncropped by choice of aspect rather than by cropping: a
 * painting from the studio is square already, and a photograph of a drawing on a
 * table is whatever the phone gave us. `object-cover` on a photograph loses the
 * edges of the paper, which is where children sign their name — so the tile
 * contains the whole image and lets the tile's own background show around it.
 *
 * The credit is "Martina, 7 años", never a surname. See `parseAuthorName` for
 * what stops one getting in.
 */
export function ArtworkCard({
  artwork,
  locale,
  t,
}: {
  artwork: Artwork;
  locale: Locale;
  t: Dictionary;
}) {
  return (
    <Link
      href={href(locale, "gallery", artwork.slug)}
      className="group flex h-full flex-col focus-visible:outline-offset-4"
    >
      <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-shell">
        {/* eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL, sized by CSS */}
        <img
          src={artwork.imageUrl}
          alt={artwork.title}
          loading="lazy"
          className="max-h-full max-w-full object-contain transition-transform duration-500 ease-[var(--ease-out-quint)] group-hover:scale-[1.04]"
        />

        {/* Only ever visible to the owner or an administrator: RLS is what keeps
            a hidden drawing out of everybody else's list in the first place. */}
        {artwork.status === "hidden" && (
          <span className="absolute left-2 top-2">
            <Badge tone="soldout">
              {artwork.hiddenByAdmin ? t.gallery.retired : t.gallery.hidden}
            </Badge>
          </span>
        )}
      </div>

      <p className="mt-2 line-clamp-2 font-display text-[0.9375rem] font-bold uppercase leading-tight group-hover:underline">
        {artwork.title}
      </p>
      <p className="text-[0.8125rem] text-mute">
        {creditLine(artwork.authorName, artwork.authorAge, t.gallery.years)}
      </p>
    </Link>
  );
}

/** The wall itself. Empty is a real state here: a new shop has no drawings. */
export function ArtworkGrid({
  artworks,
  locale,
  t,
}: {
  artworks: Artwork[];
  locale: Locale;
  t: Dictionary;
}) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 lg:gap-5">
      {artworks.map((artwork) => (
        <li key={artwork.id}>
          <ArtworkCard artwork={artwork} locale={locale} t={t} />
        </li>
      ))}
    </ul>
  );
}
