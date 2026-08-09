"use server";

import { revalidatePath } from "next/cache";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { createClient, getViewer } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/admin/actions";

/**
 * Shop-wide settings: shipping rates and the promo bar.
 *
 * Same two gates as the catalogue mutations: `requireAdmin()` here for a clean
 * error, and Row Level Security in Postgres as the gate that actually matters —
 * every statement runs as the caller's own session, so removing this check would
 * not open anything up.
 */

const FORBIDDEN = "forbidden";
const INVALID = "invalid";

async function requireAdmin() {
  const viewer = await getViewer();
  return viewer?.isAdmin ? viewer : null;
}

/** Every storefront route quotes shipping, so the whole tree is revalidated. */
function revalidateStore() {
  revalidatePath("/", "layout");
}

function str(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Euros in the form, integer cents in the database.
 *
 * Returns null for anything that is not a sane amount, so a typo becomes a
 * refusal rather than free shipping for everyone.
 */
function cents(form: FormData, key: string): number | null {
  const raw = str(form, key).replace(",", ".");
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 10000) return null;
  return Math.round(value * 100);
}

/* ------------------------------------------------------------- shipping */

export async function saveShippingSettings(form: FormData): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: FORBIDDEN };

  const freeThreshold = cents(form, "free_threshold");
  const standard = cents(form, "standard");
  const express = cents(form, "express");
  const pickup = cents(form, "pickup");

  // A blank threshold means "never free", which is 0 only if written as 0 — an
  // empty box is a mistake, not an instruction.
  if (freeThreshold === null || standard === null || express === null || pickup === null) {
    return { ok: false, error: INVALID };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("shipping_settings")
    .update({
      free_threshold_cents: freeThreshold,
      standard_cents: standard,
      express_cents: express,
      pickup_cents: pickup,
      express_enabled: form.get("express_enabled") === "on",
      pickup_enabled: form.get("pickup_enabled") === "on",
    })
    .eq("singleton", true);

  if (error) return { ok: false, error: error.message };

  revalidateStore();
  return { ok: true };
}

/* ------------------------------------------------------- notifications */

/**
 * The address the shop is told about orders at.
 *
 * Blank switches the notices off, which is a real choice and not an error — so
 * the field is emptied to null rather than refused. Anything else has to look
 * like an address: the same shape the column's own CHECK enforces, tested here so
 * a typo comes back as a message on the form instead of a database error.
 */
export async function saveNotificationSettings(form: FormData): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: FORBIDDEN };

  const email = str(form, "order_email").toLowerCase();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "bad_email" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("notification_settings")
    .update({ order_email: email || null })
    .eq("singleton", true);

  if (error) return { ok: false, error: error.message };

  // Nothing on the storefront reads this, so there is nothing to revalidate.
  return { ok: true };
}

/* ---------------------------------------------------------- promo bar */

/**
 * Collects a `field_es` / `field_gl` / `field_en` group.
 *
 * Castellano is required and the others fall back to it, so a half-filled form
 * can never leave a blank message in one language.
 */
function bundle(form: FormData, prefix: string): Record<Locale, string> | null {
  const es = str(form, `${prefix}_es`);
  if (!es) return null;
  return Object.fromEntries(
    LOCALES.map((locale) => [locale, str(form, `${prefix}_${locale}`) || es]),
  ) as Record<Locale, string>;
}

/**
 * Optional link bundle.
 *
 * Only a site-relative path or an absolute http(s) URL is accepted. A bare
 * `javascript:` or `data:` string in an anchor the whole shop renders would be a
 * stored-XSS vector, and the admin has no reason to need one.
 */
function linkBundle(form: FormData, prefix: string): Record<Locale, string> | null | "invalid" {
  const es = str(form, `${prefix}_es`);
  if (!es) return null;

  const safe = (value: string) => /^\/(?!\/)/.test(value) || /^https?:\/\//i.test(value);

  const resolved = Object.fromEntries(
    LOCALES.map((locale) => [locale, str(form, `${prefix}_${locale}`) || es]),
  ) as Record<Locale, string>;

  return Object.values(resolved).every(safe) ? resolved : "invalid";
}

export async function savePromoMessage(form: FormData): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: FORBIDDEN };

  const text = bundle(form, "text");
  if (!text) return { ok: false, error: "text_required" };

  const link = linkBundle(form, "link");
  if (link === "invalid") return { ok: false, error: "bad_link" };

  const position = Number(str(form, "position"));
  const payload = {
    text,
    link,
    position: Number.isFinite(position) ? Math.round(position) : 0,
    enabled: form.get("enabled") === "on",
  };

  const supabase = await createClient();
  const id = str(form, "id");

  const { error } = id
    ? await supabase.from("promo_messages").update(payload).eq("id", id)
    : await supabase.from("promo_messages").insert(payload);

  if (error) return { ok: false, error: error.message };

  revalidateStore();
  return { ok: true };
}

export async function deletePromoMessage(form: FormData): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: FORBIDDEN };

  const id = str(form, "id");
  if (!id) return { ok: false, error: INVALID };

  const supabase = await createClient();
  const { error } = await supabase.from("promo_messages").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidateStore();
  return { ok: true };
}
