import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CatalogView } from "@/components/catalog/catalog-view";
import { hasOutlet, listProducts, type Catalog, type Filters } from "@/lib/catalog";
import { getCatalog } from "@/lib/db/catalog";
import { isLocale, LOCALE_META, LOCALES, type Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";
import {
  audienceFromSlug,
  AUDIENCE_SLUGS,
  curatedFromSlug,
  CURATED_SLUGS,
} from "@/lib/i18n/sections";
import { activeChips, buildFacets, parseFilters, parsePage, QK } from "@/lib/query";

/**
 * One route serves three kinds of section: a product category, an audience, or
 * a curated view. Whichever dimension the section pins is removed from the
 * facet list, since refining it would be a no-op.
 */
type Section = {
  eyebrow: string;
  title: string;
  blurb: string;
  filters: Filters;
  locked: string[];
  /** This section's slug in every locale, for hreflang and canonical links. */
  slugs: Record<Locale, string>;
};

function resolve(
  section: string,
  locale: Locale,
  t: Dictionary,
  catalog: Catalog,
): Section | null {
  const curated = curatedFromSlug(section);
  if (curated) {
    // An outlet with nothing in it is not a section. Every link that led here is
    // already gone; the listing itself goes too, rather than printing
    // "Outlet hasta -50 %" over nothing.
    if (curated === "outlet" && !hasOutlet(catalog.products)) return null;

    const copy = {
      novedades: { eyebrow: t.plp.newEyebrow, title: t.plp.newTitle, blurb: t.plp.newBlurb },
      outlet: {
        eyebrow: t.plp.outletEyebrow,
        title: t.plp.outletTitle,
        blurb: t.plp.outletBlurb,
      },
      "mas-vendido": {
        eyebrow: t.plp.bestEyebrow,
        title: t.plp.bestTitle,
        blurb: t.plp.bestBlurb,
      },
    }[curated];

    const filters: Filters =
      curated === "outlet"
        ? { onSale: true }
        : curated === "novedades"
          ? { sort: "novedades" }
          : { sort: "destacados" };

    return { ...copy, filters, locked: [], slugs: CURATED_SLUGS[curated] };
  }

  const category = catalog.categories.find((c) =>
    Object.values(c.slugs).includes(section),
  );
  if (category) {
    return {
      eyebrow: t.plp.category,
      title: category.heading,
      blurb: category.blurb,
      filters: { categories: [category.id] },
      locked: [QK.category],
      slugs: category.slugs,
    };
  }

  const audience = audienceFromSlug(section);
  if (audience) {
    const labels = {
      hombre: t.nav.men,
      mujer: t.nav.women,
      ninos: t.nav.kids,
      unisex: t.nav.everyone,
    };
    return {
      eyebrow: t.plp.collection,
      title: labels[audience],
      blurb: `${t.plp.audienceBlurb} ${labels[audience].toLowerCase()}.`,
      filters: { audiences: [audience] },
      locked: [QK.audience],
      slugs: AUDIENCE_SLUGS[audience],
    };
  }

  return null;
}

export async function generateMetadata(
  props: PageProps<"/[locale]/shop/[section]">,
): Promise<Metadata> {
  const { locale, section } = await props.params;
  if (!isLocale(locale)) return {};

  const [t, catalog] = await Promise.all([getDictionary(locale), getCatalog(locale)]);
  const resolved = resolve(section, locale, t, catalog);
  if (!resolved) return {};

  const category = catalog.categories.find((c) => Object.values(c.slugs).includes(section));

  return {
    title: resolved.title,
    description: resolved.blurb,
    keywords: category?.keywords ?? t.meta.keywords,
    alternates: {
      canonical: href(locale, "shop", resolved.slugs[locale]),
      languages: Object.fromEntries(
        LOCALES.map((other) => [
          LOCALE_META[other].hrefLang,
          href(other, "shop", resolved.slugs[other]),
        ]),
      ),
    },
  };
}

export default async function SectionPage(props: PageProps<"/[locale]/shop/[section]">) {
  const [{ locale, section }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  if (!isLocale(locale)) notFound();

  const [t, catalog] = await Promise.all([getDictionary(locale), getCatalog(locale)]);
  const resolved = resolve(section, locale, t, catalog);
  if (!resolved) notFound();

  // A slug written in another language still resolves; send it to this locale's
  // canonical URL so only one address is indexed per language.
  const canonicalSlug = resolved.slugs[locale];
  if (canonicalSlug && canonicalSlug !== section) {
    redirect(href(locale, "shop", canonicalSlug));
  }

  const filters = parseFilters(searchParams, catalog, resolved.filters);
  const products = listProducts(catalog.products, filters);
  const facets = buildFacets(catalog, filters, t, locale, resolved.locked);

  return (
    <CatalogView
      locale={locale}
      t={t}
      catalog={catalog}
      eyebrow={resolved.eyebrow}
      title={resolved.title}
      blurb={resolved.blurb}
      trail={[
        { label: t.plp.breadcrumbHome, href: href(locale) },
        { label: t.plp.breadcrumbShop, href: href(locale, "shop") },
        { label: resolved.title },
      ]}
      products={products}
      facets={facets}
      chips={activeChips(searchParams, facets, t)}
      page={parsePage(searchParams)}
      basePath={href(locale, "shop", canonicalSlug)}
      searchParams={searchParams}
    />
  );
}
