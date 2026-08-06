"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/admin/actions";
import { isCodeShape, normalizeCode, type DiscountKind, type DiscountScope } from "@/lib/discounts";
import { createClient, getViewer } from "@/lib/supabase/server";

/**
 * Creating and editing discount codes.
 *
 * The same two gates as every other admin mutation: `requireAdmin()` for a clean
 * error, and Row Level Security in Postgres for the one that matters — every
 * statement runs as the administrator's own session, and `discount_codes` has no
 * policy for anybody else.
 *
 * The validation here duplicates the table's CHECK constraints on purpose. The
 * constraints are what make a bad row impossible; these are what turn "new row
 * violates check constraint discount_codes_value_matches_kind" into a sentence
 * the shop can act on.
 */

const FORBIDDEN = "forbidden";
const INVALID = "invalid";

/** Postgres unique violation. The only constraint that a careful form still hits. */
const UNIQUE_VIOLATION = "23505";

async function requireAdmin() {
  const viewer = await getViewer();
  return viewer?.isAdmin ? viewer : null;
}

function str(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

const on = (form: FormData, key: string) => form.get(key) === "on";

/** A whole number, or null when the box was left empty (which means "no limit"). */
function optionalInt(form: FormData, key: string): number | null | "invalid" {
  const raw = str(form, key);
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) return "invalid";
  return Math.round(value);
}

/** Euros in the form, integer cents in the database. Empty is null. */
function optionalCents(form: FormData, key: string): number | null | "invalid" {
  const raw = str(form, key).replace(",", ".");
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 100000) return "invalid";
  return Math.round(value * 100);
}

/**
 * An instant, or null.
 *
 * The form posts ISO-8601 with an offset, built in the browser from a
 * `datetime-local` box — so "ends at midnight" means midnight where the shop is,
 * not midnight wherever the server happens to be running.
 */
function optionalInstant(form: FormData, key: string): string | null | "invalid" {
  const raw = str(form, key);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "invalid";
}

const KINDS: DiscountKind[] = ["percent", "amount", "free_shipping"];
const SCOPES: DiscountScope[] = ["all", "collection", "category"];

/** Codes affect what the cart quotes, and the cart is on every page. */
function revalidateStore() {
  revalidatePath("/", "layout");
}

export async function saveDiscountCode(form: FormData): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: FORBIDDEN };

  const code = normalizeCode(str(form, "code"));
  if (!isCodeShape(code)) return { ok: false, error: "bad_code" };

  const kind = str(form, "kind") as DiscountKind;
  if (!KINDS.includes(kind)) return { ok: false, error: INVALID };

  const scope = str(form, "scope") as DiscountScope;
  if (!SCOPES.includes(scope)) return { ok: false, error: INVALID };

  // Only the field that belongs to this kind is read. A shop that types 20 into
  // the percent box, switches to "fixed amount" and saves must not end up with a
  // row carrying both — the table would refuse it, and rightly.
  let percent: number | null = null;
  let amountCents: number | null = null;

  if (kind === "percent") {
    const value = Number(str(form, "percent"));
    if (!Number.isFinite(value) || value < 1 || value > 100) {
      return { ok: false, error: "bad_percent" };
    }
    percent = Math.round(value);
  }

  if (kind === "amount") {
    const value = optionalCents(form, "amount");
    if (value === "invalid" || value === null || value <= 0) {
      return { ok: false, error: "bad_amount" };
    }
    amountCents = value;
  }

  // Only a percentage can have a ceiling; on the other kinds the box is hidden
  // and anything left in it is dropped rather than saved into a refusal.
  const cap = kind === "percent" ? optionalCents(form, "max_discount") : null;
  if (cap === "invalid") return { ok: false, error: INVALID };

  const minSubtotal = optionalCents(form, "min_subtotal");
  if (minSubtotal === "invalid") return { ok: false, error: INVALID };

  const maxRedemptions = optionalInt(form, "max_redemptions");
  const maxPerCustomer = optionalInt(form, "max_per_customer");
  if (maxRedemptions === "invalid" || maxPerCustomer === "invalid") {
    return { ok: false, error: INVALID };
  }

  const startsAt = optionalInstant(form, "starts_at");
  const endsAt = optionalInstant(form, "ends_at");
  if (startsAt === "invalid" || endsAt === "invalid") return { ok: false, error: INVALID };
  if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) {
    return { ok: false, error: "bad_window" };
  }

  const collectionId = scope === "collection" ? str(form, "collection_id") : "";
  const categoryId = scope === "category" ? str(form, "category_id") : "";
  if (scope === "collection" && !collectionId) return { ok: false, error: "bad_scope" };
  if (scope === "category" && !categoryId) return { ok: false, error: "bad_scope" };

  const viewer = await getViewer();
  const payload = {
    code,
    kind,
    percent,
    amount_cents: amountCents,
    max_discount_cents: cap,
    min_subtotal_cents: minSubtotal ?? 0,
    scope,
    collection_id: collectionId || null,
    category_id: categoryId || null,
    exclude_discounted: on(form, "exclude_discounted"),
    first_order_only: on(form, "first_order_only"),
    max_redemptions: maxRedemptions,
    max_per_customer: maxPerCustomer,
    starts_at: startsAt,
    ends_at: endsAt,
    enabled: on(form, "enabled"),
    note: str(form, "note") || null,
  };

  const supabase = await createClient();
  const id = str(form, "id");

  const { error } = id
    ? await supabase.from("discount_codes").update(payload).eq("id", id)
    : await supabase
        .from("discount_codes")
        .insert({ ...payload, created_by: viewer?.id ?? null });

  if (error) {
    return { ok: false, error: error.code === UNIQUE_VIOLATION ? "code_taken" : error.message };
  }

  revalidateStore();
  return { ok: true };
}

/**
 * The switch.
 *
 * Its own action rather than a round trip through the whole form, because
 * stopping a campaign is the one thing a shop does in a hurry.
 */
export async function toggleDiscountCode(form: FormData): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: FORBIDDEN };

  const id = str(form, "id");
  if (!id) return { ok: false, error: INVALID };

  const supabase = await createClient();
  const { error } = await supabase
    .from("discount_codes")
    .update({ enabled: on(form, "enabled") })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidateStore();
  return { ok: true };
}

/**
 * Deleting a code.
 *
 * The redemptions survive it: `discount_id` is a soft reference and each row
 * keeps its own copy of the string and the amount, so the orders that used a
 * deleted code still say what they were given. What is lost is the tie between
 * them, which is why switching a code off is nearly always the better move.
 */
export async function deleteDiscountCode(form: FormData): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: FORBIDDEN };

  const id = str(form, "id");
  if (!id) return { ok: false, error: INVALID };

  const supabase = await createClient();
  const { error } = await supabase.from("discount_codes").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidateStore();
  return { ok: true };
}
