import type { Catalog } from "@/lib/catalog";
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

  /** A category by id, so a renamed slug never breaks a menu entry. */
  const bySlug = (id: string) => categories.find((c) => c.id === id)?.slug ?? id;

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
        collectionColumn,
        {
          heading: t.nav.highlighted,
          links: [
            { label: t.nav.bestSellers, href: shop(curatedSlug("mas-vendido", locale)) },
            { label: t.nav.authors, href: href(locale, "authors") },
            { label: t.nav.outletUpTo, href: shop(curatedSlug("outlet", locale)), flag: "oferta" },
          ],
        },
      ],
      feature: featureFor("origen", t.home.viewCollection),
    },
    {
      label: t.nav.men,
      href: shop(audienceSlug("hombre", locale)),
      columns: [
        productColumn("hombre"),
        collectionColumn,
        {
          heading: t.nav.highlighted,
          links: [
            {
              label: t.nav.new,
              href: query(shop(audienceSlug("hombre", locale)), { [QK.sort]: "novedades" }),
              flag: "nuevo",
            },
            { label: t.nav.bestSellers, href: shop(curatedSlug("mas-vendido", locale)) },
            {
              label: t.nav.outlet,
              href: query(shop(audienceSlug("hombre", locale)), { [QK.onSale]: "1" }),
              flag: "oferta",
            },
          ],
        },
      ],
      feature: featureFor("court-series", t.home.viewCollection),
    },
    {
      label: t.nav.women,
      href: shop(audienceSlug("mujer", locale)),
      columns: [
        productColumn("mujer"),
        collectionColumn,
        {
          heading: t.nav.highlighted,
          links: [
            {
              label: t.nav.new,
              href: query(shop(audienceSlug("mujer", locale)), { [QK.sort]: "novedades" }),
              flag: "nuevo",
            },
            { label: t.nav.bestSellers, href: shop(curatedSlug("mas-vendido", locale)) },
            {
              label: t.nav.outlet,
              href: query(shop(audienceSlug("mujer", locale)), { [QK.onSale]: "1" }),
              flag: "oferta",
            },
          ],
        },
      ],
      feature: featureFor("away-days", t.home.viewCollection),
    },
    {
      label: t.nav.kids,
      href: shop(audienceSlug("ninos", locale)),
      columns: [
        productColumn("ninos"),
        {
          heading: t.plp.size,
          links: ["4", "8", "12"].map((size) => ({
            label: size,
            href: query(shop(audienceSlug("ninos", locale)), { [QK.size]: size }),
          })),
        },
        {
          heading: t.nav.highlighted,
          links: [
            { label: t.nav.everyone, href: shop(audienceSlug("ninos", locale)) },
            {
              label: t.nav.outlet,
              href: query(shop(audienceSlug("ninos", locale)), { [QK.onSale]: "1" }),
              flag: "oferta",
            },
          ],
        },
      ],
    },
    {
      label: t.nav.tees,
      href: shop(bySlug("camisetas")),
      columns: [collectionColumn, audienceColumn],
    },
    {
      label: t.nav.sweats,
      href: shop(bySlug("sudaderas")),
      columns: [collectionColumn, audienceColumn],
    },
    {
      label: t.nav.headwear,
      href: shop(bySlug("gorras")),
      columns: [productColumn(), collectionColumn],
    },
    {
      label: t.nav.collections,
      href: href(locale, "shop"),
      columns: [collectionColumn, productColumn()],
      feature: featureFor("hardwood-94", t.home.viewCollection),
    },
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
    { label: t.nav.outlet, href: shop(curatedSlug("outlet", locale)), accent: true },
  ];
}

/* ================================================================== footer */

export function buildFooterColumns(
  locale: Locale,
  t: Dictionary,
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
        { label: t.footer.links.outlet, href: href(locale, "shop", curatedSlug("outlet", locale)) },
        { label: t.footer.links.allProducts, href: href(locale, "shop") },
      ],
    },
    {
      heading: t.footer.columns.brand,
      links: [
        { label: t.footer.links.authors, href: href(locale, "authors") },
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
