import Link from "next/link";
import { WishlistLink } from "@/components/account/wishlist-link";
import { Logo } from "@/components/brand/logo";
import { CartButton } from "@/components/cart/cart-button";
import { ShieldIcon, UserIcon } from "@/components/icons";
import { MegaNav } from "@/components/layout/mega-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { PromoBar } from "@/components/layout/promo-bar";
import { getPromoMessages } from "@/lib/db/settings";
import { SearchField, type SearchIndexEntry } from "@/components/layout/search-field";
import { getCatalog } from "@/lib/db/catalog";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";
import { helpSlug } from "@/lib/pages";
import { buildNav } from "@/lib/nav";
import { getViewer } from "@/lib/supabase/server";

/**
 * Server component: it loads the catalogue and dictionary once and hands the
 * interactive pieces (menus, search, cart) the minimum they need as props.
 */
export async function SiteHeader({ locale }: { locale: Locale }) {
  const [t, catalog, viewer] = await Promise.all([
    getDictionary(locale),
    getCatalog(locale),
    getViewer(),
  ]);

  const nav = buildNav(locale, t, catalog);

  // A slim index for the typeahead — enough to render a row, nothing more.
  const searchIndex: SearchIndexEntry[] = catalog.products.map((product) => ({
    slug: product.slug,
    name: product.name,
    keywords: product.keywords,
    price: product.price,
    compareAt: product.compareAt,
    shape: product.shape,
    colorway: product.colorways[0],
  }));

  const categoryLinks = catalog.categories.map((category) => ({
    label: category.name,
    href: href(locale, "shop", category.slug),
  }));

  return (
    <header className="relative z-50">
      <PromoBar locale={locale} t={t} messages={await getPromoMessages(locale)} />

      <div className="sticky top-0 z-50 bg-white shadow-[0_1px_0_var(--color-line)]">
        <div className="shell flex h-masthead items-center gap-3 md:gap-6">
          <MobileNav locale={locale} t={t} nav={nav} viewer={viewer} />

          <Link href={href(locale)} aria-label={t.header.home} className="shrink-0">
            <Logo className="h-6 md:h-7" />
          </Link>

          <SearchField
            locale={locale}
            t={t}
            index={searchIndex}
            categories={categoryLinks}
            className="ml-auto hidden max-w-xl flex-1 md:block"
          />

          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <Link
              href={href(locale, "help", helpSlug("contacto", locale))}
              className="hidden items-center gap-2 px-3 text-[0.8125rem] font-medium transition hover:text-flame xl:flex"
            >
              <ShieldIcon className="size-5" />
              {t.header.help}
            </Link>

            <Link
              href={viewer ? href(locale, "account") : href(locale, "login")}
              className="flex items-center gap-2 px-2 text-[0.8125rem] font-medium transition hover:text-flame md:px-3"
            >
              <UserIcon className="size-[1.35rem]" />
              <span className="hidden xl:inline">
                {viewer ? t.header.account : t.header.signIn}
              </span>
            </Link>

            <WishlistLink
              href={`${href(locale, "account")}?tab=wishlist`}
              label={t.header.wishlist}
            />

            <CartButton label={t.header.openCart} />
          </div>
        </div>

        {/* Search drops to its own row on phones */}
        <div className="shell pb-3 md:hidden">
          <SearchField locale={locale} t={t} index={searchIndex} categories={categoryLinks} />
        </div>

        <MegaNav t={t} nav={nav} catalog={catalog} />
      </div>
    </header>
  );
}
