import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CatalogView } from "@/components/catalog/catalog-view";
import { ProductRail } from "@/components/product/product-rail";
import { listProducts, searchProducts } from "@/lib/catalog";
import { getCatalog } from "@/lib/db/catalog";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";
import {
  activeChips,
  buildFacets,
  parseFilters,
  parsePage,
  QK,
  readQuery,
} from "@/lib/query";

export async function generateMetadata(props: PageProps<"/[locale]/search">): Promise<Metadata> {
  const { locale } = await props.params;
  if (!isLocale(locale)) return {};
  const t = await getDictionary(locale);

  // Search result pages are thin, near-duplicate content: keep them out of the
  // index but let crawlers follow through to the products.
  return { title: t.search.title, robots: { index: false, follow: true } };
}

export default async function SearchPage(props: PageProps<"/[locale]/search">) {
  const [{ locale }, searchParams] = await Promise.all([props.params, props.searchParams]);
  if (!isLocale(locale)) notFound();

  const [t, catalog] = await Promise.all([getDictionary(locale), getCatalog(locale)]);
  const query = readQuery(searchParams);

  if (!query) return <EmptyQuery locale={locale} t={t} />;

  const hits = searchProducts(catalog.products, query);
  if (hits.length === 0) {
    const popular = listProducts(catalog.products, { sort: "destacados" }).slice(0, 10);
    return (
      <>
        <div className="shell py-14">
          <p className="eyebrow mb-3 text-ink-soft">{t.search.nothingFor}</p>
          <h1 className="text-[clamp(2rem,5vw,3.25rem)] leading-[0.9]">
            {t.search.nothingFor} “{query}”
          </h1>
          <p className="mt-4 text-[0.9375rem] leading-relaxed text-mute">
            {t.search.nothingBlurb}
          </p>
          <Suggestions locale={locale} t={t} />
        </div>

        <ProductRail
          title={t.home.bestSellers}
          products={popular}
          catalog={catalog}
          href={href(locale, "shop")}
          linkLabel={t.common.viewAll}
          className="border-t border-line"
        />
      </>
    );
  }

  const filters = parseFilters(searchParams, catalog);
  const hitIds = new Set(hits.map((product) => product.id));

  // Relevance is the default order; an explicit sort hands ordering back to the
  // catalogue so the two never fight.
  const allowed = listProducts(catalog.products, filters);
  const allowedIds = new Set(allowed.map((product) => product.id));
  const products = searchParams[QK.sort]
    ? allowed.filter((product) => hitIds.has(product.id))
    : hits.filter((product) => allowedIds.has(product.id));

  const facets = buildFacets(catalog, filters, t, locale);

  return (
    <CatalogView
      locale={locale}
      t={t}
      catalog={catalog}
      eyebrow={`${hits.length} ${hits.length === 1 ? t.search.result : t.search.results}`}
      title={`“${query}”`}
      trail={[
        { label: t.plp.breadcrumbHome, href: href(locale) },
        { label: `${t.search.resultsFor}: ${query}` },
      ]}
      products={products}
      facets={facets}
      chips={activeChips(searchParams, facets, t)}
      page={parsePage(searchParams)}
      basePath={href(locale, "search")}
      searchParams={searchParams}
    />
  );
}

function Suggestions({ locale, t }: { locale: Locale; t: Dictionary }) {
  return (
    <ul className="mt-6 flex flex-wrap gap-2">
      {t.search.suggestions.map((term) => (
        <li key={term}>
          <Link
            href={`${href(locale, "search")}?${QK.query}=${encodeURIComponent(term)}`}
            className="inline-flex h-10 items-center border border-line px-4 text-[0.875rem] transition hover:border-ink"
          >
            {term}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function EmptyQuery({ locale, t }: { locale: Locale; t: Dictionary }) {
  return (
    <div className="shell py-16">
      <h1 className="text-4xl">{t.search.title}</h1>
      <p className="mt-3 text-[0.9375rem] text-mute">{t.search.blurb}</p>
      <Suggestions locale={locale} t={t} />
    </div>
  );
}
