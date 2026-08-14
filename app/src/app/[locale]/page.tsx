import { notFound } from "next/navigation";
import { HeroCarousel, type HeroSlide } from "@/components/home/hero-carousel";
import {
  AuthorsBand,
  BrandNote,
  CategoryTiles,
  CollectionCards,
  EditorialSplit,
  KidsGalleryBand,
  OutletBand,
} from "@/components/home/sections";
import { ProductRail } from "@/components/product/product-rail";
import { photosFor } from "@/components/product/product-shot";
import {
  colorway,
  frameAspect,
  frameOrientation,
  frameSizeOptions,
  hasOutlet,
  isNew,
  listProducts,
  type Catalog,
} from "@/lib/catalog";
import { mediaUrl } from "@/lib/supabase/env";
import { getCatalog } from "@/lib/db/catalog";
import { listFirstArtworks } from "@/lib/db/gallery";
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

  /*
    «A familia pintora que vaga polo mundo» — the project itself, and the one
    slide that is not anchored to anything in the database.

    That is why it is built apart from `candidates` and prepended to whichever
    list wins below. Dropped into `candidates` it would be a slide that is never
    null, which would make `slides.length > 0` always true and quietly retire the
    category fallback underneath it: a shop with no collections would go from
    three category slides to this one alone.

    It leads because it is what the stand leads with. Everything else in the fold
    sells a line; this one says who is selling it.
  */
  const family: HeroSlide = {
    eyebrow: t.family.eyebrow,
    headline: [t.family.line1, t.family.line2],
    subhead: t.family.subhead,
    blurb: t.family.slideBlurb,
    primary: { label: t.family.slidePrimary, href: href(locale, "family") },
    // Painting, not the gallery: "being part of the family" is something you do,
    // and the studio is one tap from a drawing. The gallery is a click further
    // in, from the page the primary CTA lands on.
    secondary: { label: t.family.slideSecondary, href: href(locale, "studio") },
    /*
      Sand. One colour per slide is the rule the fold is now built on — white for
      the cuadros, navy for the garments, this for the project — so that the
      crossfade between them has something to cross and the deck reads as several
      places rather than one that keeps re-lettering itself.

      Warm and light under a board that is almost black: the poster is a dark
      rectangle with its own painted edge, so it needs a ground it can sit on
      rather than one it dissolves into.
    */
    background: "#e5dfd2",
    ink: "dark",
    /*
      The board itself, which is the whole point of the slide — the thing people
      have already read at the stand.

      It lives in `public/` rather than the `media` bucket because it belongs to
      the app and not to the catalogue: nothing about it is a product, no admin
      screen edits it, and it should be versioned with the markup that positions
      it. `app/Dockerfile` copies that folder for the same reason.

      `art` stays filled in because the field is required, but note that it is now
      unreachable: `SlideArt` chooses the drawing only when `imageUrl` is absent,
      not when it 404s. If this file is ever renamed the fold shows a broken
      image, so the name is part of the deploy, not a detail.
    */
    imageUrl: "/familia-pintora.webp",
    imageAlt: t.family.imageAlt,
    art: { shape: "poster", colorway: colorway("marino", locale), print: "monogram" },
  };

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
          background: "#141414",
          ink: "light",
          art: { shape: "cap", colorway: colorway("negro", locale), print: "monogram" },
        }
      : null,
  ];

  const slides = candidates.filter((slide): slide is HeroSlide => slide !== null);
  if (slides.length > 0) return [family, ...slides];

  /*
    Every slide above is anchored to a collection, so a shop that sells by
    category and nothing else would land on a headless homepage. Fall back to the
    categories themselves.

    The copy comes from the database rather than the dictionary: a category is
    already written in all three languages by whoever created it, whereas a
    dictionary entry here would name a collection that does not exist.
  */
  /*
    One colour per slide, and none of them the sand the project slide above
    already holds: the fold crossfades its background rather than cutting it, so
    two neighbours in the same value would fade into nothing.
  */
  const palette = [
    { background: "#ffffff", ink: "dark" as const, colorway: "gris" },
    { background: "#132a5a", ink: "light" as const, colorway: "arena" },
    { background: "#141414", ink: "light" as const, colorway: "negro" },
  ];

  /*
    Each slide leads with a real piece rather than a drawing of one: whatever is
    marked as new in that category and has actually been photographed.

    Which piece varies per slide but is chosen deterministically, from the
    catalogue's own "arrived" ordering rotated by the slide index. A `Math.random`
    here would pick one product on the server and a different one when React
    hydrates, which is a mismatch — and it would also reshuffle the homepage on
    every reload, so a shopper could never go back to what they just saw.
  */
  const newest = listProducts(catalog.products, { sort: "novedades" }).filter(isNew);

  const categorySlides = catalog.categories.slice(0, palette.length).map((category, i) => {
    const inCategory = newest.filter((product) => product.categoryId === category.id);
    const pool = inCategory.length > 0 ? inCategory : newest;
    const pick = pool.length > 0 ? pool[i % pool.length] : undefined;
    const photo = pick ? photosFor(pick, pick.colorways[0]?.id)[0] : undefined;

    /*
      A cuadro leads its slide framed, at the proportions of the format a listing
      shows first — the same frame, mount and measurements the product page draws.
      A garment has nothing to hang and gets no frame.
    */
    const frame = pick?.framePreview ?? null;
    const printSize = frame && pick ? frameSizeOptions(pick, frame)[0] : null;

    return {
      eyebrow: t.header.categories,
      headline: [category.name, ""] as [string, string],
      blurb: category.blurb,
      primary: { label: t.common.viewAll, href: href(locale, "shop", category.slug) },
      secondary: {
        label: t.home.slides.court.secondary,
        href: href(locale, "shop", curatedSlug("novedades", locale)),
      },
      background: palette[i].background,
      ink: palette[i].ink,
      imageUrl: photo ? mediaUrl(photo.path) : undefined,
      imageAlt: pick?.name,
      frame:
        frame && printSize
          ? {
              finish: frame.finishes[0],
              mount: frame.mount,
              aspect: frameAspect(printSize),
              orientation: frameOrientation(printSize),
            }
          : undefined,
      art: {
        shape: pick?.shape ?? (category.id === "camisetas" ? ("tee" as const) : ("poster" as const)),
        colorway: pick?.colorways[0] ?? colorway(palette[i].colorway, locale),
        print: "none" as const,
      },
    };
  });

  return [family, ...categorySlides];
}

export default async function HomePage(props: PageProps<"/[locale]">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();

  const [t, catalog, artworks] = await Promise.all([
    getDictionary(locale),
    getCatalog(locale),
    listFirstArtworks(12),
  ]);
  const { products } = catalog;

  // The band shows the wall, so a drawing its family has hidden is not on it —
  // the query hands back the viewer's own hidden rows for the account tab.
  const drawings = artworks.filter((artwork) => artwork.status === "published");

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

      <KidsGalleryBand locale={locale} t={t} artworks={drawings} />

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
