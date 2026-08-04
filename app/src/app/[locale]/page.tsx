import { notFound } from "next/navigation";
import { HeroCarousel, type HeroSlide } from "@/components/home/hero-carousel";
import {
  AuthorsBand,
  BrandNote,
  CategoryTiles,
  CollectionCards,
  EditorialSplit,
  OutletBand,
} from "@/components/home/sections";
import { ProductRail } from "@/components/product/product-rail";
import { colorway, hasOutlet, listProducts, type Catalog } from "@/lib/catalog";
import { getCatalog } from "@/lib/db/catalog";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";
import { helpSlug } from "@/lib/pages";
import { audienceSlug, curatedSlug } from "@/lib/i18n/sections";

/**
 * Hero slides are editorial, so their copy lives in the dictionary while the
 * artwork keys off real collections. If a collection is missing from the
 * database its slide is dropped rather than linking nowhere — and the outlet
 * slide goes the same way when nothing is discounted, since a hero shouting
 * "hasta -50 %" over an empty listing is the worst version of that promise.
 */
function buildSlides(locale: Locale, t: Dictionary, catalog: Catalog): HeroSlide[] {
  const slugOf = (id: string) => catalog.collections.find((c) => c.id === id)?.slug;

  const court = slugOf("court-series");
  const origen = slugOf("origen");
  const hardwood = slugOf("hardwood-94");

  const candidates: (HeroSlide | null)[] = [
    court
      ? {
          eyebrow: t.home.slides.court.eyebrow,
          headline: [t.home.slides.court.line1, t.home.slides.court.line2],
          blurb: t.home.slides.court.blurb,
          primary: {
            label: t.home.slides.court.primary,
            href: href(locale, "collection", court),
          },
          secondary: {
            label: t.home.slides.court.secondary,
            href: href(locale, "shop", curatedSlug("novedades", locale)),
          },
          ghost: "94",
          background: "#132a5a",
          ink: "light",
          art: { shape: "jersey", colorway: colorway("electrico", locale), print: "number" },
        }
      : null,
    origen
      ? {
          eyebrow: t.home.slides.origin.eyebrow,
          headline: [t.home.slides.origin.line1, t.home.slides.origin.line2],
          blurb: t.home.slides.origin.blurb,
          primary: {
            label: t.home.slides.origin.primary,
            href: href(locale, "collection", origen),
          },
          secondary: {
            label: t.home.slides.origin.secondary,
            href: href(locale, "help", helpSlug("fabricacion", locale)),
          },
          ghost: "150",
          background: "#7a1225",
          ink: "light",
          art: { shape: "tee", colorway: colorway("granate", locale), print: "monogram" },
        }
      : null,
    hardwood
      ? {
          eyebrow: t.home.slides.hardwood.eyebrow,
          headline: [t.home.slides.hardwood.line1, t.home.slides.hardwood.line2],
          blurb: t.home.slides.hardwood.blurb,
          primary: {
            label: t.home.slides.hardwood.primary,
            href: href(locale, "collection", hardwood),
          },
          secondary: {
            label: t.home.slides.hardwood.secondary,
            href: href(locale, "shop"),
          },
          ghost: "94",
          background: "#e5dfd2",
          ink: "dark",
          art: { shape: "hoodie", colorway: colorway("arena", locale), print: "wordmark" },
        }
      : null,
    hasOutlet(catalog.products)
      ? {
          eyebrow: t.home.slides.outlet.eyebrow,
          headline: [t.home.slides.outlet.line1, t.home.slides.outlet.line2],
          blurb: t.home.slides.outlet.blurb,
          primary: {
            label: t.home.slides.outlet.primary,
            href: href(locale, "shop", curatedSlug("outlet", locale)),
          },
          ghost: "sale",
          background: "#141414",
          ink: "light",
          art: { shape: "cap", colorway: colorway("negro", locale), print: "monogram" },
        }
      : null,
  ];

  return candidates.filter((slide): slide is HeroSlide => slide !== null);
}

export default async function HomePage(props: PageProps<"/[locale]">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();

  const [t, catalog] = await Promise.all([getDictionary(locale), getCatalog(locale)]);
  const { products } = catalog;

  const bestsellers = listProducts(products, { sort: "destacados" }).slice(0, 10);
  const newIn = listProducts(products, { sort: "novedades" }).slice(0, 10);
  const outlet = listProducts(products, { onSale: true, sort: "destacados" }).slice(0, 10);
  const kids = listProducts(products, { audiences: ["ninos"], sort: "destacados" }).slice(0, 10);

  const common = { locale, t, catalog };

  return (
    <>
      <HeroCarousel slides={buildSlides(locale, t, catalog)} />

      <CategoryTiles {...common} />

      <ProductRail
        title={t.home.bestSellers}
        eyebrow={t.home.fanChoice}
        products={bestsellers}
        catalog={catalog}
        href={href(locale, "shop", curatedSlug("mas-vendido", locale))}
        linkLabel={t.common.viewAll}
      />

      <CollectionCards {...common} />

      <ProductRail
        title={t.home.justArrived}
        eyebrow={t.home.newIn}
        products={newIn}
        catalog={catalog}
        href={href(locale, "shop", curatedSlug("novedades", locale))}
        linkLabel={t.common.viewAll}
      />

      <AuthorsBand {...common} />

      <EditorialSplit locale={locale} t={t} />

      <OutletBand {...common} products={outlet} />

      <ProductRail
        title={t.home.forKids}
        eyebrow={t.home.kidsEyebrow}
        products={kids}
        catalog={catalog}
        href={href(locale, "shop", audienceSlug("ninos", locale))}
        linkLabel={t.common.viewAll}
      />

      <BrandNote t={t} />
    </>
  );
}
