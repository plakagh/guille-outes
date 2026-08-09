import "server-only";

import { cache } from "react";
import type { Locale } from "@/lib/i18n/config";
import { DEFAULT_SHIPPING, parseShippingSettings, type ShippingSettings } from "@/lib/shipping";
import { createClient } from "@/lib/supabase/server";

/**
 * Shop-wide settings the admin can change without a deploy.
 *
 * Both reads go through the caller's own session, so Row Level Security decides
 * what comes back: the shipping row and enabled promo messages are public (a
 * visitor sees rates at checkout before signing in), while a disabled message is
 * only visible to an administrator.
 *
 * `cache()` keeps it to one query per request even though the layout, the cart and
 * the checkout all ask.
 */

export const getShippingSettings = cache(async (): Promise<ShippingSettings> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shipping_settings")
    .select("free_threshold_cents, standard_cents, express_cents, pickup_cents, express_enabled, pickup_enabled")
    .maybeSingle();

  // A missing row must not take the shop down; it falls back to what it launched
  // with, and the server still re-prices every order from the database.
  if (error || !data) {
    if (error) console.error("[settings] shipping read failed", error);
    return DEFAULT_SHIPPING;
  }

  return parseShippingSettings(data);
});

/**
 * Where the shop is told about an order.
 *
 * Read here under the administrator's own session, which is all the settings page
 * needs. The two places that *send* the notice have no administrator present, so
 * they read it through `lib/db/notifications.ts` instead — see the note there
 * about why that one is elevated.
 */
export async function getNotificationSettings(): Promise<{ orderEmail: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notification_settings")
    .select("order_email")
    .maybeSingle();

  if (error) console.error("[settings] notification read failed", error);

  // Empty rather than null, because this is going straight into a text input.
  return { orderEmail: (data as { order_email: string | null } | null)?.order_email ?? "" };
}

export type PromoMessage = {
  id: string;
  text: string;
  href: string | null;
};

/** Editable shape for the admin, with every translation kept separate. */
export type PromoMessageDraft = {
  id: string;
  text: Record<Locale, string>;
  link: Record<Locale, string>;
  position: number;
  enabled: boolean;
};

type PromoRow = {
  id: string;
  text: Record<string, string> | null;
  link: Record<string, string> | null;
  position: number;
  enabled: boolean;
};

/** Blank translations fall back to Spanish, as everywhere else in the catalogue. */
const pick = (bundle: Record<string, string> | null, locale: Locale): string =>
  (bundle?.[locale] || bundle?.es || "").trim();

/** The messages to rotate through the promo bar, in one locale. */
export const getPromoMessages = cache(async (locale: Locale): Promise<PromoMessage[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("promo_messages")
    .select("id, text, link, position, enabled")
    .eq("enabled", true)
    .order("position")
    .order("created_at");

  if (error || !data) {
    if (error) console.error("[settings] promo read failed", error);
    return [];
  }

  return (data as PromoRow[])
    .map((row) => ({ id: row.id, text: pick(row.text, locale), href: pick(row.link, locale) || null }))
    .filter((message) => message.text.length > 0);
});

/** Every message including the switched-off ones, for the admin form. */
export async function getPromoDrafts(): Promise<PromoMessageDraft[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("promo_messages")
    .select("id, text, link, position, enabled")
    .order("position")
    .order("created_at");

  const bundle = (raw: Record<string, string> | null): Record<Locale, string> => ({
    es: raw?.es ?? "",
    gl: raw?.gl ?? "",
    en: raw?.en ?? "",
  });

  return ((data ?? []) as PromoRow[]).map((row) => ({
    id: row.id,
    text: bundle(row.text),
    link: bundle(row.link),
    position: row.position,
    enabled: row.enabled,
  }));
}
