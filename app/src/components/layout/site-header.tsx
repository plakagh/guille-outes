import Link from "next/link";
import { WishlistLink } from "@/components/account/wishlist-link";
import { Logo } from "@/components/brand/logo";
import { CartButton } from "@/components/cart/cart-button";
import { ShieldIcon, UserIcon } from "@/components/icons";
import { MegaNav } from "@/components/layout/mega-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { PromoBar } from "@/components/layout/promo-bar";
import { StickyChrome } from "@/components/layout/sticky-chrome";
import { getPromoMessages } from "@/lib/db/settings";
import { SearchField, type SearchIndexEntry } from "@/components/layout/search-field";
import { photosFor } from "@/components/product/product-shot";
import { mediaUrl } from "@/lib/supabase/env";
import { hasOutlet } from "@/lib/catalog";
import { getCatalog } from "@/lib/db/catalog";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";
import { curatedSlug } from "@/lib/i18n/sections";
import { helpSlug } from "@/lib/pages";
import { buildNav } from "@/lib/nav";
import { getViewer } from "@/lib/supabase/server";

/**
 * Does a promo message point at a given listing?
 *
 * Only the path is compared: a message may carry a query string or an anchor. A
 * link written as a full `https://` address to our own domain will not match,
 * which is the same shape the admin hint steers people away from.
 */
function pointsAt(link: string | null, path: string): boolean {
  if (!link) return false;
  return link.split(/[?#]/)[0].replace(/\/$/, "") === path.replace(/\/$/, "");
}

/**
 * Server component: it loads the catalogue and dictionary once and hands the
 * interactive pieces (menus, search, cart) the minimum they need as props.
 */
export async function SiteHeader({ locale }: { locale: Locale }) {
  const [t, catalog, viewer, promos] = await Promise.all([
    getDictionary(locale),
    getCatalog(locale),
    getViewer(),
    getPromoMessages(locale),
  ]);

  const nav = buildNav(locale, t, catalog);

  // An announcement linking to the outlet is an outlet zone like any other: with
  // nothing discounted it comes off the bar on its own, rather than needing
  // someone to switch it off in the admin and remember to switch it back on.
  const outlet = hasOutlet(catalog.products);
  const outletPath = href(locale, "shop", curatedSlug("outlet", locale));
  const messages = outlet
    ? promos
    : promos.filter((message) => !pointsAt(message.href, outletPath));

  // A slim index for the typeahead — enough to render a row, nothing more.
  const searchIndex: SearchIndexEntry[] = catalog.products.map((product) => ({
    slug: product.slug,
    name: product.name,
    keywords: product.keywords,
    price: product.price,
    compareAt: product.compareAt,
    shape: product.shape,
    colorway: product.colorways[0],
    imageUrl: (() => {
      const photo = photosFor(product, product.colorways[0]?.id)[0];
      return photo ? mediaUrl(photo.path) : undefined;
    })(),
  }));

  const categoryLinks = catalog.categories.map((category) => ({
    label: category.name,
    href: href(locale, "shop", category.slug),
  }));

  return (
    /*
      The whole chrome is what sticks, not a row inside it.

      `position: sticky` only travels within its own parent's box, so a sticky
      row *inside* this header had nowhere to go: the header is exactly as tall
      as its contents, and the row reached the bottom of it the moment it left
      the top of the page. Pinning the header itself gives it the length of the
      document to stick against.

      `StickyChrome` is that header, and it is a client component only because
      the black bands fold away on the way down the page and come back on the
      way up. Everything inside it is still rendered here, on the server.
    */
    <StickyChrome>
      <PromoBar locale={locale} t={t} messages={messages} />

      {/*
        The navigation is dark and the content is white, with nothing in between.

        That division is what `design.md` leads with (§6.2) and it is doing more
        than decoration: the masthead, the nav row and the panel that drops out of
        it are *navigation*, and painting them dark states where the shop's
        furniture ends and the merchandise begins. A white masthead over white
        content has to draw a hairline to say the same thing, and then every band
        below it is competing with the product photography for which white is the
        page.

        Above it the announce bar is white, so the chrome reads as three bands
        stepping down — white, black, then the institutional blue under the
        navigation. All three were dark for a while, and the blue read as too much
        colour for the top of a page when nothing lighter preceded it. The bar
        carries the lightest-weight content of the three, which is why it is the
        one that can go light without blurring where the furniture ends.

        `data-chrome="dark"` is what turns the focus ring white in here — the
        institutional blue it uses on white is invisible against this.
      */}
      <div data-chrome="dark" className="relative z-50 bg-black text-white">
        {/*
          The masthead rides back down by exactly what folded above it.

          On a phone the chrome slides up by the announce bar *plus* the search
          row, and the search row is below this — so without this counter-slide
          the masthead would be dragged half off the top of the screen. Pushed
          back down by the search row's own height it lands at y=0 with the row
          it left behind tucked underneath it, which is why the black fill and
          the `z-10` here are load-bearing: they are what the search row hides
          behind. Above `md` there is no separate row, so nothing to compensate.
        */}
        <div className="relative z-10 shell flex h-masthead items-center gap-3 bg-black transition-transform duration-300 ease-[var(--ease-out-quint)] group-data-[condensed]:translate-y-[var(--spacing-search)] motion-reduce:transition-none md:gap-6 md:group-data-[condensed]:translate-y-0">
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
            {/*
              Hovering to white rather than to red. Red on this site is the
              action or the discount, and "help" is neither — it was reaching for
              the CTA colour just to acknowledge the pointer.
            */}
            <Link
              href={href(locale, "help", helpSlug("contacto", locale))}
              className="hidden items-center gap-2 px-3 text-[0.8125rem] font-medium text-white/80 transition hover:text-white xl:flex"
            >
              <ShieldIcon className="size-5" />
              {t.header.help}
            </Link>

            <Link
              href={viewer ? href(locale, "account") : href(locale, "login")}
              className="flex items-center gap-2 px-2 text-[0.8125rem] font-medium text-white/80 transition hover:text-white md:px-3"
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

        {/*
          Search drops to its own row on phones — and folds away as you read.

          `h-search` is the token the fold is measured in, not a look: the
          chrome slides up by exactly this much on the way down the page, so a
          row that grew a pixel taller than the token would leave that pixel of
          black under the masthead. The field keeps its own height inside it and
          the rest is the gap to the row below.
        */}
        <div className="shell flex h-search items-start md:hidden">
          <SearchField
            locale={locale}
            t={t}
            index={searchIndex}
            categories={categoryLinks}
            className="w-full"
          />
        </div>

        <MegaNav t={t} nav={nav} catalog={catalog} />
      </div>
    </StickyChrome>
  );
}
