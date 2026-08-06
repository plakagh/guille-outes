import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AddressBook, ProfileForm } from "@/app/[locale]/account/account-forms";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ProductGrid } from "@/components/product/product-rail";
import { Badge, Breadcrumbs } from "@/components/ui/bits";
import { ButtonLink } from "@/components/ui/button";
import { PrivacyPanel } from "@/app/[locale]/account/privacy-panel";
import { ArtworkGrid } from "@/components/gallery/artwork-card";
import { getAddresses, getConsentHistory, getWishlistIds } from "@/lib/db/account";
import { listMyArtworks } from "@/lib/db/gallery";
import { getMyOrders, type Order } from "@/lib/db/orders";
import { getCatalog } from "@/lib/db/catalog";
import { formatPrice } from "@/lib/utils";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";
import { getViewer } from "@/lib/supabase/server";

export async function generateMetadata(props: PageProps<"/[locale]/account">): Promise<Metadata> {
  const { locale } = await props.params;
  if (!isLocale(locale)) return {};
  const t = await getDictionary(locale);
  return { title: t.auth.accountTitle, robots: { index: false, follow: false } };
}

const TABS = ["overview", "wishlist", "drawings", "orders", "addresses"] as const;
type Tab = (typeof TABS)[number];

const ORDER_TONE = {
  pending: "neutral",
  paid: "new",
  failed: "sale",
  cancelled: "soldout",
  refunded: "limited",
} as const;

const ORDER_LABEL: Record<Order["status"], (t: Dictionary) => string> = {
  pending: (t) => t.order.statusPending,
  paid: (t) => t.order.statusPaid,
  failed: (t) => t.order.statusFailed,
  cancelled: (t) => t.order.statusCancelled,
  refunded: (t) => t.order.statusRefunded,
};

export default async function AccountPage(props: PageProps<"/[locale]/account">) {
  const [{ locale }, searchParams] = await Promise.all([props.params, props.searchParams]);
  if (!isLocale(locale)) notFound();

  const [t, viewer] = await Promise.all([getDictionary(locale), getViewer()]);

  // Guarded server-side with getUser(), not with a cookie sniff in the proxy.
  if (!viewer) {
    redirect(`${href(locale, "login")}?next=${encodeURIComponent(href(locale, "account"))}`);
  }

  const justConfirmed = searchParams.confirmed === "1";

  const rawTab = searchParams.tab;
  const requested = typeof rawTab === "string" ? rawTab : "";
  const tab: Tab = (TABS as readonly string[]).includes(requested)
    ? (requested as Tab)
    : "overview";

  const [catalog, wishlistIds, addresses, orders, consents, drawings] = await Promise.all([
    getCatalog(locale),
    getWishlistIds(),
    getAddresses(),
    getMyOrders(),
    getConsentHistory(),
    listMyArtworks(),
  ]);

  // Current state is the newest record for each kind.
  const marketing =
    consents.find((row) => row.kind === "marketing")?.granted === true;

  // Preserve the order the customer saved them in.
  const saved = wishlistIds
    .map((id) => catalog.products.find((product) => product.id === id))
    .filter((product): product is NonNullable<typeof product> => product !== undefined);

  const base = href(locale, "account");
  const labels: Record<Tab, string> = {
    overview: t.account.profile,
    wishlist: t.account.wishlist,
    drawings: t.gallery.myDrawings,
    orders: t.account.orders,
    addresses: t.account.addresses,
  };

  return (
    <div className="shell py-6 lg:py-10">
      <Breadcrumbs
        label={t.plp.breadcrumbHome}
        trail={[
          { label: t.plp.breadcrumbHome, href: href(locale) },
          { label: t.auth.accountTitle },
        ]}
        className="mb-5"
      />

      {justConfirmed && (
        <p className="mb-6 flex max-w-md items-center gap-2 border-l-2 border-pine bg-shell p-4 text-[0.875rem] font-semibold text-pine">
          {t.auth.confirmed}
        </p>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[clamp(2rem,5vw,3.25rem)] leading-[0.9]">{t.auth.accountTitle}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.875rem] text-mute">
            {t.auth.signedInAs} <span className="font-semibold text-ink">{viewer.email}</span>
            {viewer.isAdmin && <Badge tone="new">{t.auth.roleAdmin}</Badge>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {viewer.isAdmin && (
            <ButtonLink href={href(locale, "admin")} size="sm">
              {t.auth.goToAdmin}
            </ButtonLink>
          )}
          <SignOutButton locale={locale} label={t.auth.signOut} />
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-14">
        {/*
          `min-w-0` is load-bearing: a grid item defaults to `min-width: auto`, so
          without it the tab strip refuses to shrink below its content, its
          `overflow-x-auto` never engages, and the whole page scrolls sideways on a
          phone instead of just the tabs.
        */}
        <nav aria-label={t.auth.accountTitle} className="min-w-0">
          <ul className="flex gap-1 overflow-x-auto border-b border-line lg:flex-col lg:gap-0 lg:border-b-0 lg:border-l lg:border-line">
            {TABS.map((item) => (
              <li key={item}>
                <Link
                  href={item === "overview" ? base : `${base}?tab=${item}`}
                  aria-current={item === tab ? "page" : undefined}
                  className={
                    item === tab
                      ? "block whitespace-nowrap border-b-2 border-ink px-3 py-2.5 text-[0.875rem] font-semibold lg:-ml-px lg:border-b-0 lg:border-l-2"
                      : "block whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-[0.875rem] text-mute hover:text-ink lg:-ml-px lg:border-b-0 lg:border-l-2"
                  }
                >
                  {labels[item]}
                  {item === "wishlist" && saved.length > 0 && (
                    <span className="ml-1.5 text-mute">({saved.length})</span>
                  )}
                  {item === "drawings" && drawings.length > 0 && (
                    <span className="ml-1.5 text-mute">({drawings.length})</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0">
          {tab === "overview" && (
            <section>
              <h2 className="mb-5 text-2xl">{t.account.profile}</h2>
              <ProfileForm fullName={viewer.fullName} email={viewer.email ?? ""} />
              <PrivacyPanel marketing={marketing} history={consents} />
            </section>
          )}

          {tab === "wishlist" && (
            <section>
              <h2 className="mb-5 text-2xl">
                {t.account.wishlist}
                {saved.length > 0 && (
                  <span className="ml-2 font-sans text-[0.875rem] font-normal normal-case tracking-normal text-mute">
                    {saved.length}{" "}
                    {saved.length === 1 ? t.account.wishlistCountOne : t.account.wishlistCount}
                  </span>
                )}
              </h2>

              {saved.length === 0 ? (
                <div className="flex flex-col items-start gap-4 border border-line p-8">
                  <p className="font-display text-xl font-bold uppercase">
                    {t.account.emptyWishlist}
                  </p>
                  <p className="max-w-md text-[0.9375rem] text-mute">
                    {t.account.emptyWishlistBlurb}
                  </p>
                  <ButtonLink href={href(locale, "shop")}>{t.account.startShopping}</ButtonLink>
                </div>
              ) : (
                <ProductGrid products={saved} catalog={catalog} />
              )}
            </section>
          )}

          {/*
            Every drawing this account published, including the ones it has taken
            off the wall — hidden rows come back through the "read own" policy, so
            withdrawing one never means losing sight of it.
          */}
          {tab === "drawings" && (
            <section>
              <h2 className="mb-5 text-2xl">{t.gallery.myDrawings}</h2>

              {drawings.length === 0 ? (
                <div className="flex flex-col items-start gap-4 border border-line p-8">
                  <p className="font-display text-xl font-bold uppercase">
                    {t.gallery.emptyTitle}
                  </p>
                  <p className="max-w-md text-[0.9375rem] text-mute">{t.gallery.emptyBlurb}</p>
                  <ButtonLink href={href(locale, "studio")}>{t.gallery.paintCta}</ButtonLink>
                </div>
              ) : (
                <>
                  <p className="mb-5 max-w-xl text-[0.9375rem] leading-relaxed text-mute">
                    {t.gallery.myDrawingsBlurb}
                  </p>
                  <ArtworkGrid artworks={drawings} locale={locale} t={t} />
                </>
              )}
            </section>
          )}

          {tab === "orders" && (
            <section>
              <h2 className="mb-5 text-2xl">{t.account.orders}</h2>

              {orders.length === 0 ? (
                <div className="flex flex-col items-start gap-4 border border-line p-8">
                  <p className="font-display text-xl font-bold uppercase">{t.account.noOrders}</p>
                  <p className="max-w-md text-[0.9375rem] text-mute">{t.account.noOrdersBlurb}</p>
                  <ButtonLink href={href(locale, "shop")} variant="outline">
                    {t.account.startShopping}
                  </ButtonLink>
                </div>
              ) : (
                <ul className="divide-y divide-line border-y border-line">
                  {orders.map((order) => (
                    <li key={order.id} className="flex flex-wrap items-center gap-4 py-4">
                      <span className="min-w-0 flex-1">
                        <Link
                          href={`${href(locale, "order", order.orderRef)}?ver=1`}
                          className="block font-mono text-[0.9375rem] font-semibold hover:underline"
                        >
                          {order.orderRef}
                        </Link>
                        <span className="mt-0.5 block text-[0.8125rem] text-mute">
                          {new Date(order.createdAt).toLocaleDateString(locale)} ·{" "}
                          {order.items.length} {order.items.length === 1 ? t.plp.item : t.plp.items}
                          {/* Which code was used, from the order's own snapshot —
                              so it still says the right thing after the campaign
                              has been paused or deleted. */}
                          {order.discountCode && (
                            <>
                              {" · "}
                              <span className="font-mono">{order.discountCode}</span>{" "}
                              <span className="text-pine">
                                −{formatPrice(order.discountCents)}
                              </span>
                            </>
                          )}
                        </span>
                      </span>
                      <Badge tone={ORDER_TONE[order.status]}>
                        {ORDER_LABEL[order.status](t)}
                      </Badge>
                      <span className="font-semibold">{formatPrice(order.amountCents)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {tab === "addresses" && (
            <section>
              <h2 className="mb-5 text-2xl">{t.account.addresses}</h2>
              {addresses.length === 0 && (
                <p className="mb-4 text-[0.9375rem] text-mute">{t.account.noAddresses}</p>
              )}
              <AddressBook addresses={addresses} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
