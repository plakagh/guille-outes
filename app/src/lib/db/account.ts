import { cache } from "react";
import type { ConsentKind } from "@/lib/legal/consent";
import { createClient, getUser } from "@/lib/supabase/server";

export type CustomerAddress = {
  id: string;
  label: string | null;
  fullName: string;
  line1: string;
  line2: string | null;
  postcode: string;
  city: string;
  province: string;
  phone: string | null;
  isDefault: boolean;
};

/**
 * Product ids on the signed-in customer's wishlist, or an empty array when
 * signed out. RLS restricts the query to the caller's own rows, so there is no
 * `user_id` filter to forget here.
 */
export const getWishlistIds = cache(async (): Promise<string[]> => {
  const user = await getUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wishlist_items")
    .select("product_id")
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return (data as { product_id: string }[]).map((row) => row.product_id);
});

export const getAddresses = cache(async (): Promise<CustomerAddress[]> => {
  const user = await getUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_addresses")
    .select("id, label, full_name, line1, line2, postcode, city, province, phone, is_default")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return (
    data as {
      id: string;
      label: string | null;
      full_name: string;
      line1: string;
      line2: string | null;
      postcode: string;
      city: string;
      province: string;
      phone: string | null;
      is_default: boolean;
    }[]
  ).map((row) => ({
    id: row.id,
    label: row.label,
    fullName: row.full_name,
    line1: row.line1,
    line2: row.line2,
    postcode: row.postcode,
    city: row.city,
    province: row.province,
    phone: row.phone,
    isDefault: row.is_default,
  }));
});

export type ConsentRow = {
  id: string;
  kind: ConsentKind;
  granted: boolean;
  docVersion: string;
  createdAt: string;
};

/** The signed-in customer's consent trail, newest first. */
export const getConsentHistory = cache(async (): Promise<ConsentRow[]> => {
  const user = await getUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_consents")
    .select("id, kind, granted, doc_version, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !data) return [];

  return (
    data as {
      id: string;
      kind: ConsentKind;
      granted: boolean;
      doc_version: string;
      created_at: string;
    }[]
  ).map((row) => ({
    id: row.id,
    kind: row.kind,
    granted: row.granted,
    docVersion: row.doc_version,
    createdAt: row.created_at,
  }));
});
