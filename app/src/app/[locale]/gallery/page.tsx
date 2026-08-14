import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArtworkGrid } from "@/components/gallery/artwork-card";
import { UploadPanel } from "@/components/gallery/upload-panel";
import { BrushIcon } from "@/components/icons";
import { Breadcrumbs } from "@/components/ui/bits";
import { ButtonLink } from "@/components/ui/button";
import { listArtworks } from "@/lib/db/gallery";
import { isLocale, LOCALE_META, LOCALES } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";
import { legalSlug } from "@/lib/pages";
import { getUser } from "@/lib/supabase/server";

export async function generateMetadata(props: PageProps<"/[locale]/gallery">): Promise<Metadata> {
  const { locale } = await props.params;
  if (!isLocale(locale)) return {};
  const t = await getDictionary(locale);

  return {
    title: t.gallery.title,
    description: t.gallery.blurb,
    keywords: [...t.meta.keywords, ...t.gallery.keywords],
    alternates: {
      canonical: href(locale, "gallery"),
      languages: Object.fromEntries(
        LOCALES.map((other) => [LOCALE_META[other].hrefLang, href(other, "gallery")]),
      ),
    },
  };
}

/**
 * La galería de los peques.
 *
 * Two ways in, side by side and equally weighted, because they answer two
 * different situations at the same stand: a child who brought a drawing on paper
 * photographs it, and a child who did not paints one here.
 *
 * The wall below shows what has been published. `listArtworks` returns the
 * viewer's own hidden drawings as well — that is what the account tab wants —
 * so the public wall filters them out here rather than making a second query
 * that could disagree with the first.
 */
export default async function GalleryPage(props: PageProps<"/[locale]/gallery">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();

  const [t, artworks, user] = await Promise.all([
    getDictionary(locale),
    listArtworks(),
    getUser(),
  ]);

  const wall = artworks.filter((artwork) => artwork.status === "published");
  const galleryHref = href(locale, "gallery");
  const privacyHref = href(locale, "legal", legalSlug("privacidad", locale));

  return (
    <div className="shell py-6 lg:py-10">
      <Breadcrumbs
        label={t.plp.breadcrumbHome}
        trail={[{ label: t.plp.breadcrumbHome, href: href(locale) }, { label: t.gallery.title }]}
        className="mb-5"
      />

      <p className="eyebrow mb-3 text-flame">{t.gallery.eyebrow}</p>
      <h1 className="text-[clamp(2rem,5vw,3.5rem)] leading-[0.9]">{t.gallery.title}</h1>
      <p className="mt-3 max-w-2xl text-[1.0625rem] leading-relaxed text-mute">
        {t.gallery.blurb}
      </p>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <ButtonLink href={href(locale, "studio")} size="lg">
          <BrushIcon className="size-5" />
          {t.gallery.paintCta}
        </ButtonLink>

        <UploadPanel signedIn={user !== null} returnTo={galleryHref} privacyHref={privacyHref} />
      </div>

      <p className="mt-3 max-w-2xl text-[0.8125rem] leading-relaxed text-mute">
        {t.gallery.consentNotice}
      </p>

      <div className="mt-10 border-t border-line pt-8">
        {wall.length === 0 ? (
          /*
            A brand-new shop has an empty wall, and that is not an error state —
            it is an invitation. No apology, no "no results" heading.
          */
          <div className="flex flex-col items-start gap-4 border border-line p-8">
            <p className="font-display text-xl font-bold uppercase">{t.gallery.emptyTitle}</p>
            <p className="text-[0.9375rem] text-mute">{t.gallery.emptyBlurb}</p>
            <ButtonLink href={href(locale, "studio")}>{t.gallery.paintCta}</ButtonLink>
          </div>
        ) : (
          <>
            <h2 className="section-title mb-5">
              {t.gallery.wall}
              <span className="ml-3 font-sans text-[0.875rem] font-normal normal-case tracking-normal text-mute">
                {wall.length}
              </span>
            </h2>
            <ArtworkGrid artworks={wall} locale={locale} t={t} />
          </>
        )}
      </div>
    </div>
  );
}
