import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthorAvatar, WorkEntry } from "@/components/authors/author-card";
import { Breadcrumbs } from "@/components/ui/bits";
import { getCatalog } from "@/lib/db/catalog";
import { isLocale, LOCALE_META, LOCALES } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";

export async function generateMetadata(
  props: PageProps<"/[locale]/bibliography">,
): Promise<Metadata> {
  const { locale } = await props.params;
  if (!isLocale(locale)) return {};
  const t = await getDictionary(locale);

  return {
    title: t.authors.bibliographyTitle,
    description: t.authors.bibliographyBlurb,
    alternates: {
      canonical: href(locale, "bibliography"),
      languages: Object.fromEntries(
        LOCALES.map((other) => [LOCALE_META[other].hrefLang, href(other, "bibliography")]),
      ),
    },
  };
}

export default async function BibliographyPage(props: PageProps<"/[locale]/bibliography">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();

  const [t, catalog] = await Promise.all([getDictionary(locale), getCatalog(locale)]);
  const withWorks = catalog.authors.filter((author) => author.works.length > 0);

  return (
    <div className="shell py-6 lg:py-10">
      <Breadcrumbs
        label={t.plp.breadcrumbHome}
        trail={[
          { label: t.plp.breadcrumbHome, href: href(locale) },
          { label: t.authors.title, href: href(locale, "authors") },
          { label: t.authors.bibliographyTitle },
        ]}
        className="mb-5"
      />

      <p className="eyebrow mb-3 text-flame">{t.authors.bibliographyEyebrow}</p>
      <h1 className="text-[clamp(2rem,5vw,3.5rem)] leading-[0.9]">
        {t.authors.bibliographyTitle}
      </h1>
      <p className="mt-3 max-w-2xl text-[1.0625rem] leading-relaxed text-mute">
        {t.authors.bibliographyBlurb}
      </p>

      {withWorks.length === 0 ? (
        <p className="mt-10 text-[0.9375rem] text-mute">{t.authors.noWorks}</p>
      ) : (
        <div className="mt-10 space-y-12">
          {withWorks.map((author) => (
            <section key={author.id}>
              <div className="mb-4 flex items-center gap-3 border-b-2 border-ink pb-3">
                <AuthorAvatar author={author} className="size-11 text-[0.875rem]" />
                <div>
                  <h2 className="text-2xl">
                    <Link
                      href={href(locale, "authors", author.slug)}
                      className="hover:text-flame hover:underline"
                    >
                      {author.name}
                    </Link>
                  </h2>
                  <p className="eyebrow text-mute">{author.role}</p>
                </div>
              </div>

              <ul>
                {author.works.map((work) => (
                  <WorkEntry key={work.id} work={work} t={t} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
