import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CatalogView } from "@/components/catalog/catalog-view";
import { listProducts } from "@/lib/catalog";
import { findCollection, getCatalog } from "@/lib/db/catalog";
import { isLocale, LOCALE_META, LOCALES } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";
import { activeChips, buildFacets, parseFilters, parsePage, QK } from "@/lib/query";

export async function generateMetadata(
  props: PageProps<"/[locale]/collection/[slug]">,
): Promise<Metadata> {
  const { locale, slug } = await props.params;
  if (!isLocale(locale)) return {};

  const catalog = await getCatalog(locale);
  const collection = findCollection(catalog, slug);
  if (!collection) return {};

  return {
    title: collection.name,
    description: collection.blurb,
    keywords: collection.keywords,
    alternates: {
      canonical: href(locale, "collection", collection.slugs[locale]),
      languages: Object.fromEntries(
        LOCALES.map((other) => [
          LOCALE_META[other].hrefLang,
          href(other, "collection", collection.slugs[other]),
        ]),
      ),
    },
  };
}

export default async function CollectionPage(
  props: PageProps<"/[locale]/collection/[slug]">,
) {
  const [{ locale, slug }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  if (!isLocale(locale)) notFound();

  const [t, catalog] = await Promise.all([getDictionary(locale), getCatalog(locale)]);
  const collection = findCollection(catalog, slug);
  if (!collection) notFound();

  if (collection.slug && collection.slug !== slug) {
    redirect(href(locale, "collection", collection.slug));
  }

  const filters = parseFilters(searchParams, catalog, { collections: [collection.id] });
  const products = listProducts(catalog.products, filters);
  const facets = buildFacets(catalog, filters, t, locale, [QK.collection]);

  return (
    <CatalogView
      locale={locale}
      t={t}
      catalog={catalog}
      eyebrow={collection.tagline}
      title={collection.name}
      blurb={collection.blurb}
      trail={[
        { label: t.plp.breadcrumbHome, href: href(locale) },
        { label: t.nav.collections, href: href(locale, "shop") },
        { label: collection.name },
      ]}
      products={products}
      facets={facets}
      chips={activeChips(searchParams, facets, t)}
      page={parsePage(searchParams)}
      basePath={href(locale, "collection", collection.slug)}
      searchParams={searchParams}
      accent={collection.accent}
    />
  );
}
