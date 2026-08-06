import { NextResponse, type NextRequest } from "next/server";
import { getDictionary } from "@/lib/i18n/dictionary";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { href } from "@/lib/i18n/routes";
import { canSendMail, sendMail } from "@/lib/email/mailer";
import {
  orderPaidEmail,
  paymentFailedEmail,
  paymentRetryEmail,
  type OrderSummary,
} from "@/lib/email/templates";
import { classifyResponse, verifyRedsysNotification } from "@/lib/payments/redsys";
import { getRedsysCredentials } from "@/lib/payments/settings";
import { createElevatedClient } from "@/lib/supabase/elevated";
import { SITE_URL } from "@/lib/supabase/env";

/**
 * Redsys server-to-server notification (`DS_MERCHANT_MERCHANTURL`).
 *
 * This is the only thing that may mark an order paid — the shopper's browser
 * returning to the success URL proves nothing, because anyone can visit a URL.
 *
 * Rules this endpoint follows:
 *
 *  - **Verify first.** The HMAC is checked before any state is touched. An
 *    unsigned or badly-signed call is recorded and then ignored.
 *  - **Resolve by attempt.** Notifications carry the *attempt's* gateway
 *    reference, not the order reference, because a retry needs a fresh one.
 *  - **Check the amount.** A valid signature over a different amount than the
 *    attempt says is treated as a mismatch, not a payment.
 *  - **Be idempotent.** Redsys retries. Only a `pending` attempt settles, so a
 *    replayed notification cannot decrement stock twice or send a second email.
 *  - **Always answer 200.** Redsys retries on any non-200, so returning an error
 *    for a request we have deliberately rejected would invite a retry storm. What
 *    happened is recorded in `payment_events` instead.
 */

export const dynamic = "force-dynamic";

type Elevated = ReturnType<typeof createElevatedClient>;

async function readBody(request: NextRequest): Promise<Record<string, string>> {
  const contentType = request.headers.get("content-type") ?? "";

  // Redsys posts application/x-www-form-urlencoded; accept JSON too so the
  // endpoint can be exercised by hand.
  if (contentType.includes("application/json")) {
    const json: unknown = await request.json();
    return typeof json === "object" && json !== null ? (json as Record<string, string>) : {};
  }

  const form = await request.formData();
  const entries: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") entries[key] = value;
  }
  return entries;
}

export async function POST(request: NextRequest) {
  const supabase = createElevatedClient();

  let body: Record<string, string>;
  try {
    body = await readBody(request);
  } catch {
    return ok();
  }

  const credentials = await getRedsysCredentials();
  if (!credentials) {
    await supabase
      .from("payment_events")
      .insert({ signature_ok: false, raw: { error: "gateway_not_configured", body } });
    return ok();
  }

  const result = verifyRedsysNotification(body, credentials.secretKey);

  if (!result.ok) {
    // Recorded on purpose: a run of these means someone is probing the endpoint.
    await supabase.from("payment_events").insert({
      order_ref: result.notification?.orderRef ?? null,
      signature_ok: false,
      response_code: result.notification?.responseCode ?? null,
      raw: { reason: result.reason, body },
    });
    return ok();
  }

  const { notification } = result;

  // The reference belongs to an attempt, not the order.
  const { data: attemptRow } = await supabase
    .from("payment_attempts")
    .select("id, order_id, attempt_no, status, amount_cents")
    .eq("gateway_ref", notification.orderRef)
    .maybeSingle();

  const attempt = attemptRow as
    | { id: string; order_id: string; attempt_no: number; status: string; amount_cents: number }
    | null;

  await supabase.from("payment_events").insert({
    order_id: attempt?.order_id ?? null,
    order_ref: notification.orderRef,
    signature_ok: true,
    response_code: notification.responseCode,
    auth_code: notification.authorisationCode,
    raw: notification.raw,
  });

  if (!attempt) return ok();

  // A correct signature over the wrong amount is not a payment for this attempt.
  if (notification.amountCents !== null && notification.amountCents !== attempt.amount_cents) {
    await supabase.from("payment_events").insert({
      order_id: attempt.order_id,
      order_ref: notification.orderRef,
      signature_ok: true,
      response_code: notification.responseCode,
      raw: {
        error: "amount_mismatch",
        expected: attempt.amount_cents,
        received: notification.amountCents,
      },
    });
    return ok();
  }

  // Idempotency: only an unsettled attempt moves. Retries land here and stop.
  if (attempt.status !== "pending") return ok();

  const outcome = classifyResponse(notification.responseCode);
  const settledAt = new Date().toISOString();

  await supabase
    .from("payment_attempts")
    .update({
      status: outcome,
      response_code: notification.responseCode,
      auth_code: notification.authorisationCode,
      settled_at: settledAt,
    })
    .eq("id", attempt.id)
    // Guard against a concurrent notification winning the race.
    .eq("status", "pending");

  await supabase
    .from("orders")
    .update({
      status: outcome,
      gateway_response: notification.responseCode,
      gateway_auth_code: notification.authorisationCode,
      paid_at: outcome === "paid" ? settledAt : null,
    })
    .eq("id", attempt.order_id);

  if (outcome === "paid") {
    await decrementStock(supabase, attempt.order_id);
    await recordRedemption(supabase, attempt.order_id);
    await notifyPaid(supabase, attempt.order_id);
  } else {
    await notifyNotPaid(supabase, attempt.order_id);
  }

  return ok();
}

const ok = () => NextResponse.json({ received: true }, { status: 200 });

/**
 * Takes the sold units out of stock.
 *
 * Uses the `adjust_stock` function so each movement is atomic and floors at zero;
 * a variant deleted since the order was placed is skipped rather than failing the
 * whole callback, because the payment itself is already good.
 */
async function decrementStock(supabase: Elevated, orderId: string) {
  const { data } = await supabase
    .from("order_items")
    .select("variant_id, qty")
    .eq("order_id", orderId);

  for (const item of (data ?? []) as { variant_id: string | null; qty: number }[]) {
    if (!item.variant_id) continue;
    await supabase.rpc("adjust_stock", { variant_id: item.variant_id, delta: -item.qty });
  }
}

/**
 * Marks a discount code as used.
 *
 * This is the only place a redemption is ever written, and it runs here rather
 * than at checkout for one reason: a code should be spent when somebody pays
 * with it, not when somebody types it. An abandoned basket must not take the
 * last slot on a limited campaign, and "used 47 times" in the admin panel has to
 * mean forty-seven sales.
 *
 * It never refuses. The limits were checked when the order was placed; by the
 * time we are here the card has been charged, and telling the bank otherwise is
 * not on the table. If two shoppers race for the last redemption of a code, both
 * get it and the shop finds out from this ledger.
 *
 * Idempotent through the UNIQUE constraint on `order_id`: Redsys retries land on
 * a duplicate insert, which is ignored.
 */
async function recordRedemption(supabase: Elevated, orderId: string) {
  const { data } = await supabase
    .from("orders")
    .select("user_id, discount_code, discount_cents")
    .eq("id", orderId)
    .maybeSingle();

  const order = data as {
    user_id: string | null;
    discount_code: string | null;
    discount_cents: number;
  } | null;

  if (!order?.discount_code) return;

  // Soft reference: a code deleted between the order and its payment leaves the
  // redemption in place with its own copy of the string, which is what the
  // reports read anyway.
  const { data: codeRow } = await supabase
    .from("discount_codes")
    .select("id")
    .eq("code", order.discount_code)
    .maybeSingle();

  const { error } = await supabase.from("discount_redemptions").insert({
    discount_id: (codeRow as { id: string } | null)?.id ?? null,
    order_id: orderId,
    user_id: order.user_id,
    code: order.discount_code,
    amount_cents: order.discount_cents,
  });

  // 23505 is the replay landing on the unique order_id — expected, not a fault.
  if (error && error.code !== "23505") {
    console.error("[redsys] could not record redemption", error);
  }
}

/* ---------------------------------------------------------------- emails */

type OrderRow = {
  id: string;
  order_ref: string;
  email: string;
  locale: string;
  amount_cents: number;
  shipping_cents: number;
  discount_code: string | null;
  discount_cents: number;
  vat_rate: number | string;
  failure_notified_at: string | null;
};

async function loadOrder(supabase: Elevated, orderId: string) {
  const { data } = await supabase
    .from("orders")
    .select(
      "id, order_ref, email, locale, amount_cents, shipping_cents, discount_code, discount_cents, vat_rate, failure_notified_at",
    )
    .eq("id", orderId)
    .maybeSingle();

  const order = data as OrderRow | null;
  if (!order) return null;

  const { data: itemRows } = await supabase
    .from("order_items")
    .select("name, size, qty, unit_price_cents, artwork_title")
    .eq("order_id", orderId);

  const locale: Locale = isLocale(order.locale) ? order.locale : "es";

  const summary: OrderSummary = {
    orderRef: order.order_ref,
    amountCents: order.amount_cents,
    shippingCents: order.shipping_cents,
    discountCode: order.discount_code,
    discountCents: order.discount_cents,
    // numeric arrives as a string from PostgREST.
    vatRate: Number(order.vat_rate),
    items: (
      (itemRows ?? []) as {
        name: string;
        size: string;
        qty: number;
        unit_price_cents: number;
        artwork_title: string | null;
      }[]
    ).map((item) => ({
      name: item.name,
      size: item.size,
      qty: item.qty,
      unitPriceCents: item.unit_price_cents,
      artworkTitle: item.artwork_title,
    })),
    // `?ver=1` shows the summary instead of bouncing straight back to the bank.
    url: `${SITE_URL}${href(locale, "order", order.order_ref)}?ver=1`,
  };

  return { order, summary, locale };
}

async function notifyPaid(supabase: Elevated, orderId: string) {
  if (!canSendMail()) return;

  const loaded = await loadOrder(supabase, orderId);
  if (!loaded) return;

  const t = await getDictionary(loaded.locale);
  const message = orderPaidEmail(loaded.summary, t);
  await sendMail({ to: loaded.order.email, ...message });
}

/**
 * Tells the customer a charge did not go through.
 *
 * While retries remain, the email explains how many are left and links straight
 * back to the order so one click starts the next attempt. When they run out, it
 * says plainly that the payment could not be confirmed — and
 * `failure_notified_at` makes sure that final message is sent exactly once, even
 * if the bank replays the notification.
 */
async function notifyNotPaid(supabase: Elevated, orderId: string) {
  const loaded = await loadOrder(supabase, orderId);
  if (!loaded) return;

  const { data: settings } = await supabase
    .from("payment_settings")
    .select("max_attempts")
    .eq("provider", "redsys")
    .maybeSingle();
  const max = (settings as { max_attempts: number } | null)?.max_attempts ?? 3;

  const { count } = await supabase
    .from("payment_attempts")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId);

  const left = Math.max(0, max - (count ?? 0));
  const t = await getDictionary(loaded.locale);

  if (left > 0) {
    if (!canSendMail()) return;
    const message = paymentRetryEmail(loaded.summary, left, t);
    await sendMail({ to: loaded.order.email, ...message });
    return;
  }

  // Out of attempts. Claim the notification first so a replay cannot double-send.
  const { data: claimed } = await supabase
    .from("orders")
    .update({ failure_notified_at: new Date().toISOString() })
    .eq("id", orderId)
    .is("failure_notified_at", null)
    .select("id");

  if (!claimed || claimed.length === 0) return;

  if (!canSendMail()) {
    console.warn(`[mail] order ${loaded.order.order_ref} exhausted attempts but SMTP is unset`);
    return;
  }

  const message = paymentFailedEmail(loaded.summary, t);
  const sent = await sendMail({ to: loaded.order.email, ...message });

  // Release the claim if the send failed, so a later retry can try again.
  if (!sent) {
    await supabase.from("orders").update({ failure_notified_at: null }).eq("id", orderId);
  }
}

/** Redsys occasionally probes with GET; answer politely. */
export function GET() {
  return NextResponse.json({ ok: true, endpoint: "redsys-notify" }, { status: 200 });
}
