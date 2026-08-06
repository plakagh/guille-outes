import Link from "next/link";
import { notFound } from "next/navigation";
import { ArtworkModeration } from "@/components/admin/artwork-moderation";
import { Badge } from "@/components/ui/bits";
import { listArtworksForAdmin } from "@/lib/db/gallery";
import { creditLine } from "@/lib/gallery/model";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";

/**
 * Moderating the children's gallery.
 *
 * Drawings go up the moment they are published, so this list is the safety net
 * rather than the gate. What makes that defensible is the account requirement:
 * every drawing here has an adult behind it who ticked a consent box that is
 * stored, verbatim, on the row itself.
 *
 * Read with the administrator's own session — RLS is what returns the hidden
 * rows, not this page.
 */
export const dynamic = "force-dynamic";

export default async function AdminGalleryPage(props: PageProps<"/[locale]/admin/gallery">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();

  const [t, artworks] = await Promise.all([getDictionary(locale), listArtworksForAdmin()]);

  const published = artworks.filter((artwork) => artwork.status === "published").length;
  const retired = artworks.filter((artwork) => artwork.hiddenByAdmin).length;
  const withdrawn = artworks.filter(
    (artwork) => artwork.status === "hidden" && !artwork.hiddenByAdmin,
  ).length;

  const a = t.gallery.admin;

  return (
    <div className="shell py-8">
      <h1 className="text-3xl">{a.title}</h1>
      <p className="mt-2 max-w-2xl text-[0.9375rem] leading-relaxed text-mute">{a.blurb}</p>

      <dl className="mt-6 flex flex-wrap gap-8 border-y border-line py-4">
        <Stat label={a.published} value={published} />
        {/* Two different kinds of "not on the wall", and conflating them would
            hide the one that matters: a family withdrawing their own drawing is
            not a moderation event. */}
        <Stat label={a.withdrawn} value={withdrawn} />
        <Stat label={a.retiredCount} value={retired} />
      </dl>

      {artworks.length === 0 ? (
        <p className="mt-8 text-[0.9375rem] text-mute">{a.empty}</p>
      ) : (
        <ul className="mt-6 divide-y divide-line border-b border-line">
          {artworks.map((artwork) => (
            <li key={artwork.id} className="flex flex-wrap items-center gap-4 py-4">
              <Link
                href={href(locale, "gallery", artwork.slug)}
                className="size-16 shrink-0 bg-shell"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL, sized by CSS */}
                <img
                  src={artwork.imageUrl}
                  alt={artwork.title}
                  loading="lazy"
                  className="size-full object-contain"
                />
              </Link>

              <div className="min-w-0 flex-1">
                <Link
                  href={href(locale, "gallery", artwork.slug)}
                  className="block truncate font-semibold hover:underline"
                >
                  {artwork.title}
                </Link>
                <p className="text-[0.8125rem] text-mute">
                  {creditLine(artwork.authorName, artwork.authorAge, t.gallery.years)} ·{" "}
                  {new Date(artwork.createdAt).toLocaleDateString(locale)} ·{" "}
                  {artwork.origin === "painted"
                    ? t.gallery.originPainted
                    : t.gallery.originUpload}
                </p>
              </div>

              {artwork.status === "published" ? (
                <Badge tone="new">{a.published}</Badge>
              ) : (
                <Badge tone="soldout">
                  {artwork.hiddenByAdmin ? t.gallery.retired : t.gallery.hidden}
                </Badge>
              )}

              <ArtworkModeration id={artwork.id} retired={artwork.hiddenByAdmin} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="eyebrow text-mute">{label}</dt>
      <dd className="font-display text-2xl font-bold">{value}</dd>
    </div>
  );
}
