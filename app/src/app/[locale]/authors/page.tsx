import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthorCard } from "@/components/authors/author-card";
import { Breadcrumbs } from "@/components/ui/bits";
import { ButtonLink } from "@/components/ui/button";
import { getCatalog, productsByAuthor } from "@/lib/db/catalog";
import { isLocale, LOCALE_META, LOCALES } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";

export async function generateMetadata(props: PageProps<"/[locale]/authors">): Promise<Metadata> {
  const { locale } = await props.params;
  if (!isLocale(locale)) return {};
  const [t, catalog] = await Promise.all([getDictionary(locale), getCatalog(locale)]);

  return {
    title: t.authors.title,
    description: t.authors.blurb,
    keywords: [...t.meta.keywords, ...catalog.authors.flatMap((a) => a.keywords)],
    alternates: {
      canonical: href(locale, "authors"),
      languages: Object.fromEntries(
        LOCALES.map((other) => [LOCALE_META[other].hrefLang, href(other, "authors")]),
      ),
    },
  };
}

export default async function AuthorsPage(props: PageProps<"/[locale]/authors">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();

  const [t, catalog] = await Promise.all([getDictionary(locale), getCatalog(locale)]);

  return (
    <div className="shell py-6 lg:py-10">
      <Breadcrumbs
        label={t.plp.breadcrumbHome}
        trail={[{ label: t.plp.breadcrumbHome, href: href(locale) }, { label: t.authors.title }]}
        className="mb-5"
      />

      <p className="eyebrow mb-3 text-ink-soft">{t.authors.eyebrow}</p>
      <h1 className="text-[clamp(2rem,5vw,3.5rem)] leading-[0.9]">{t.authors.title}</h1>
      <p className="mt-3 max-w-2xl text-[1.0625rem] leading-relaxed text-mute">
        {t.authors.blurb}
      </p>
      <ButtonLink href={href(locale, "bibliography")} variant="outline" className="mt-6">
        {t.authors.bibliographyTitle}
      </ButtonLink>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {catalog.authors.map((author) => (
          <li key={author.id}>
            <AuthorCard
              author={author}
              t={t}
              href={href(locale, "authors", author.slug)}
              productCount={productsByAuthor(catalog, author.id).length}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
