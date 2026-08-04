import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CheckoutView } from "@/app/[locale]/cart/checkout/checkout-view";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";
import { getViewer } from "@/lib/supabase/server";

export async function generateMetadata(
  props: PageProps<"/[locale]/cart/checkout">,
): Promise<Metadata> {
  const { locale } = await props.params;
  if (!isLocale(locale)) return {};
  const t = await getDictionary(locale);
  return { title: t.checkout.title, robots: { index: false, follow: false } };
}

export default async function CheckoutPage(props: PageProps<"/[locale]/cart/checkout">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();

  // An order belongs to an account: `orders` has an own-rows-only insert policy,
  // so there is no anonymous path to create one. Guests sign in first and come
  // straight back to checkout.
  const viewer = await getViewer();
  if (!viewer) {
    redirect(`${href(locale, "login")}?next=${encodeURIComponent(href(locale, "checkout"))}`);
  }

  return <CheckoutView />;
}
