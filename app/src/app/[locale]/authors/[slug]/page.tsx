import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AuthorAvatar, WorkEntry } from "@/components/authors/author-card";
import { ProductRail } from "@/components/product/product-rail";
import { Breadcrumbs } from "@/components/ui/bits";
import { findAuthor, getCatalog, productsByAuthor } from "@/lib/db/catalog";
import { isLocale, LOCALE_META, LOCALES } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";
import { SITE_URL, mediaUrl } from "@/lib/supabase/env";

export async function generateMetadata(
  props: PageProps<"/[locale]/authors/[slug]">,
): Promise<Metadata> {
  const { locale, slug } = await props.params;
  if (!isLocale(locale)) return {};

  const catalog = await getCatalog(locale);
  const author = findAuthor(catalog, slug);
  if (!author) return {};

  return {
    title: `${author.name} — ${author.role}`,
    description: author.bio,
    keywords: author.keywords,
    alternates: {
      canonical: href(locale, "authors", author.slugs[locale]),
      languages: Object.fromEntries(
        LOCALES.map((other) => [
          LOCALE_META[other].hrefLang,
          href(other, "authors", author.slugs[other]),
        ]),
      ),
    },
    openGraph: { title: author.name, description: author.bio, type: "profile" },
  };
}

export default async function AuthorPage(props: PageProps<"/[locale]/authors/[slug]">) {
  const { locale, slug } = await props.params;
  if (!isLocale(locale)) notFound();

  const [t, catalog] = await Promise.all([getDictionary(locale), getCatalog(locale)]);
  const author = findAuthor(catalog, slug);
  if (!author) notFound();

  if (author.slug && author.slug !== slug) {
    redirect(href(locale, "authors", author.slug));
  }

  const products = productsByAuthor(catalog, author.id);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: author.name,
    jobTitle: author.role,
    description: author.bio,
    url: `${SITE_URL}${href(locale, "authors", author.slug)}`,
    ...(author.photoPath ? { image: mediaUrl(author.photoPath) } : {}),
    sameAs: author.links.map((link) => link.url),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Author data from our own database; no visitor input reaches this.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="shell py-6 lg:py-10">
        <Breadcrumbs
          label={t.plp.breadcrumbHome}
          trail={[
            { label: t.plp.breadcrumbHome, href: href(locale) },
            { label: t.authors.title, href: href(locale, "authors") },
            { label: author.name },
          ]}
          className="mb-6"
        />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14">
          <div>
            <div className="flex flex-wrap items-center gap-5">
              <AuthorAvatar author={author} className="size-24 text-3xl" />
              <div>
                <p className="eyebrow text-flame">{author.role}</p>
                <h1 className="mt-1 text-[clamp(2rem,5vw,3.5rem)] leading-[0.9]">
                  {author.name}
                </h1>
              </div>
            </div>

            <p className="mt-6 max-w-2xl text-[1.0625rem] leading-relaxed text-ink/80">
              {author.bio}
            </p>

            {author.statement && (
              <blockquote className="mt-6 max-w-2xl border-l-2 border-flame pl-5">
                <p className="eyebrow mb-2 text-mute">{t.authors.statement}</p>
                <p className="font-display text-[clamp(1.25rem,2.5vw,1.75rem)] font-medium uppercase leading-tight">
                  “{author.statement}”
                </p>
              </blockquote>
            )}

            <section className="mt-12">
              <h2 className="mb-2 border-b-2 border-ink pb-3 text-2xl">
                {t.authors.worksBy} {author.name}
              </h2>
              {author.works.length === 0 ? (
                <p className="pt-4 text-[0.9375rem] text-mute">{t.authors.noWorks}</p>
              ) : (
                <ul>
                  {author.works.map((work) => (
                    <WorkEntry key={work.id} work={work} t={t} />
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside className="lg:sticky lg:top-[calc(var(--spacing-masthead)+var(--spacing-navbar)+1.5rem)] lg:self-start">
            <div className="border border-line p-5">
              <dl className="space-y-4 text-[0.875rem]">
                <div>
                  <dt className="eyebrow text-mute">{t.authors.products}</dt>
                  <dd className="font-display text-3xl font-bold">{products.length}</dd>
                </div>
                <div>
                  <dt className="eyebrow text-mute">{t.authors.bibliographyTitle}</dt>
                  <dd className="font-display text-3xl font-bold">{author.works.length}</dd>
                </div>
              </dl>

              {author.links.length > 0 && (
                <div className="mt-5 border-t border-line pt-4">
                  <p className="eyebrow mb-2 text-mute">{t.authors.links}</p>
                  <ul className="space-y-1.5">
                    {author.links.map((link) => (
                      <li key={link.url}>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-[0.875rem] underline hover:text-flame"
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {author.keywords.length > 0 && (
                <div className="mt-5 border-t border-line pt-4">
                  <p className="eyebrow mb-2 text-mute">{t.admin.keywords}</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {author.keywords.map((keyword) => (
                      <li
                        key={keyword}
                        className="bg-shell px-2 py-1 text-[0.75rem] text-ink/75"
                      >
                        {keyword}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {products.length > 0 ? (
        <ProductRail
          title={t.authors.products}
          eyebrow={author.name}
          products={products}
          catalog={catalog}
          linkLabel={t.common.viewAll}
          className="border-t border-line"
        />
      ) : (
        <p className="shell border-t border-line py-10 text-[0.9375rem] text-mute">
          {t.authors.noProducts}
        </p>
      )}
    </>
  );
}
