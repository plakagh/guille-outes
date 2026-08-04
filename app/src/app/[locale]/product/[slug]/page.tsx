import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ProductDetail } from "@/components/product/product-detail";
import { ProductRail } from "@/components/product/product-rail";
import { Breadcrumbs, Stars } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { inStock, relatedProducts } from "@/lib/catalog";
import { findProduct, getCatalog } from "@/lib/db/catalog";
import { isLocale, LOCALE_META, LOCALES } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";
import { helpSlug } from "@/lib/pages";

export async function generateMetadata(
  props: PageProps<"/[locale]/product/[slug]">,
): Promise<Metadata> {
  const { locale, slug } = await props.params;
  if (!isLocale(locale)) return {};

  const catalog = await getCatalog(locale);
  const product = findProduct(catalog, slug);
  if (!product) return {};

  return {
    title: product.name,
    description: product.description,
    keywords: product.keywords,
    alternates: {
      canonical: href(locale, "product", product.slugs[locale]),
      languages: Object.fromEntries(
        LOCALES.map((other) => [
          LOCALE_META[other].hrefLang,
          href(other, "product", product.slugs[other]),
        ]),
      ),
    },
    openGraph: {
      title: product.name,
      description: product.description,
      url: href(locale, "product", product.slugs[locale]),
    },
  };
}

export default async function ProductPage(props: PageProps<"/[locale]/product/[slug]">) {
  const { locale, slug } = await props.params;
  if (!isLocale(locale)) notFound();

  const [t, catalog] = await Promise.all([getDictionary(locale), getCatalog(locale)]);
  const product = findProduct(catalog, slug);
  if (!product) notFound();

  // Canonicalise: a slug from another language resolves, then redirects here.
  if (product.slug && product.slug !== slug) {
    redirect(href(locale, "product", product.slug));
  }

  const category = catalog.categories.find((c) => c.id === product.categoryId);
  const collection = catalog.collections.find((c) => c.id === product.collectionId);
  const related = relatedProducts(catalog.products, product, 10);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.ref,
    brand: { "@type": "Brand", name: t.meta.siteName },
    ...(product.credits.length > 0
      ? { creator: product.credits.map((c) => ({ "@type": "Person", name: c.name })) }
      : {}),
    aggregateRating:
      product.reviews > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: product.rating,
            reviewCount: product.reviews,
          }
        : undefined,
    offers: {
      "@type": "Offer",
      price: (product.price / 100).toFixed(2),
      priceCurrency: "EUR",
      availability: inStock(product)
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Catalogue data from our own database; no visitor input reaches this.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="shell pt-4">
        <Breadcrumbs
          label={t.plp.breadcrumbHome}
          trail={[
            { label: t.plp.breadcrumbHome, href: href(locale) },
            { label: t.plp.breadcrumbShop, href: href(locale, "shop") },
            ...(category
              ? [{ label: category.name, href: href(locale, "shop", category.slug) }]
              : []),
            { label: product.name },
          ]}
        />
      </div>

      <ProductDetail
        product={product}
        collection={collection ? { name: collection.name, slug: collection.slug } : undefined}
        // Resolved here so the client bundle never imports src/lib/pages.ts.
        sizeGuideHref={href(locale, "help", helpSlug("tallas", locale))}
      />

      <ReviewSummary t={t} rating={product.rating} reviews={product.reviews} />

      <ProductRail
        title={t.pdp.completeLook}
        eyebrow={collection ? collection.name : t.pdp.alsoLike}
        products={related}
        catalog={catalog}
        linkLabel={t.common.viewAll}
        className="border-t border-line"
      />
    </>
  );
}

/**
 * Aggregate rating panel. The distribution is derived from the stored average,
 * so the section never invents review text — real testimonials arrive when a
 * review provider is wired in.
 */
function ReviewSummary({
  t,
  rating,
  reviews,
}: {
  t: Dictionary;
  rating: number;
  reviews: number;
}) {
  if (reviews === 0) return null;

  const distribution = [5, 4, 3, 2, 1].map((stars) => {
    const distance = Math.abs(stars - rating);
    const weight = Math.max(0, 1 - distance / 2.2) ** 2.6;
    return { stars, weight };
  });
  const totalWeight = distribution.reduce((total, row) => total + row.weight, 0) || 1;

  return (
    <section className="border-t border-line bg-shell">
      <div className="shell grid gap-8 py-10 lg:grid-cols-[auto_1fr_auto] lg:items-center lg:gap-14 lg:py-12">
        <div>
          <h2 className="text-2xl">{t.pdp.reviewsHeading}</h2>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-5xl font-bold leading-none">
              {rating.toFixed(1)}
            </span>
            <span className="text-[0.875rem] text-mute">/ 5</span>
          </p>
          <Stars rating={rating} showCount={false} className="mt-2" label={t.pdp.outOf5} />
          <p className="mt-1 text-[0.8125rem] text-mute">
            {reviews} {reviews === 1 ? t.pdp.verifiedReview : t.pdp.verifiedReviews}
          </p>
        </div>

        <ul className="max-w-md space-y-1.5">
          {distribution.map(({ stars, weight }) => {
            const share = Math.round((weight / totalWeight) * 100);
            return (
              <li key={stars} className="flex items-center gap-3 text-[0.8125rem]">
                <span className="w-10 shrink-0 tabular-nums text-mute">{stars} ★</span>
                <span className="h-2 flex-1 bg-shell-deep">
                  <span className="block h-full bg-ink" style={{ width: `${share}%` }} />
                </span>
                <span className="w-9 shrink-0 text-right tabular-nums text-mute">{share} %</span>
              </li>
            );
          })}
        </ul>

        <Button variant="outline">{t.pdp.writeReview}</Button>
      </div>
    </section>
  );
}
