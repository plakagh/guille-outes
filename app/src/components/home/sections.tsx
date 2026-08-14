import Link from "next/link";
import { ProductShot } from "@/components/product/product-shot";
import { FramedArt, framedAspect } from "@/components/product/framed-art";
import { ArrowRight } from "@/components/icons";
import { ProductCard } from "@/components/product/product-card";
import { SectionHead } from "@/components/ui/bits";
import { ButtonLink } from "@/components/ui/button";
import { Rail } from "@/components/ui/rail";
import { mediaUrl } from "@/lib/supabase/env";
import {
  frameAspect,
  frameOrientation,
  frameSizeOptions,
  type Catalog,
  type Product,
} from "@/lib/catalog";
import type { Artwork } from "@/lib/db/gallery";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";
import { helpSlug } from "@/lib/pages";
import { curatedSlug } from "@/lib/i18n/sections";

type Common = { locale: Locale; t: Dictionary; catalog: Catalog };

/* ------------------------------------------------------- category tiles */

export function CategoryTiles({ locale, t, catalog }: Common) {
  if (catalog.categories.length === 0) return null;

  return (
    <section className="shell py-10 lg:py-14">
      <SectionHead
        title={t.home.shopByCategory}
        href={href(locale, "shop")}
        linkLabel={t.home.wholeCatalogue}
      />

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8 lg:gap-4">
        {catalog.categories.map((category) => {
          const hero = catalog.products.find((p) => p.categoryId === category.id);
          return (
            <li key={category.id}>
              <Link
                href={href(locale, "shop", category.slug)}
                className="group block focus-visible:outline-offset-4"
              >
                <div className="aspect-square overflow-hidden bg-shell">
                  {hero && (
                    <div className="h-full w-full transition-transform duration-500 ease-[var(--ease-out-quint)] group-hover:scale-110">
                      <CategoryFace product={hero} />
                    </div>
                  )}
                </div>
                <p className="mt-2 text-center font-display text-[0.9375rem] font-bold uppercase leading-tight group-hover:text-flame">
                  {category.name}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * The one product standing in for a whole category.
 *
 * A cuadro hangs in its frame here, exactly as it does on a product card and for
 * the same reason: the frame is part of what is being sold, and a tile labelled
 * "cuadros" showing a loose scan advertises a photograph of a sheet of paper.
 * Everything else — a shirt, a tote — has nothing to hang and is shown as it is.
 */
function CategoryFace({ product }: { product: Product }) {
  // Cuadros only: `framePreview` is null for everything that is not sold framed.
  const frame = product.framePreview;
  // The smallest format, as on a card. Nothing has been chosen at this point,
  // and it is the same piece whichever size it is printed at.
  const printSize = frame ? frameSizeOptions(product, frame)[0] : null;

  if (!frame || !printSize) {
    return <ProductShot product={product} colorway={product.colorways[0]} print="none" />;
  }

  /*
    These tiles are squares and a frame is not, so the frame is given the shape
    it will actually have and then sized by whichever side runs out first. The
    product card can size by width because it is nearly the shape of a framed
    portrait already; drawn at a square's full width, the same piece would stand
    a fifth of itself outside the tile — and the tile crops.

    No painted wall behind it either, unlike the card: at this size a gradient
    inside the tile's own shading reads as a border rather than as a room.
  */
  const aspect = framedAspect(printSize, frame.mount);

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className={aspect <= 1 ? "h-full" : "w-full"} style={{ aspectRatio: aspect }}>
        <FramedArt
          finish={frame.finishes[0]}
          mount={frame.mount}
          onWall={false}
          className="h-full w-full"
        >
          <div style={{ aspectRatio: frameAspect(printSize) }}>
            <ProductShot
              product={product}
              colorway={product.colorways[0]}
              print="none"
              bare
              orientation={frameOrientation(printSize)}
            />
          </div>
        </FramedArt>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- collections */

export function CollectionCards({ locale, t, catalog }: Common) {
  // Selling by category alone is a real shape for this shop, not a bug — and a
  // heading with a "view all" link over an empty grid reads as breakage. The
  // section comes back on its own with the first collection.
  if (catalog.collections.length === 0) return null;

  return (
    <section className="shell py-10 lg:py-14">
      <SectionHead
        eyebrow={t.home.fiveLines}
        title={t.home.shopByCollection}
        href={href(locale, "shop")}
        linkLabel={t.common.viewAll}
      />

      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {catalog.collections.map((collection, i) => {
          const hero = catalog.products.find((p) => p.collectionId === collection.id);
          const wide = i === 0;
          return (
            <li key={collection.id} className={wide ? "xl:col-span-2" : undefined}>
              <Link
                href={href(locale, "collection", collection.slug)}
                className="group relative flex h-full items-center gap-4 overflow-hidden p-6 transition-colors sm:gap-8 sm:p-8"
                style={{ backgroundColor: `${collection.accent}1a` }}
              >
                <div className="relative z-10 flex-1">
                  <p className="eyebrow" style={{ color: collection.accent }}>
                    {collection.tagline}
                  </p>
                  <h3 className="mt-2 text-[clamp(1.75rem,3.5vw,2.75rem)] leading-none">
                    {collection.name}
                  </h3>
                  <p className="mt-3 text-[0.875rem] leading-relaxed text-mute">
                    {collection.blurb}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-2 border-b-2 border-ink pb-1 font-display text-[0.875rem] font-bold uppercase tracking-wide">
                    {t.home.viewCollection}
                    <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </span>
                </div>

                {hero && (
                  <div
                    className={`relative z-10 shrink-0 transition-transform duration-500 ease-[var(--ease-out-quint)] group-hover:-rotate-3 ${
                      wide ? "w-40 sm:w-56" : "w-28 sm:w-36"
                    }`}
                  >
                    <ProductShot product={hero} colorway={hero.colorways[0]} print={hero.print} />
                  </div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* --------------------------------------------------------- authors band */

export function AuthorsBand({ locale, t, catalog }: Common) {
  if (catalog.authors.length === 0) return null;

  return (
    <section className="border-y border-line bg-shell">
      <div className="shell py-10 lg:py-14">
        <SectionHead
          eyebrow={t.home.authorsEyebrow}
          title={t.home.meetTheAuthors}
          href={href(locale, "authors")}
          linkLabel={t.home.seeAllAuthors}
        />
        <p className="-mt-2 mb-6 max-w-2xl text-[0.9375rem] leading-relaxed text-mute">
          {t.home.authorsBlurb}
        </p>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {catalog.authors.map((author) => (
            <li key={author.id}>
              <Link
                href={href(locale, "authors", author.slug)}
                className="group flex h-full flex-col gap-3 bg-white p-5 transition hover:shadow-[0_10px_30px_-18px_rgba(0,0,0,0.4)]"
              >
                <span className="grid size-14 place-items-center overflow-hidden rounded-full bg-shell-deep font-display text-xl font-bold uppercase">
                  {author.photoPath ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL, sized by CSS
                    <img
                      src={mediaUrl(author.photoPath)}
                      alt={author.name}
                      className="size-full object-cover"
                    />
                  ) : (
                    author.name
                      .split(" ")
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join("")
                  )}
                </span>
                <span>
                  <span className="block font-display text-lg font-bold uppercase leading-tight group-hover:text-flame">
                    {author.name}
                  </span>
                  <span className="eyebrow mt-1 block text-flame">{author.role}</span>
                </span>
                <span className="line-clamp-3 text-[0.8125rem] leading-snug text-mute">
                  {author.bio}
                </span>
                <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-[0.8125rem] font-semibold">
                  {t.pdp.seeBibliography}
                  <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ editorial */

/*
  The gallery used to share this row with a blue panel of its own. It already
  gets its own band further up the page, so the second mention was doing little
  more than taking half the width; the gift card now runs the full row.
*/
export function EditorialSplit({ locale, t }: Omit<Common, "catalog">) {
  return (
    <section className="shell py-10 lg:py-14">
      <article className="relative overflow-hidden bg-[#e5dfd2] p-8 text-ink lg:p-12">
        <p className="eyebrow mb-3 text-flame">{t.home.giftEyebrow}</p>
        <h3 className="text-[clamp(1.75rem,4vw,2.75rem)] leading-none">
          {t.home.giftTitle}
        </h3>
        <p className="mt-4 max-w-2xl text-[0.9375rem] leading-relaxed text-ink/65">
          {t.home.giftBlurb}
        </p>
        <ButtonLink
          href={href(locale, "help", helpSlug("tarjeta-regalo", locale))}
          variant="solid"
          className="mt-6"
        >
          {t.home.giftCta}
        </ButtonLink>
      </article>
    </section>
  );
}

/* ------------------------------------------------------ kids' art gallery */

/**
 * "Crea el dibujo de tus niños."
 *
 * The invitation on the home page is to **draw**, not to buy: nobody arrives
 * wanting a t-shirt with a child's drawing on it. That offer waits on the
 * drawing's own page, once there is a drawing to put on one.
 *
 * The strip underneath is the last few published drawings, and it is the reason
 * the band works — a child who can see five other children's drawings knows
 * exactly what is being asked of them. With none published yet the band still
 * stands: the invitation is the point, and an empty strip simply does not
 * render.
 */
export function KidsGalleryBand({
  locale,
  t,
  artworks,
}: Omit<Common, "catalog"> & { artworks: Artwork[] }) {
  return (
    <section className="shell py-10 lg:py-14">
      <div className="grid gap-8 bg-[#0b3d5c] p-8 text-white lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-center lg:gap-12 lg:p-12">
        <div>
          <p className="eyebrow mb-3 text-[#ffd400]">{t.home.kidsArtEyebrow}</p>
          {/*
            Looser than the other headings on purpose: the condensed face sets
            its tilde high above the cap, and at 0.95 the Ñ of "NIÑOS" loses it
            to the line above.
          */}
          <h2 className="text-[clamp(1.875rem,4.5vw,3rem)] leading-[1.08]">
            {t.home.kidsArtTitle}
          </h2>
          <p className="mt-4 text-[0.9375rem] leading-relaxed text-white/70">
            {t.home.kidsArtBlurb}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href={href(locale, "studio")} variant="inverse">
              {t.gallery.paintCta}
            </ButtonLink>
            <ButtonLink
              href={href(locale, "gallery")}
              variant="ghost"
              className="bg-white/10 text-white hover:bg-white/20"
            >
              {t.home.kidsArtSecondary}
            </ButtonLink>
          </div>
        </div>

        {/*
          The drawings that started the wall, oldest first — see
          `listFirstArtworks`. Nothing at all when the gallery is empty: an
          invented placeholder drawing on a band that says "publish yours" would
          be the one thing here that is not a real child's work.

          Laid out as a wrapping row rather than a five-column grid so that the
          first family to publish gets a drawing at a size worth looking at,
          instead of one small square in four empty columns.
        */}
        {artworks.length > 0 && (
          <ul className="flex flex-wrap gap-3">
            {artworks.slice(0, 5).map((artwork) => (
              <li key={artwork.id} className="min-w-24 max-w-44 flex-1 basis-[calc(20%-0.75rem)]">
                <Link
                  href={href(locale, "gallery", artwork.slug)}
                  className="group block focus-visible:outline-offset-4"
                  title={artwork.title}
                >
                  <span className="flex aspect-square items-center justify-center overflow-hidden bg-white/10 p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL, sized by CSS */}
                    <img
                      src={artwork.imageUrl}
                      alt={artwork.title}
                      loading="lazy"
                      className="max-h-full max-w-full object-contain transition-transform duration-500 ease-[var(--ease-out-quint)] group-hover:scale-105"
                    />
                  </span>
                  <span className="mt-1.5 block truncate text-[0.75rem] text-white/60">
                    {artwork.authorName}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- outlet band */

export function OutletBand({
  locale,
  t,
  catalog,
  products,
}: Common & { products: Product[] }) {
  if (products.length === 0) return null;
  const names = new Map(catalog.collections.map((c) => [c.id, c.name]));

  return (
    <section className="bg-flame text-white">
      <div className="shell py-10 lg:py-14">
        <div className="mb-5 flex items-end justify-between gap-6">
          <div>
            <p className="eyebrow mb-2 text-white/75">{t.home.outletEyebrow}</p>
            <h2 className="section-title">{t.home.outletTitle}</h2>
          </div>
          <Link
            href={href(locale, "shop", curatedSlug("outlet", locale))}
            className="eyebrow shrink-0 border-b-2 border-white pb-1 hover:opacity-70"
          >
            {t.home.viewOutlet}
          </Link>
        </div>

        <Rail label={t.home.outletTitle}>
          {products.map((product) => (
            <div
              key={product.id}
              className="w-[68%] shrink-0 bg-white p-2 sm:w-[44%] md:w-[30%] lg:w-[23%] xl:w-[18.6%]"
            >
              <ProductCard
                product={product}
                collectionName={
                  product.collectionId ? names.get(product.collectionId) : undefined
                }
              />
            </div>
          ))}
        </Rail>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ brand note */

export function BrandNote({ t }: { t: Dictionary }) {
  return (
    <section className="border-t border-line">
      <div className="shell grid gap-8 py-12 lg:grid-cols-[1fr_1.2fr] lg:py-16">
        <div>
          <p className="eyebrow mb-3 text-flame">{t.home.projectEyebrow}</p>
          <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] leading-[0.92]">
            {t.home.projectTitle}
          </h2>
        </div>
        <div className="space-y-4 text-[0.9375rem] leading-relaxed text-mute lg:columns-2 lg:gap-8 lg:space-y-0">
          {t.home.projectBody.map((paragraph) => (
            <p key={paragraph.slice(0, 24)} className="lg:mb-4">
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
