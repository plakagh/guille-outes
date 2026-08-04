import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CartView } from "@/app/[locale]/cart/cart-view";
import { hasOutlet } from "@/lib/catalog";
import { getCatalog } from "@/lib/db/catalog";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";

export async function generateMetadata(props: PageProps<"/[locale]/cart">): Promise<Metadata> {
  const { locale } = await props.params;
  if (!isLocale(locale)) return {};
  const t = await getDictionary(locale);
  return { title: t.cart.title, robots: { index: false, follow: false } };
}

export default async function CartPage(props: PageProps<"/[locale]/cart">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();

  // Only to know whether the empty cart has an outlet to point at; the request
  // has already fetched the catalogue for the header.
  const catalog = await getCatalog(locale);

  return <CartView outlet={hasOutlet(catalog.products)} />;
}
