import { cache } from "react";
import type { FrameChoice } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";

export type OrderItem = {
  id: string;
  name: string;
  ref: string | null;
  size: string;
  colorwayId: string;
  unitPriceCents: number;
  qty: number;
  /**
   * The drawing printed on this line, snapshotted at the time of the order.
   * Survives the family taking the drawing down, which is the point: the shirt
   * has been paid for and still has to be made.
   */
  artworkTitle: string | null;
  /**
   * The frame this line was bought with, or `"none"` for the print on its own.
   * Null for a product that is not sold framed, and for any order placed before
   * the frame was something you could choose.
   */
  frameFinish: FrameChoice | null;
  /** The part of `unitPriceCents` that is the frame. Zero without one. */
  frameSurchargeCents: number;
};

export type Order = {
  id: string;
  orderRef: string;
  status: "pending" | "paid" | "failed" | "cancelled" | "refunded";
  email: string;
  amountCents: number;
  shippingCents: number;
  /** The code used, snapshotted; null on an order placed without one. */
  discountCode: string | null;
  /** Cents taken off, waived delivery included. */
  discountCents: number;
  /** The rate charged on this order, kept so past invoices never change. */
  vatRate: number;
  shipName: string;
  shipLine1: string;
  shipLine2: string | null;
  shipPostcode: string;
  shipCity: string;
  shipProvince: string;
  gatewayResponse: string | null;
  createdAt: string;
  items: OrderItem[];
};

const SELECT = `
  id, order_ref, status, email, amount_cents, shipping_cents,
  discount_code, discount_cents, vat_rate,
  ship_name, ship_line1, ship_line2, ship_postcode, ship_city, ship_province,
  gateway_response, created_at,
  order_items (
    id, name, ref, size, colorway_id, unit_price_cents, qty, artwork_title,
    frame_finish, frame_surcharge_cents
  )
`;

type OrderRow = {
  id: string;
  order_ref: string;
  status: Order["status"];
  email: string;
  amount_cents: number;
  shipping_cents: number;
  discount_code: string | null;
  discount_cents: number;
  vat_rate: number | string;
  ship_name: string;
  ship_line1: string;
  ship_line2: string | null;
  ship_postcode: string;
  ship_city: string;
  ship_province: string;
  gateway_response: string | null;
  created_at: string;
  order_items:
    | {
        id: string;
        name: string;
        ref: string | null;
        size: string;
        colorway_id: string;
        unit_price_cents: number;
        qty: number;
        artwork_title: string | null;
        frame_finish: FrameChoice | null;
        frame_surcharge_cents: number;
      }[]
    | null;
};

function mapOrder(row: OrderRow): Order {
  return {
    id: row.id,
    orderRef: row.order_ref,
    status: row.status,
    email: row.email,
    amountCents: row.amount_cents,
    shippingCents: row.shipping_cents,
    discountCode: row.discount_code,
    discountCents: row.discount_cents,
    // numeric comes back as a string from PostgREST.
    vatRate: Number(row.vat_rate),
    shipName: row.ship_name,
    shipLine1: row.ship_line1,
    shipLine2: row.ship_line2,
    shipPostcode: row.ship_postcode,
    shipCity: row.ship_city,
    shipProvince: row.ship_province,
    gatewayResponse: row.gateway_response,
    createdAt: row.created_at,
    items: (row.order_items ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      ref: item.ref,
      size: item.size,
      colorwayId: item.colorway_id,
      unitPriceCents: item.unit_price_cents,
      qty: item.qty,
      artworkTitle: item.artwork_title,
      frameFinish: item.frame_finish,
      frameSurchargeCents: item.frame_surcharge_cents,
    })),
  };
}

/**
 * One order by its public reference.
 *
 * Read with the visitor's own session, so RLS decides: a customer sees only
 * their own orders and an admin sees any. Someone guessing a reference gets
 * nothing, which is why no extra ownership check is needed here.
 */
export const getOrderByRef = cache(async (orderRef: string): Promise<Order | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(SELECT)
    .eq("order_ref", orderRef)
    .maybeSingle();

  if (error || !data) return null;
  return mapOrder(data as unknown as OrderRow);
});

/** The signed-in customer's order history, newest first. */
export const getMyOrders = cache(async (): Promise<Order[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !data) return [];
  return (data as unknown as OrderRow[]).map(mapOrder);
});
