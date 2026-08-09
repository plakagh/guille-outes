import { hasOutlet, type Catalog } from "@/lib/catalog";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { href, withQuery } from "@/lib/i18n/routes";
import { audienceSlug, curatedSlug } from "@/lib/i18n/sections";
import { findHelpDoc, findLegalDoc } from "@/lib/pages";
import { QK } from "@/lib/query";

export type NavLink = { label: string; href: string; flag?: "nuevo" | "oferta" };
export type NavColumn = { heading: string; links: NavLink[] };

export type NavFeature = {
  eyebrow: string;
  title: string;
  blurb: string;
  href: string;
  cta: string;
  collectionId: string;
};

export type NavItem = {
  label: string;
  href: string;
  /** Renders the label in the sale accent. */
  accent?: boolean;
  columns?: NavColumn[];
  feature?: NavFeature;
};

/**
 * The navigation is derived, not hand-written: categories and collections come
 * from the database (already localized), labels come from the dictionary. Add a
 * category in the admin panel and it appears in every menu, in all three
 * languages, without touching this file.
 */
export function buildNav(locale: Locale, t: Dictionary, catalog: Catalog): NavItem[] {
  const { categories, collections } = catalog;

  // With nothing discounted there is no outlet: every entry that promises one is
  // dropped rather than pointing at an empty listing.
  const outlet = hasOutlet(catalog.products);

  const shop = (...rest: string[]) => href(locale, "shop", ...rest);
  const query = (path: string, params: Record<string, string>) =>
    withQuery(path, new URLSearchParams(params));

  const productColumn = (audience?: string): NavColumn => ({
    heading: t.nav.byProduct,
    links: categories.map((category) => ({
      label: category.name,
      href: audience
        ? query(shop(category.slug), { [QK.audience]: audience })
        : shop(category.slug),
    })),
  });

  const collectionColumn: NavColumn = {
    heading: t.nav.byCollection,
    links: collections.map((collection) => ({
      label: collection.name,
      href: href(locale, "collection", collection.slug),
    })),
  };

  const audienceColumn: NavColumn = {
    heading: t.nav.byAudience,
    links: [
      { label: t.nav.men, href: shop(audienceSlug("hombre", locale)) },
      { label: t.nav.women, href: shop(audienceSlug("mujer", locale)) },
      { label: t.nav.kids, href: shop(audienceSlug("ninos", locale)) },
    ],
  };

  const featureFor = (collectionId: string, cta: string): NavFeature | undefined => {
    const collection = collections.find((c) => c.id === collectionId);
    if (!collection) return undefined;
    return {
      eyebrow: collection.tagline,
      title: collection.name,
      blurb: collection.blurb,
      href: href(locale, "collection", collection.slug),
      cta,
      collectionId,
    };
  };

  /*
    Columns and entries that only make sense when the catalogue has that axis.

    The shop launched with two categories, no collections and nothing but unisex
    products, and a menu column headed "by collection" with nothing under it is
    worse than no column. Each of these comes back on its own the day someone
    adds a collection or a women's fit in the admin panel — which is the same
    promise the comment at the top of this file makes about categories.
  */
  const collectionColumns = collections.length > 0 ? [collectionColumn] : [];
  const audiences = new Set(catalog.products.map((product) => product.audience));
  const audienceColumns = audiences.size > 1 ? [audienceColumn] : [];

  return [
    {
      label: t.nav.new,
      href: shop(curatedSlug("novedades", locale)),
      columns: [
        {
          heading: t.nav.justArrived,
          links: [
            { label: t.nav.allNew, href: shop(curatedSlug("novedades", locale)), flag: "nuevo" },
            ...collections.slice(0, 3).map((collection) => ({
              label: collection.name,
              href: href(locale, "collection", collection.slug),
            })),
          ],
        },
        ...collectionColumns,
        {
          heading: t.nav.highlighted,
          links: [
            { label: t.nav.bestSellers, href: shop(curatedSlug("mas-vendido", locale)) },
            ...(catalog.authors.length > 0
              ? [{ label: t.nav.authors, href: href(locale, "authors") }]
              : []),
            ...(outlet
              ? [
                  {
                    label: t.nav.outletUpTo,
                    href: shop(curatedSlug("outlet", locale)),
                    flag: "oferta" as const,
                  },
                ]
              : []),
          ],
        },
      ],
      feature: featureFor("origen", t.home.viewCollection),
    },
    /*
      One top-level entry per category, in the order the admin panel gives them.

      These used to be written out by hand — camisetas, sudaderas, gorras — which
      meant the menu promised sections the shop had stopped selling. Deriving them
      keeps the two in step.
    */
    ...categories.map((category) => ({
      label: category.name,
      href: shop(category.slug),
      columns: [productColumn(), ...collectionColumns, ...audienceColumns],
    })),
    /*
      The gallery is not a shop section, so it has no facets and no product
      columns — it is one destination with two doors: the wall, and the studio.
    */
    {
      label: t.gallery.navLabel,
      href: href(locale, "gallery"),
      columns: [
        {
          heading: t.gallery.title,
          links: [
            { label: t.gallery.wall, href: href(locale, "gallery") },
            { label: t.gallery.paintCta, href: href(locale, "studio"), flag: "nuevo" as const },
          ],
        },
      ],
    },
    ...(catalog.authors.length > 0
      ? [
          {
            label: t.nav.authors,
            href: href(locale, "authors"),
            columns: [
              {
                heading: t.authors.title,
                links: catalog.authors.map((author) => ({
                  label: author.name,
                  href: href(locale, "authors", author.slug),
                })),
              },
              {
                heading: t.authors.bibliographyTitle,
                links: [
                  { label: t.authors.bibliographyTitle, href: href(locale, "bibliography") },
                ],
              },
            ],
          },
        ]
      : []),
    ...(outlet
      ? [{ label: t.nav.outlet, href: shop(curatedSlug("outlet", locale)), accent: true }]
      : []),
  ];
}

/* ================================================================== footer */

/**
 * `outlet` says whether there is anything discounted right now. False drops the
 * outlet link from the shop column, for the same reason the menus drop theirs.
 */
export function buildFooterColumns(
  locale: Locale,
  t: Dictionary,
  { outlet }: { outlet: boolean },
): NavColumn[] {
  // Resolve each topic through the doc set so the footer links carry this
  // locale's slug rather than the Castellano one.
  const help = (topic: string) =>
    href(locale, "help", findHelpDoc(topic, locale)?.slug ?? topic);

  return [
    {
      heading: t.footer.columns.help,
      links: [
        { label: t.footer.links.shipping, href: help("envios") },
        { label: t.footer.links.returns, href: help("devoluciones") },
        { label: t.footer.links.sizes, href: help("tallas") },
        { label: t.footer.links.orders, href: help("pedidos") },
        { label: t.footer.links.payments, href: help("pagos") },
        { label: t.footer.links.contact, href: help("contacto") },
      ],
    },
    {
      heading: t.footer.columns.account,
      links: [
        { label: t.footer.links.signIn, href: href(locale, "login") },
        { label: t.footer.links.createAccount, href: href(locale, "register") },
        { label: t.footer.links.myOrders, href: href(locale, "account") },
        { label: t.footer.links.wishlist, href: `${href(locale, "account")}?tab=wishlist` },
        { label: t.footer.links.giftCard, href: help("tarjeta-regalo") },
        { label: t.footer.links.contact, href: help("contacto") },
      ],
    },
    {
      heading: t.footer.columns.shop,
      links: [
        { label: t.footer.links.newIn, href: href(locale, "shop", curatedSlug("novedades", locale)) },
        {
          label: t.footer.links.bestSellers,
          href: href(locale, "shop", curatedSlug("mas-vendido", locale)),
        },
        ...(outlet
          ? [
              {
                label: t.footer.links.outlet,
                href: href(locale, "shop", curatedSlug("outlet", locale)),
              },
            ]
          : []),
        { label: t.footer.links.allProducts, href: href(locale, "shop") },
      ],
    },
    {
      heading: t.footer.columns.brand,
      links: [
        { label: t.footer.links.authors, href: href(locale, "authors") },
        { label: t.gallery.navLabel, href: href(locale, "gallery") },
        { label: t.footer.links.bibliography, href: href(locale, "bibliography") },
        { label: t.footer.links.project, href: help("sobre-nosotros") },
        { label: t.footer.links.making, href: help("fabricacion") },
        { label: t.footer.links.sustainability, href: help("sostenibilidad") },
      ],
    },
  ];
}

/** The thin legal row under the footer columns. */
export function buildLegalLinks(locale: Locale, t: Dictionary): NavLink[] {
  const legal = (slug: string) =>
    href(locale, "legal", findLegalDoc(slug, locale)?.slug ?? slug);
  return [
    { label: t.footer.legal.notice, href: legal("aviso-legal") },
    { label: t.footer.legal.privacy, href: legal("privacidad") },
    { label: t.footer.legal.cookies, href: legal("cookies") },
    { label: t.footer.legal.terms, href: legal("condiciones") },
  ];
}
