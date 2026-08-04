import Link from "next/link";
import { ProductArt } from "@/components/brand/product-art";
import { ArrowRight } from "@/components/icons";
import { ProductCard } from "@/components/product/product-card";
import { SectionHead } from "@/components/ui/bits";
import { ButtonLink } from "@/components/ui/button";
import { Rail } from "@/components/ui/rail";
import { mediaUrl } from "@/lib/supabase/env";
import type { Catalog, Product } from "@/lib/catalog";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";
import { helpSlug } from "@/lib/pages";
import { curatedSlug } from "@/lib/i18n/sections";

type Common = { locale: Locale; t: Dictionary; catalog: Catalog };

/* ------------------------------------------------------- category tiles */

export function CategoryTiles({ locale, t, catalog }: Common) {
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
                      <ProductArt shape={hero.shape} colorway={hero.colorways[0]} print="none" />
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

/* ---------------------------------------------------------- collections */

export function CollectionCards({ locale, t, catalog }: Common) {
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
                  <p className="mt-3 max-w-sm text-[0.875rem] leading-relaxed text-mute">
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
                    <ProductArt shape={hero.shape} colorway={hero.colorways[0]} print={hero.print} />
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

export function EditorialSplit({ locale, t }: Omit<Common, "catalog">) {
  const panels = [
    {
      eyebrow: t.home.personaliseEyebrow,
      title: t.home.personaliseTitle,
      blurb: t.home.personaliseBlurb,
      cta: t.home.personaliseCta,
      href: href(locale, "help", helpSlug("personalizacion", locale)),
      background: "#141414",
      ink: "light" as const,
    },
    {
      eyebrow: t.home.giftEyebrow,
      title: t.home.giftTitle,
      blurb: t.home.giftBlurb,
      cta: t.home.giftCta,
      href: href(locale, "help", helpSlug("tarjeta-regalo", locale)),
      background: "#e5dfd2",
      ink: "dark" as const,
    },
  ];

  return (
    <section className="shell grid gap-4 py-10 md:grid-cols-2 lg:py-14">
      {panels.map((panel) => (
        <article
          key={panel.title}
          className="relative overflow-hidden p-8 lg:p-12"
          style={{ backgroundColor: panel.background }}
        >
          <div className={panel.ink === "light" ? "text-white" : "text-ink"}>
            <p className="eyebrow mb-3 text-flame">{panel.eyebrow}</p>
            <h3 className="max-w-xs text-[clamp(1.75rem,4vw,2.75rem)] leading-none">
              {panel.title}
            </h3>
            <p
              className={`mt-4 max-w-sm text-[0.9375rem] leading-relaxed ${
                panel.ink === "light" ? "text-white/70" : "text-ink/65"
              }`}
            >
              {panel.blurb}
            </p>
            <ButtonLink
              href={panel.href}
              variant={panel.ink === "light" ? "inverse" : "solid"}
              className="mt-6"
            >
              {panel.cta}
            </ButtonLink>
          </div>
        </article>
      ))}
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
