import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogView } from "@/components/catalog/catalog-view";
import { listProducts } from "@/lib/catalog";
import { getCatalog } from "@/lib/db/catalog";
import { isLocale, LOCALE_META, LOCALES } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";
import { activeChips, buildFacets, parseFilters, parsePage } from "@/lib/query";

export async function generateMetadata(props: PageProps<"/[locale]/shop">): Promise<Metadata> {
  const { locale } = await props.params;
  if (!isLocale(locale)) return {};
  const t = await getDictionary(locale);

  return {
    title: t.plp.allShop,
    description: t.plp.allShopBlurb,
    keywords: t.meta.keywords,
    alternates: {
      canonical: href(locale, "shop"),
      languages: Object.fromEntries(
        LOCALES.map((other) => [LOCALE_META[other].hrefLang, href(other, "shop")]),
      ),
    },
  };
}

export default async function ShopPage(props: PageProps<"/[locale]/shop">) {
  const [{ locale }, searchParams] = await Promise.all([props.params, props.searchParams]);
  if (!isLocale(locale)) notFound();

  const [t, catalog] = await Promise.all([getDictionary(locale), getCatalog(locale)]);

  const filters = parseFilters(searchParams, catalog);
  const products = listProducts(catalog.products, filters);
  const facets = buildFacets(catalog, filters, t, locale);

  return (
    <CatalogView
      locale={locale}
      t={t}
      catalog={catalog}
      eyebrow={t.plp.fullCatalogue}
      title={t.plp.allShop}
      blurb={t.plp.allShopBlurb}
      trail={[
        { label: t.plp.breadcrumbHome, href: href(locale) },
        { label: t.plp.breadcrumbShop },
      ]}
      products={products}
      facets={facets}
      chips={activeChips(searchParams, facets, t)}
      page={parsePage(searchParams)}
      basePath={href(locale, "shop")}
      searchParams={searchParams}
    />
  );
}
