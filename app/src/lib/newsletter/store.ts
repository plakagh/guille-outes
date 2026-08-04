import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createElevatedClient } from "@/lib/supabase/elevated";
import type { Locale } from "@/lib/i18n/config";

/**
 * Newsletter list access.
 *
 * This is the second place in the application that uses the service-role client,
 * and for the same reason as the payment callback: the actor has no session. A
 * visitor typing an address into the footer is anonymous, and a Row Level
 * Security policy cannot express "insert a row for an address you have not
 * proved you own" — the proof arrives later, in a different request, when the
 * confirmation link is clicked.
 *
 * The fence around it is the same shape:
 *
 *  - `server-only`, so importing it from a client component fails the build;
 *  - the subscriber list is not readable with the anon key at all, so this module
 *    is the only path to it;
 *  - the confirmation token is generated here and stored **hashed**, so the
 *    plaintext exists in exactly one place: the email;
 *  - nothing here trusts the caller's word about an address — `pending` is all a
 *    form submission can ever produce.
 */

export type SubscriberState = "pending" | "confirmed" | "unsubscribed";

const CONFIRM_TTL_HOURS = 72;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Comparison that does not leak how much of the hash matched. */
function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

export type SubscriptionRequest = {
  email: string;
  locale: Locale;
  source: string;
  consentVersion: string;
  consentText: string;
  ip: string | null;
};

export type RequestOutcome =
  | { status: "confirm_sent"; token: string; email: string; locale: Locale }
  | { status: "already_confirmed"; email: string; locale: Locale }
  | { status: "error" };

/**
 * Records an intent to subscribe and returns the token to email.
 *
 * Re-submitting is deliberately forgiving: a fresh token replaces the old one, so
 * someone who lost the first email just asks again. An address that is already
 * confirmed is reported as such and gets nothing — resending a confirmation to a
 * live subscriber would be a way to pester them from the outside.
 */
export async function requestSubscription(
  request: SubscriptionRequest,
): Promise<RequestOutcome> {
  const supabase = createElevatedClient();
  const email = request.email.trim().toLowerCase();

  const { data: existingRow } = await supabase
    .from("newsletter_subscribers")
    .select("id, status")
    .ilike("email", email)
    .maybeSingle();

  const existing = existingRow as { id: string; status: SubscriberState } | null;

  if (existing?.status === "confirmed") {
    return { status: "already_confirmed", email, locale: request.locale };
  }

  // 32 bytes of randomness: this is the only thing standing between an address
  // and a confirmed subscription, so it must not be guessable.
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expires = new Date(now.getTime() + CONFIRM_TTL_HOURS * 3600 * 1000);

  const fields = {
    email,
    locale: request.locale,
    status: "pending" as const,
    confirm_token_hash: hash(token),
    confirm_sent_at: now.toISOString(),
    confirm_expires_at: expires.toISOString(),
    // A previously unsubscribed address that asks again starts over cleanly.
    confirmed_at: null,
    unsubscribed_at: null,
    source: request.source,
    consent_version: request.consentVersion,
    consent_text: request.consentText,
    consent_at: now.toISOString(),
    consent_ip: request.ip,
  };

  const id = existing
    ? await update(supabase, existing.id, fields)
    : await insert(supabase, fields);

  if (!id) return { status: "error" };

  await logEvent(supabase, id, existing ? "resubscribed" : "requested", request.ip);

  return { status: "confirm_sent", token, email, locale: request.locale };
}

type Client = ReturnType<typeof createElevatedClient>;

async function insert(supabase: Client, fields: Record<string, unknown>) {
  const { data, error } = await supabase
    .from("newsletter_subscribers")
    .insert(fields)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[newsletter] insert failed", error);
    return null;
  }
  return (data as { id: string } | null)?.id ?? null;
}

async function update(supabase: Client, id: string, fields: Record<string, unknown>) {
  const { error } = await supabase.from("newsletter_subscribers").update(fields).eq("id", id);
  if (error) {
    console.error("[newsletter] update failed", error);
    return null;
  }
  return id;
}

async function logEvent(
  supabase: Client,
  subscriberId: string,
  kind: "requested" | "confirmed" | "unsubscribed" | "resubscribed",
  ip: string | null,
) {
  await supabase
    .from("newsletter_events")
    .insert({ subscriber_id: subscriberId, kind, ip });
}

export type ConfirmOutcome =
  | {
      status: "confirmed" | "already_confirmed";
      email: string;
      locale: Locale;
      unsubscribeToken: string;
    }
  | { status: "expired" | "invalid" };

/**
 * Turns a pending subscription into a confirmed one.
 *
 * The token is looked up by hash, so the link in the email is the only copy.
 * Clicking twice is not an error — mail clients prefetch links and people press
 * back — so a second visit reports `already_confirmed` rather than failing.
 */
export async function confirmSubscription(
  token: string,
  ip: string | null,
): Promise<ConfirmOutcome> {
  if (!token) return { status: "invalid" };

  const supabase = createElevatedClient();
  const digest = hash(token);

  const { data } = await supabase
    .from("newsletter_subscribers")
    .select("id, email, locale, status, confirm_token_hash, confirm_expires_at, unsubscribe_token")
    .eq("confirm_token_hash", digest)
    .maybeSingle();

  const row = data as {
    id: string;
    email: string;
    locale: Locale;
    status: SubscriberState;
    confirm_token_hash: string | null;
    confirm_expires_at: string | null;
    unsubscribe_token: string;
  } | null;

  if (!row || !row.confirm_token_hash || !sameHash(row.confirm_token_hash, digest)) {
    return { status: "invalid" };
  }

  if (row.status === "confirmed") {
    return {
      status: "already_confirmed",
      email: row.email,
      locale: row.locale,
      unsubscribeToken: row.unsubscribe_token,
    };
  }

  if (row.confirm_expires_at && new Date(row.confirm_expires_at) < new Date()) {
    return { status: "expired" };
  }

  const { error } = await supabase
    .from("newsletter_subscribers")
    .update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      // The hash is deliberately kept. Mail clients and link scanners prefetch
      // URLs, so the human often clicks second — and telling a subscribed person
      // "this link is not valid" would be both alarming and false. `status` is
      // what stops a re-confirmation, and a spent token can do nothing else: it
      // cannot change the address, and unsubscribing clears it so a stale link
      // can never put someone back on the list.
    })
    .eq("id", row.id)
    // If two clicks race, only one wins and only one welcome email goes out.
    .eq("status", "pending");

  if (error) return { status: "invalid" };

  await logEvent(supabase, row.id, "confirmed", ip);

  return {
    status: "confirmed",
    email: row.email,
    locale: row.locale,
    unsubscribeToken: row.unsubscribe_token,
  };
}

export type UnsubscribeOutcome =
  | { status: "unsubscribed" | "already_unsubscribed"; email: string; locale: Locale }
  | { status: "invalid" };

/**
 * Withdrawal of consent (Art. 7(3)): as easy as giving it.
 *
 * No login, no password, no "tell us why" — the token in the email footer is
 * enough. It is not cleared afterwards, so a stale link in an old newsletter
 * still lands on a page that says they are already off the list rather than an
 * error.
 */
export async function unsubscribeByToken(
  token: string,
  ip: string | null,
): Promise<UnsubscribeOutcome> {
  if (!token) return { status: "invalid" };

  const supabase = createElevatedClient();

  const { data } = await supabase
    .from("newsletter_subscribers")
    .select("id, email, locale, status")
    .eq("unsubscribe_token", token)
    .maybeSingle();

  const row = data as { id: string; email: string; locale: Locale; status: SubscriberState } | null;
  if (!row) return { status: "invalid" };

  if (row.status === "unsubscribed") {
    return { status: "already_unsubscribed", email: row.email, locale: row.locale };
  }

  const { error } = await supabase
    .from("newsletter_subscribers")
    .update({
      status: "unsubscribed",
      unsubscribed_at: new Date().toISOString(),
      confirm_token_hash: null,
      confirm_expires_at: null,
    })
    .eq("id", row.id);

  if (error) return { status: "invalid" };

  await logEvent(supabase, row.id, "unsubscribed", ip);
  return { status: "unsubscribed", email: row.email, locale: row.locale };
}
