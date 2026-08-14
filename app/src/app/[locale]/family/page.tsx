import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/bits";
import { ButtonLink } from "@/components/ui/button";
import { listFirstArtworks } from "@/lib/db/gallery";
import { isLocale, LOCALE_META, LOCALES } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";

export async function generateMetadata(
  props: PageProps<"/[locale]/family">,
): Promise<Metadata> {
  const { locale } = await props.params;
  if (!isLocale(locale)) return {};
  const t = await getDictionary(locale);

  return {
    title: t.family.fullName,
    description: t.family.metaDescription,
    keywords: [...t.meta.keywords, ...t.family.keywords],
    alternates: {
      canonical: href(locale, "family"),
      languages: Object.fromEntries(
        LOCALES.map((other) => [LOCALE_META[other].hrefLang, href(other, "family")]),
      ),
    },
  };
}

/**
 * El proyecto: «A familia pintora que vaga polo mundo».
 *
 * The page the fold's first slide leads to, so it answers the question that
 * slide raises and then hands over: what this is, and how to be part of it.
 *
 * Typographic rather than illustrated. The only images on it are real children's
 * drawings pulled off the wall — the same ones the homepage band shows, and the
 * same reasoning: a stock photograph of "a family painting" on the one page that
 * explains what the family actually does would be the single thing here that is
 * not the project.
 */
export default async function FamilyPage(props: PageProps<"/[locale]/family">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();

  const [t, artworks] = await Promise.all([getDictionary(locale), listFirstArtworks(8)]);
  const drawings = artworks.filter((artwork) => artwork.status === "published");

  return (
    <div className="shell py-6 lg:py-10">
      <Breadcrumbs
        label={t.plp.breadcrumbHome}
        trail={[{ label: t.plp.breadcrumbHome, href: href(locale) }, { label: t.family.eyebrow }]}
        className="mb-5"
      />

      <p className="eyebrow mb-3 text-ink-soft">{t.family.eyebrow}</p>
      {/*
        The name in full, on the page it belongs to. The carousel has to break it
        across two condensed lines and lean on its eyebrow to finish the phrase;
        here there is room to simply say it.
      */}
      <h1 className="max-w-4xl text-[clamp(2rem,5vw,3.5rem)] leading-[0.98]">
        {t.family.fullName}
      </h1>
      {/*
        The name in Galego, then what it means — and nothing at all in Galego,
        where the two would be the same sentence twice.
      */}
      {t.family.nameLocal && (
        <p className="mt-3 max-w-2xl font-sans text-[1.125rem] leading-snug text-ink-soft">
          {t.family.nameLocal}
        </p>
      )}
      <p className="mt-4 max-w-2xl text-[1.0625rem] leading-relaxed text-mute">
        {t.family.lead}
      </p>

      {/*
        The board that opens the stand, at the top of the page that explains it.
        Eager and high priority: it is the largest thing above the fold here, so
        it is what LCP is measuring, and lazy-loading the one image on the page
        would only delay the measurement.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element -- static asset in public/, sized by CSS */}
      <img
        src="/familia-pintora.webp"
        alt={t.family.imageAlt}
        width={1536}
        height={1024}
        fetchPriority="high"
        className="mt-8 w-full max-w-4xl"
      />

      <div className="mt-10 grid gap-8 border-t border-line pt-8 lg:grid-cols-[1.1fr_minmax(0,1fr)] lg:gap-12">
        <div className="space-y-4 text-[0.9375rem] leading-relaxed text-ink-soft">
          {t.family.body.map((paragraph) => (
            <p key={paragraph.slice(0, 24)}>{paragraph}</p>
          ))}
        </div>

        {/*
          The quote off the board itself. It is the one line on the stand that is
          not about the work being for sale, which is why it earns the pull-quote
          treatment rather than sitting in the run of the prose.
        */}
        <figure className="self-start border-l-2 border-ink pl-6">
          <blockquote className="text-[clamp(1.5rem,3vw,2.25rem)] font-display font-bold uppercase leading-[0.98]">
            {t.family.quote}
          </blockquote>
          <figcaption className="eyebrow mt-4 text-mute">{t.family.quoteAuthor}</figcaption>
        </figure>
      </div>

      {/* The mural, and the way in. */}
      <section className="mt-12 grid gap-8 bg-shell p-8 text-ink lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-center lg:gap-12 lg:p-12">
        <div>
          <p className="eyebrow mb-3 text-ink-soft">{t.family.muralTitle}</p>
          <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.02]">
            {t.family.joinTitle}
          </h2>
          <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink-soft">
            {t.family.muralBody}
          </p>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">
            {t.family.joinBlurb}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href={href(locale, "studio")} variant="solid">
              {t.gallery.paintCta}
            </ButtonLink>
            <ButtonLink href={href(locale, "gallery")} variant="outline">
              {t.home.kidsArtSecondary}
            </ButtonLink>
          </div>
        </div>

        {/*
          Nothing at all while the wall is empty, exactly as on the homepage
          band: a placeholder drawing under the words "this is the part that is
          not for sale" would be the one invented thing on the page.
        */}
        {drawings.length > 0 && (
          <ul className="flex flex-wrap gap-3">
            {drawings.slice(0, 5).map((artwork) => (
              <li key={artwork.id} className="min-w-24 max-w-44 flex-1 basis-[calc(20%-0.75rem)]">
                <Link
                  href={href(locale, "gallery", artwork.slug)}
                  className="group block focus-visible:outline-offset-4"
                  title={artwork.title}
                >
                  <span className="flex aspect-square items-center justify-center overflow-hidden bg-white p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL, sized by CSS */}
                    <img
                      src={artwork.imageUrl}
                      alt={artwork.title}
                      loading="lazy"
                      className="max-h-full max-w-full object-contain transition-transform duration-500 ease-[var(--ease-out-quint)] group-hover:scale-105"
                    />
                  </span>
                  <span className="mt-1.5 block truncate text-[0.75rem] text-mute">
                    {artwork.authorName}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-10 border-t border-line pt-8">
        <ButtonLink href={href(locale, "shop")} variant="outline">
          {t.family.shopCta}
        </ButtonLink>
      </div>
    </div>
  );
}
