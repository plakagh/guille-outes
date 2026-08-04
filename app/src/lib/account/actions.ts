"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";

/**
 * Customer-account mutations.
 *
 * Everything here is scoped to the signed-in user. `user_id` is taken from the
 * validated session — never from the form — so a crafted request cannot touch
 * another customer's rows, and the "own rows only" RLS policies enforce the same
 * rule inside Postgres.
 *
 * Nothing in this file grants catalogue access; that lives behind `is_admin`.
 */

export type AccountResult = { ok: true } | { ok: false; error: string };

const NOT_SIGNED_IN = "not_signed_in";

/* -------------------------------------------------------------- wishlist */

export async function toggleWishlist(formData: FormData): Promise<AccountResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: NOT_SIGNED_IN };

  const productId = String(formData.get("product_id") ?? "");
  if (!productId) return { ok: false, error: "invalid" };

  const wanted = formData.get("wanted") === "true";
  const supabase = await createClient();

  if (wanted) {
    // The primary key makes this idempotent; ignore a duplicate insert.
    const { error } = await supabase
      .from("wishlist_items")
      .upsert({ user_id: user.id, product_id: productId }, { onConflict: "user_id,product_id" });
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("wishlist_items")
      .delete()
      .eq("user_id", user.id)
      .eq("product_id", productId);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/* --------------------------------------------------------------- profile */

export async function updateProfile(formData: FormData): Promise<AccountResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: NOT_SIGNED_IN };

  const fullName = String(formData.get("full_name") ?? "").trim();

  const supabase = await createClient();
  // `full_name` is the only column the `authenticated` role may update; an
  // attempt to include is_admin here would be rejected by Postgres.
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName || null })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/* ------------------------------------------------------------- addresses */

function addressFrom(formData: FormData) {
  const get = (key: string) => String(formData.get(key) ?? "").trim();
  return {
    label: get("label") || null,
    full_name: get("full_name"),
    line1: get("line1"),
    line2: get("line2") || null,
    postcode: get("postcode"),
    city: get("city"),
    province: get("province"),
    phone: get("phone") || null,
  };
}

export async function saveAddress(formData: FormData): Promise<AccountResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: NOT_SIGNED_IN };

  const address = addressFrom(formData);
  if (!address.full_name || !address.line1 || !address.postcode || !address.city) {
    return { ok: false, error: "invalid" };
  }

  const supabase = await createClient();
  const makeDefault = formData.get("is_default") === "on";

  // A partial unique index allows only one default per customer, so clear the
  // previous one first.
  if (makeDefault) {
    await supabase
      .from("customer_addresses")
      .update({ is_default: false })
      .eq("user_id", user.id)
      .eq("is_default", true);
  }

  const id = String(formData.get("id") ?? "");
  const payload = { ...address, user_id: user.id, is_default: makeDefault };

  const { error } = id
    ? await supabase.from("customer_addresses").update(payload).eq("id", id).eq("user_id", user.id)
    : await supabase.from("customer_addresses").insert(payload);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteAddress(formData: FormData): Promise<AccountResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: NOT_SIGNED_IN };

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "invalid" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("customer_addresses")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}
