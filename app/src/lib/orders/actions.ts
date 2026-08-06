"use server";

import { redirect } from "next/navigation";
import { getCatalog } from "@/lib/db/catalog";
import { lookupDiscount } from "@/lib/db/discounts";
import { getShippingSettings } from "@/lib/db/settings";
import { evaluateDiscount, totalWithDiscount, type AppliedDiscount } from "@/lib/discounts";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { href } from "@/lib/i18n/routes";
import { discountLines, parseLines, type CheckoutLineInput } from "@/lib/orders/lines";
import { createClient, getUser } from "@/lib/supabase/server";
import { stockFor } from "@/lib/catalog";
import { isShippingMethod, shippingCost } from "@/lib/shipping";
import { VAT_RATE } from "@/lib/tax";

/**
 * Order creation.
 *
 * The browser sends *what the shopper chose*, never what it costs. Every price,
 * every stock level and the shipping charge are recomputed here from the
 * database, so a tampered localStorage cart or a crafted POST cannot change what
 * gets charged — which matters doubly because the amount is what we sign and
 * hand to the bank.
 */

export type { CheckoutLineInput };

export type CheckoutState = {
  error?:
    | "empty"
    | "out_of_stock"
    | "invalid"
    | "not_signed_in"
    | "artwork_unavailable"
    | "discount_refused"
    | "unknown";
  /** Which line failed, so the UI can point at it. */
  detail?: string;
};

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function placeOrder(
  _previous: CheckoutState,
  form: FormData,
): Promise<CheckoutState> {
  const rawLocale = text(form, "locale");
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "es";

  const user = await getUser();
  // Guest checkout would need its own RLS path; for now an account is required.
  if (!user) return { error: "not_signed_in" };

  const lines = parseLines(text(form, "lines"));
  if (lines.length === 0) return { error: "empty" };

  const email = text(form, "email");
  const shipName = `${text(form, "firstName")} ${text(form, "lastName")}`.trim();
  const line1 = text(form, "address");
  const postcode = text(form, "postcode");
  const city = text(form, "city");
  const province = text(form, "province");

  if (!email || !shipName || !line1 || !postcode || !city || !province) {
    return { error: "invalid" };
  }

  const shippingMethod = text(form, "shipping") || "standard";
  if (!isShippingMethod(shippingMethod)) return { error: "invalid" };

  // Rates come from the database, not from the request and not from a constant:
  // this is the same row the checkout quoted from, so the total shown is the total
  // charged. A method the shop has switched off is refused even if the form still
  // offers it — a stale tab must not be able to buy a withdrawn service.
  const shippingSettings = await getShippingSettings();
  if (!shippingSettings.enabled[shippingMethod]) return { error: "invalid" };

  const supabase = await createClient();

  // Re-price from the catalogue. This is the authoritative amount.
  const catalog = await getCatalog(locale);

  /**
   * The drawings, resolved once from the database.
   *
   * The browser sends ids and nothing else, so the title that ends up on the
   * order and the file the shop prints from are both read here — the cart's
   * snapshot is for display and has no say in what gets made. A drawing that is
   * not published (retired by the shop, or hidden by the family since the tab
   * was opened) resolves to nothing and takes the order down with it rather than
   * quietly printing a plain shirt somebody did not order.
   */
  const artworkIds = [...new Set(lines.map((line) => line.artworkId).filter(Boolean))] as string[];

  const artworks = new Map<string, { id: string; title: string; storage_path: string }>();
  if (artworkIds.length > 0) {
    const { data } = await supabase
      .from("artworks")
      .select("id, title, storage_path, status")
      .in("id", artworkIds)
      .eq("status", "published");

    for (const row of (data ?? []) as {
      id: string;
      title: string;
      storage_path: string;
    }[]) {
      artworks.set(row.id, row);
    }
  }

  let subtotal = 0;
  const items: {
    product_id: string;
    variant_id: string | null;
    name: string;
    ref: string;
    size: string;
    colorway_id: string;
    unit_price_cents: number;
    qty: number;
    artwork_id: string | null;
    artwork_title: string | null;
    artwork_path: string | null;
  }[] = [];

  for (const line of lines) {
    const product = catalog.products.find((candidate) => candidate.slug === line.slug);
    if (!product) return { error: "invalid", detail: line.slug };

    const available = stockFor(product, line.size, line.colorwayId);
    if (available < line.qty) {
      return { error: "out_of_stock", detail: `${product.name} · ${line.size}` };
    }

    const variant = product.variants.find(
      (candidate) => candidate.size === line.size && candidate.colorwayId === line.colorwayId,
    );

    // A drawing may only be printed on a product the shop has said can carry
    // one. Checked here as well as in the picker, because "which products accept
    // a drawing" is a rule about what the workshop can make, and a stale tab
    // must not be able to order a printed cap the shop does not print.
    let artwork: { id: string; title: string; storage_path: string } | null = null;
    if (line.artworkId) {
      if (!product.artworkPrintable) return { error: "invalid", detail: line.slug };
      artwork = artworks.get(line.artworkId) ?? null;
      if (!artwork) return { error: "artwork_unavailable", detail: product.name };
    }

    subtotal += product.price * line.qty;
    items.push({
      product_id: product.id,
      variant_id: variant?.id ?? null,
      name: product.name,
      ref: product.ref,
      size: line.size,
      colorway_id: line.colorwayId,
      unit_price_cents: product.price,
      qty: line.qty,
      // The reference is soft, so the title and the path travel with the line:
      // a shirt that has been paid for stays printable after the family takes
      // the drawing down.
      artwork_id: artwork?.id ?? null,
      artwork_title: artwork?.title ?? null,
      artwork_path: artwork?.storage_path ?? null,
    });
  }

  const quotedShipping = shippingCost(subtotal, shippingMethod, shippingSettings);

  /**
   * The discount code, re-checked from scratch.
   *
   * The cart already asked, and the answer is deliberately not carried over: a
   * tab left open through the end of a campaign, a code that hit its last
   * redemption while the shopper filled in an address, a basket edited in
   * another tab — all of them make a cart-time quote wrong by the time it
   * matters. So the only thing that travels is the string.
   *
   * A code that no longer works stops the order rather than quietly charging
   * full price. Being taken to the bank for more than the page said is the one
   * outcome worse than being told to try again.
   */
  let discount: AppliedDiscount | null = null;
  const code = text(form, "code");

  if (code) {
    const rules = await lookupDiscount(code);
    const verdict = rules
      ? evaluateDiscount({
          rules,
          lines: discountLines(catalog, lines),
          shippingCents: quotedShipping,
          signedIn: true,
          now: new Date(),
        })
      : ({ ok: false, reason: "unknown" } as const);

    if (!verdict.ok) return { error: "discount_refused", detail: verdict.reason };
    discount = verdict.discount;
  }

  const priced = totalWithDiscount({
    subtotalCents: subtotal,
    shippingCents: quotedShipping,
    discount,
  });

  // `order_ref` is generated by a database default (a zero-padded sequence), so
  // it is unique per merchant without a round trip to check.
  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      email,
      phone: text(form, "tel") || null,
      locale,
      amount_cents: priced.totalCents,
      shipping_cents: priced.shippingCents,
      // Snapshotted, like the address and the line prices: what this order was
      // given, at the moment it was placed. The code itself may later be edited,
      // switched off or deleted.
      discount_code: discount?.code ?? null,
      discount_cents: priced.discountCents,
      // Recorded per order, so a future rate change never rewrites this invoice.
      vat_rate: VAT_RATE,
      ship_name: shipName,
      ship_line1: line1,
      ship_line2: text(form, "addressExtra") || null,
      ship_postcode: postcode,
      ship_city: city,
      ship_province: province,
      shipping_method: shippingMethod,
    })
    .select("id, order_ref")
    .single();

  if (error || !order) {
    console.error("placeOrder: could not insert order", error);
    return { error: "unknown", detail: error?.message };
  }

  const created = order as { id: string; order_ref: string };

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(items.map((item) => ({ ...item, order_id: created.id })));

  if (itemsError) {
    console.error("placeOrder: could not insert order items", itemsError);
    return { error: "unknown", detail: itemsError.message };
  }

  redirect(href(locale, "order", created.order_ref));
}
