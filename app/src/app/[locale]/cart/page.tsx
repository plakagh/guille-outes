import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CartView } from "@/app/[locale]/cart/cart-view";
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
  return <CartView />;
}
