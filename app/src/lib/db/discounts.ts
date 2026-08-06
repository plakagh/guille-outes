import "server-only";

import type { DiscountKind, DiscountRules, DiscountScope } from "@/lib/discounts";
import { isCodeShape, normalizeCode } from "@/lib/discounts";
import { createClient } from "@/lib/supabase/server";

/**
 * Reading discount codes.
 *
 * Two very different doors, on purpose:
 *
 *  - The storefront goes through `lookupDiscount`, which calls a SECURITY
 *    DEFINER function and can only ever ask about one exact string. There is no
 *    read policy on `discount_codes` for a customer, so this is the whole of
 *    what a shopper can learn: the code they typed, if it exists.
 *
 *  - The admin panel selects the table directly, under the administrator's own
 *    session, and RLS is what lets it.
 */

type LookupRow = {
  id: string;
  code: string;
  kind: DiscountKind;
  percent: number | null;
  amount_cents: number | null;
  max_discount_cents: number | null;
  min_subtotal_cents: number;
  scope: DiscountScope;
  collection_id: string | null;
  category_id: string | null;
  exclude_discounted: boolean;
  first_order_only: boolean;
  max_redemptions: number | null;
  max_per_customer: number | null;
  starts_at: string | null;
  ends_at: string | null;
  used_total: number;
  used_by_caller: number;
  caller_has_paid: boolean;
};

/**
 * One code by its exact string, or null.
 *
 * Null covers every way of not having a code — never typed, misspelt, switched
 * off, does not exist — and the caller turns that into a single "not valid"
 * message. Which of those it was is not something the shop should be telling
 * whoever is typing.
 */
export async function lookupDiscount(raw: string): Promise<DiscountRules | null> {
  const code = normalizeCode(raw);
  // Saves a round trip on anything the column could not hold anyway.
  if (!isCodeShape(code)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("discount_lookup", { p_code: code });

  if (error) {
    console.error("[discounts] lookup failed", error);
    return null;
  }

  const row = (data as LookupRow[] | null)?.[0];
  if (!row) return null;

  return {
    id: row.id,
    code: row.code,
    kind: row.kind,
    percent: row.percent,
    amountCents: row.amount_cents,
    maxDiscountCents: row.max_discount_cents,
    minSubtotalCents: row.min_subtotal_cents,
    scope: row.scope,
    collectionId: row.collection_id,
    categoryId: row.category_id,
    excludeDiscounted: row.exclude_discounted,
    firstOrderOnly: row.first_order_only,
    maxRedemptions: row.max_redemptions,
    maxPerCustomer: row.max_per_customer,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    usedTotal: row.used_total,
    usedByCaller: row.used_by_caller,
    callerHasPaid: row.caller_has_paid,
  };
}

/* ------------------------------------------------------------------ admin */

/** A code as the admin form edits it, plus what it has done so far. */
export type DiscountDraft = {
  id: string;
  code: string;
  kind: DiscountKind;
  percent: number | null;
  amountCents: number | null;
  maxDiscountCents: number | null;
  minSubtotalCents: number;
  scope: DiscountScope;
  collectionId: string | null;
  categoryId: string | null;
  excludeDiscounted: boolean;
  firstOrderOnly: boolean;
  maxRedemptions: number | null;
  maxPerCustomer: number | null;
  /** ISO date-time, trimmed to what `<input type="datetime-local">` wants. */
  startsAt: string | null;
  endsAt: string | null;
  enabled: boolean;
  note: string;
  createdAt: string;
  /** From `discount_code_stats`; zeroes for a code nobody has used. */
  usedTotal: number;
  usedByCustomers: number;
  givenCents: number;
  lastUsedAt: string | null;
};

type CodeRow = {
  id: string;
  code: string;
  kind: DiscountKind;
  percent: number | null;
  amount_cents: number | null;
  max_discount_cents: number | null;
  min_subtotal_cents: number;
  scope: DiscountScope;
  collection_id: string | null;
  category_id: string | null;
  exclude_discounted: boolean;
  first_order_only: boolean;
  max_redemptions: number | null;
  max_per_customer: number | null;
  starts_at: string | null;
  ends_at: string | null;
  enabled: boolean;
  note: string | null;
  created_at: string;
};

type StatRow = {
  id: string;
  used_total: number;
  used_by_customers: number;
  given_cents: number;
  last_used_at: string | null;
};

/**
 * Every code, with its totals.
 *
 * Two queries rather than an embedded join: `discount_code_stats` is a view, and
 * PostgREST will not walk a relationship into one. At this shop's scale that is
 * two small reads, and it keeps the view free to grow columns without the
 * storefront's select string having to know about them.
 */
export async function listDiscountCodes(): Promise<DiscountDraft[]> {
  const supabase = await createClient();

  const [{ data: codes, error }, { data: stats }] = await Promise.all([
    supabase.from("discount_codes").select("*").order("created_at", { ascending: false }),
    supabase.from("discount_code_stats").select("*"),
  ]);

  if (error) {
    console.error("[discounts] admin list failed", error);
    return [];
  }

  const byId = new Map(((stats ?? []) as StatRow[]).map((row) => [row.id, row]));

  return ((codes ?? []) as CodeRow[]).map((row) => {
    const stat = byId.get(row.id);
    return {
      id: row.id,
      code: row.code,
      kind: row.kind,
      percent: row.percent,
      amountCents: row.amount_cents,
      maxDiscountCents: row.max_discount_cents,
      minSubtotalCents: row.min_subtotal_cents,
      scope: row.scope,
      collectionId: row.collection_id,
      categoryId: row.category_id,
      excludeDiscounted: row.exclude_discounted,
      firstOrderOnly: row.first_order_only,
      maxRedemptions: row.max_redemptions,
      maxPerCustomer: row.max_per_customer,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      enabled: row.enabled,
      note: row.note ?? "",
      createdAt: row.created_at,
      usedTotal: stat?.used_total ?? 0,
      usedByCustomers: stat?.used_by_customers ?? 0,
      givenCents: stat?.given_cents ?? 0,
      lastUsedAt: stat?.last_used_at ?? null,
    };
  });
}
