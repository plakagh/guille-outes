import "server-only";

import { randomInt } from "node:crypto";
import { isCodeShape } from "@/lib/discounts";
import { createElevatedClient } from "@/lib/supabase/elevated";

/**
 * The welcome discount, minted per subscriber.
 *
 * Called from exactly one place — the moment a subscription goes from `pending`
 * to `confirmed` — because that is the moment the offer has an owner. Issuing on
 * submission instead would hand 10 % to whoever typed an address into the footer,
 * which is the thing double opt-in exists to prevent.
 *
 * The code is an ordinary row in `discount_codes` with two things set:
 * `issued_to_email`, which makes it personal, and `max_redemptions = 1`, which
 * makes it single use. Neither is enforced here — the database counts the
 * redemptions and `discount_lookup` decides whose code it is, so a tampered
 * request cannot spend somebody else's welcome offer and cannot spend its own
 * twice. This module only writes the row.
 *
 * It runs with the service-role client for the same reason the subscriber list
 * does: the visitor clicking the link in their inbox has no session, so there is
 * no `authenticated` role for a policy to authorise. The fence is the same shape —
 * `server-only`, one caller, and nothing here trusts the caller's word about an
 * address: the email it is given came out of the row whose confirmation token
 * just matched.
 */

/** What `campaign` is set to, and therefore what makes issuing idempotent. */
export const WELCOME_CAMPAIGN = "newsletter_welcome";

/** The offer, in one place: the email says this figure and the code carries it. */
export const WELCOME_PERCENT = 10;

/**
 * Long enough not to be a nudge, short enough to be one.
 *
 * Three months also keeps the list of live personal codes from growing without
 * bound: an unclaimed one lapses on its own rather than sitting there for years.
 */
const WELCOME_TTL_DAYS = 90;

/**
 * No I, L, O, U, 0 or 1.
 *
 * This is a code somebody reads off a screen and types on a phone, so the pairs
 * that get misread (O/0, I/1/l) are simply not in the alphabet. 31 symbols over 8
 * positions is about 40 bits — a code nobody is going to stumble onto, which
 * matters because the string is the first half of the proof of ownership.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const RANDOM_CHARS = 8;

/** Postgres unique violation: either the code collided, or two clicks raced. */
const UNIQUE_VIOLATION = "23505";

export type WelcomeCode = {
  code: string;
  percent: number;
  /** ISO instant. Shown in the email, enforced by the evaluator. */
  expiresAt: string;
};

type Row = { id: string; code: string; ends_at: string | null; enabled: boolean };

const SELECT = "id, code, ends_at, enabled";

/**
 * The code for this address: the one it already has, or a new one.
 *
 * Returns null when there is nothing to send — the address has already spent its
 * welcome discount, or the row could not be written. Null is not an error the
 * subscriber should hear about: the welcome email still goes out, just without an
 * offer in it, which is the honest thing to show someone who has already had one.
 */
export async function issueWelcomeCode(rawEmail: string): Promise<WelcomeCode | null> {
  const email = rawEmail.trim().toLowerCase();
  if (!email.includes("@")) return null;

  const supabase = createElevatedClient();

  const existing = await find(supabase, email);
  if (existing) return revive(supabase, existing);

  // Two shapes of unique violation can land here: a collision on `code`, which a
  // fresh string fixes, and a collision on (campaign, issued_to_email) from two
  // clicks racing, which it never will. They are told apart by re-reading.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateCode();
    const expiresAt = new Date(Date.now() + WELCOME_TTL_DAYS * 86_400_000).toISOString();

    const { error } = await supabase.from("discount_codes").insert({
      code,
      campaign: WELCOME_CAMPAIGN,
      issued_to_email: email,
      kind: "percent",
      percent: WELCOME_PERCENT,
      min_subtotal_cents: 0,
      scope: "all",
      // The welcome offer does not stack on top of the outlet: 10 % off a shirt
      // that is already 40 % down is an accident rather than an offer, and the
      // same default the admin form uses for a written campaign.
      exclude_discounted: true,
      // Not `first_order_only`, deliberately. That limit counts paid orders on
      // the *account*, and most people subscribe from the footer before they have
      // one — so it would refuse existing customers the very code we emailed
      // them, and refuse anyone who signs up with a second address. Personal and
      // single-use is what stops this being farmed; who has bought before is not
      // what the offer turns on.
      first_order_only: false,
      max_redemptions: 1,
      max_per_customer: 1,
      ends_at: expiresAt,
      enabled: true,
      created_by: null,
    });

    if (!error) return { code, percent: WELCOME_PERCENT, expiresAt };

    if (error.code !== UNIQUE_VIOLATION) {
      console.error("[newsletter] could not issue the welcome code", error);
      return null;
    }

    const raced = await find(supabase, email);
    if (raced) return revive(supabase, raced);
  }

  console.error("[newsletter] gave up generating a free welcome code");
  return null;
}

type Client = ReturnType<typeof createElevatedClient>;

async function find(supabase: Client, email: string): Promise<Row | null> {
  const { data } = await supabase
    .from("discount_codes")
    .select(SELECT)
    .eq("campaign", WELCOME_CAMPAIGN)
    .eq("issued_to_email", email)
    .maybeSingle();

  return (data as Row | null) ?? null;
}

/**
 * The code this address was given before, made usable again if it can be.
 *
 * The path that gets here is someone who unsubscribed and came back: the unique
 * index means they cannot be given a second 10 %, and confirming again should not
 * silently hand them a code that lapsed while they were away either. So an
 * unspent code has its window pushed out and is returned; a spent one returns
 * null, and the welcome email goes out without an offer.
 */
async function revive(supabase: Client, row: Row): Promise<WelcomeCode | null> {
  const { data: spent } = await supabase
    .from("discount_redemptions")
    .select("id")
    .eq("discount_id", row.id)
    .limit(1);

  if ((spent as unknown[] | null)?.length) return null;

  const live = row.enabled && row.ends_at !== null && Date.parse(row.ends_at) > Date.now();
  if (live) {
    return { code: row.code, percent: WELCOME_PERCENT, expiresAt: row.ends_at as string };
  }

  const expiresAt = new Date(Date.now() + WELCOME_TTL_DAYS * 86_400_000).toISOString();
  const { error } = await supabase
    .from("discount_codes")
    .update({ enabled: true, ends_at: expiresAt })
    .eq("id", row.id);

  if (error) {
    console.error("[newsletter] could not extend the welcome code", error);
    return null;
  }

  return { code: row.code, percent: WELCOME_PERCENT, expiresAt };
}

/**
 * `CLUB10-XXXXXXXX`.
 *
 * The prefix is built from the percentage rather than typed, so a shop that
 * changes the offer to 15 % cannot end up posting CLUB10 codes worth 15. Checked
 * against the column's own shape before it is sent, because a code the table
 * would refuse is a mistake to catch here rather than in a constraint violation.
 */
function generateCode(): string {
  let tail = "";
  for (let index = 0; index < RANDOM_CHARS; index += 1) {
    tail += ALPHABET[randomInt(ALPHABET.length)];
  }

  const code = `CLUB${WELCOME_PERCENT}-${tail}`;
  if (!isCodeShape(code)) throw new Error(`welcome code has an impossible shape: ${code}`);
  return code;
}
