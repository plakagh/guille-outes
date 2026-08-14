import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArtworkTee } from "@/components/gallery/artwork-tee";
import { ArtworkOwnerPanel } from "@/components/gallery/artwork-owner";
import { ArtworkGrid } from "@/components/gallery/artwork-card";
import { Badge, Breadcrumbs } from "@/components/ui/bits";
import { ButtonLink } from "@/components/ui/button";
import { getCatalog } from "@/lib/db/catalog";
import { getArtworkBySlug, listArtworks } from "@/lib/db/gallery";
import { creditLine } from "@/lib/gallery/model";
import { isLocale, LOCALE_META, LOCALES } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";
import { getViewer } from "@/lib/supabase/server";

export async function generateMetadata(
  props: PageProps<"/[locale]/gallery/[slug]">,
): Promise<Metadata> {
  const { locale, slug } = await props.params;
  if (!isLocale(locale)) return {};

  const [t, artwork] = await Promise.all([getDictionary(locale), getArtworkBySlug(slug)]);
  if (!artwork) return {};

  const credit = creditLine(artwork.authorName, artwork.authorAge, t.gallery.years);

  return {
    title: `${artwork.title} — ${credit}`,
    description: t.gallery.metaDescription,
    openGraph: { images: [{ url: artwork.imageUrl }] },
    // A drawing its family has taken off the wall is still reachable by its own
    // owner, so the page exists — but it must not be indexed while it is down.
    robots:
      artwork.status === "published"
        ? undefined
        : { index: false, follow: false },
    alternates: {
      // The slug is the child's own title and is not translated, so every
      // language points at the same one.
      canonical: href(locale, "gallery", slug),
      languages: Object.fromEntries(
        LOCALES.map((other) => [LOCALE_META[other].hrefLang, href(other, "gallery", slug)]),
      ),
    },
  };
}

export default async function ArtworkPage(props: PageProps<"/[locale]/gallery/[slug]">) {
  const { locale, slug } = await props.params;
  if (!isLocale(locale)) notFound();

  const [t, artwork, viewer] = await Promise.all([
    getDictionary(locale),
    getArtworkBySlug(slug),
    getViewer(),
  ]);

  // Not published and not yours resolves to nothing at all through RLS, so this
  // one branch covers "never existed" and "taken down" without leaking which.
  if (!artwork) notFound();

  const [catalog, others] = await Promise.all([getCatalog(locale), listArtworks(24)]);

  const printable = catalog.products.filter((product) => product.artworkPrintable);
  const credit = creditLine(artwork.authorName, artwork.authorAge, t.gallery.years);

  const more = others
    .filter((other) => other.status === "published" && other.id !== artwork.id)
    .slice(0, 5);

  return (
    <div className="shell py-6 lg:py-10">
      <Breadcrumbs
        label={t.plp.breadcrumbHome}
        trail={[
          { label: t.plp.breadcrumbHome, href: href(locale) },
          { label: t.gallery.title, href: href(locale, "gallery") },
          { label: artwork.title },
        ]}
        className="mb-5"
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-12">
        <div>
          <div className="flex items-center justify-center border border-line bg-shell p-4 lg:p-8">
            {/* eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL, sized by CSS */}
            <img
              src={artwork.imageUrl}
              alt={artwork.title}
              width={artwork.width}
              height={artwork.height}
              className="max-h-[70vh] w-auto max-w-full object-contain"
            />
          </div>
        </div>

        <div className="space-y-6">
          <div>
            {artwork.status === "hidden" && (
              <p className="mb-3">
                <Badge tone="soldout">
                  {artwork.hiddenByAdmin ? t.gallery.retired : t.gallery.hidden}
                </Badge>
              </p>
            )}

            <p className="eyebrow mb-2 text-ink-soft">{t.gallery.eyebrow}</p>
            <h1 className="text-[clamp(1.75rem,4.5vw,3rem)] leading-[0.95]">{artwork.title}</h1>
            <p className="mt-3 text-[1.0625rem] text-mute">
              {t.gallery.by} <span className="font-semibold text-ink">{credit}</span>
            </p>
            <p className="mt-1 text-[0.8125rem] text-mute">
              {new Date(artwork.createdAt).toLocaleDateString(locale)} ·{" "}
              {artwork.origin === "painted" ? t.gallery.originPainted : t.gallery.originUpload}
            </p>
          </div>

          {/*
            The shirt is offered here and nowhere earlier: nobody arrives wanting
            a shirt with a drawing on it, they arrive having just made one. With
            no printable product ticked in the admin panel there is no section at
            all — the same rule the video and the framed preview follow.
          */}
          {printable.length > 0 && artwork.status === "published" && (
            <ArtworkTee
              artwork={{
                id: artwork.id,
                slug: artwork.slug,
                title: artwork.title,
                author: credit,
                imageUrl: artwork.imageUrl,
              }}
              products={printable}
            />
          )}

          {artwork.mine && <ArtworkOwnerPanel artwork={artwork} />}

          <div className="flex flex-wrap gap-3">
            <ButtonLink href={href(locale, "studio")} variant="outline">
              {t.gallery.paintCta}
            </ButtonLink>
            <ButtonLink href={href(locale, "gallery")} variant="ghost">
              {t.gallery.backToWall}
            </ButtonLink>
          </div>
        </div>
      </div>

      {more.length > 0 && (
        <section className="mt-14 border-t border-line pt-8">
          <h2 className="section-title mb-5">{t.gallery.moreDrawings}</h2>
          <ArtworkGrid artworks={more} locale={locale} t={t} />
        </section>
      )}

      {/*
        `VisualArtwork`, with no `creator`.

        Every other structured-data block on this site names its author — the
        products credit a `Person`, and the author pages are one. This one
        deliberately does not: asserting a Person entity for a seven-year-old,
        machine-readable and ready to be linked to whatever else carries that
        name, is a different act from printing "Martina, 7 años" on a page. The
        credit is visible to a reader and unavailable as data.
      */}
      {artwork.status === "published" && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "VisualArtwork",
              name: artwork.title,
              image: artwork.imageUrl,
              dateCreated: artwork.createdAt,
              artform: artwork.origin === "painted" ? "Digital drawing" : "Drawing",
            }),
          }}
        />
      )}

      {viewer?.isAdmin && (
        <p className="mt-10 text-[0.8125rem] text-mute">
          <a className="underline" href={`${href(locale, "admin")}/gallery`}>
            {t.gallery.admin.tab}
          </a>
        </p>
      )}
    </div>
  );
}
