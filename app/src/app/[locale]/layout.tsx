import type { Metadata, Viewport } from "next";
import { Antonio, Inter } from "next/font/google";
import { notFound } from "next/navigation";
import { WishlistProvider } from "@/components/account/wishlist-provider";
import { CartProvider } from "@/components/cart/cart-context";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { I18nProvider } from "@/components/i18n/provider";
import { ComingSoonGate } from "@/components/layout/coming-soon-gate";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getWishlistIds } from "@/lib/db/account";
import { getShippingSettings } from "@/lib/db/settings";
import { isLocale, LOCALE_META, LOCALES } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";
import { legalSlug } from "@/lib/pages";
import { SITE_URL } from "@/lib/supabase/env";
import { getViewer } from "@/lib/supabase/server";
import "../globals.css";

/** Ultra-condensed display face — wordmark, headings, nav and buttons. */
const antonio = Antonio({
  variable: "--font-antonio",
  subsets: ["latin"],
  display: "swap",
});

/** UI face — body copy, prices, forms, product names. */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata(props: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await props.params;
  if (!isLocale(locale)) return {};
  const t = await getDictionary(locale);

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${t.meta.siteName} — ${t.meta.tagline}`,
      template: `%s | ${t.meta.siteName}`,
    },
    description: t.meta.description,
    keywords: t.meta.keywords,
    alternates: {
      canonical: href(locale),
      languages: Object.fromEntries(
        LOCALES.map((other) => [LOCALE_META[other].hrefLang, href(other)]),
      ),
    },
    openGraph: {
      type: "website",
      locale: LOCALE_META[locale].ogLocale,
      siteName: t.meta.siteName,
      title: `${t.meta.siteName} — ${t.meta.tagline}`,
      description: t.meta.description,
      url: href(locale),
    },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  // The browser chrome should agree with ours, and ours is pure black now.
  themeColor: "#000000",
};

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [t, viewer, wishlistIds, shipping] = await Promise.all([
    getDictionary(locale),
    getViewer(),
    getWishlistIds(),
    // The rates the browser quotes from must be the row the server charges from.
    getShippingSettings(),
  ]);

  return (
    <html
      lang={LOCALE_META[locale].htmlLang}
      className={`${antonio.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-white">
        <I18nProvider locale={locale} dictionary={t}>
          <WishlistProvider
            locale={locale}
            signedIn={viewer !== null}
            initialIds={wishlistIds}
          >
            <CartProvider shippingSettings={shipping}>
              <a
                href="#contenido"
                className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
              >
                {t.common.skipToContent}
              </a>
              <SiteHeader locale={locale} />
              <main id="contenido" className="flex-1">
                {children}
              </main>
              <SiteFooter locale={locale} />
              <CartDrawer />
              {/*
                Last in the tree on purpose: it opens over whatever page this is,
                and the slug is resolved here because `lib/pages` is the whole
                legal corpus — a thousand lines of article text nobody needs in
                the browser to link one privacy notice.
              */}
              <ComingSoonGate
                privacyHref={href(locale, "legal", legalSlug("privacidad", locale))}
              />
            </CartProvider>
          </WishlistProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
