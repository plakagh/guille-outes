import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createElevatedClient } from "@/lib/supabase/elevated";

/**
 * Payment attempts, a.k.a. recobros.
 *
 * Each attempt has its own gateway reference because Redsys refuses a repeated
 * Ds_Merchant_Order. The customer-facing order reference never changes.
 */

export type PaymentAttempt = {
  id: string;
  attemptNo: number;
  gatewayRef: string;
  status: "pending" | "paid" | "failed" | "cancelled";
  amountCents: number;
  responseCode: string | null;
};

export type AttemptState = {
  attempts: PaymentAttempt[];
  used: number;
  max: number;
  left: number;
  /** The attempt currently awaiting an answer from the bank, if any. */
  pending: PaymentAttempt | null;
};

type Row = {
  id: string;
  attempt_no: number;
  gateway_ref: string;
  status: PaymentAttempt["status"];
  amount_cents: number;
  response_code: string | null;
};

const map = (row: Row): PaymentAttempt => ({
  id: row.id,
  attemptNo: row.attempt_no,
  gatewayRef: row.gateway_ref,
  status: row.status,
  amountCents: row.amount_cents,
  responseCode: row.response_code,
});

const SELECT = "id, attempt_no, gateway_ref, status, amount_cents, response_code";

/** How many attempts the shop allows, from the gateway settings. */
export async function maxAttempts(): Promise<number> {
  const supabase = createElevatedClient();
  const { data } = await supabase
    .from("payment_settings")
    .select("max_attempts")
    .eq("provider", "redsys")
    .maybeSingle();

  return (data as { max_attempts: number } | null)?.max_attempts ?? 3;
}

/**
 * Attempt history for an order, read with the caller's own session — so RLS
 * decides, and a customer can only ever see their own.
 */
export async function attemptState(orderId: string): Promise<AttemptState> {
  const [supabase, max] = await Promise.all([createClient(), maxAttempts()]);

  const { data } = await supabase
    .from("payment_attempts")
    .select(SELECT)
    .eq("order_id", orderId)
    .order("attempt_no", { ascending: true });

  const attempts = ((data ?? []) as Row[]).map(map);

  return {
    attempts,
    used: attempts.length,
    max,
    left: Math.max(0, max - attempts.length),
    pending: attempts.find((attempt) => attempt.status === "pending") ?? null,
  };
}

export type StartResult =
  | { ok: true; attempt: PaymentAttempt }
  | { ok: false; reason: "exhausted" | "already_paid" | "forbidden" | "out_of_stock" | "error" };

/**
 * Begins the next attempt, or hands back the one already in flight.
 *
 * The work happens in `start_payment_attempt`, a SECURITY DEFINER function that
 * checks ownership and the limit itself — so this cannot be used to grant a
 * customer an extra retry, and the reference it allocates is guaranteed unique.
 */
export async function startAttempt(orderId: string): Promise<StartResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_payment_attempt", {
    p_order_id: orderId,
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("no attempts left")) return { ok: false, reason: "exhausted" };
    if (message.includes("already paid")) return { ok: false, reason: "already_paid" };
    if (message.includes("out of stock")) return { ok: false, reason: "out_of_stock" };
    if (message.includes("not your order") || message.includes("order not found")) {
      return { ok: false, reason: "forbidden" };
    }
    console.error("startAttempt failed", error);
    return { ok: false, reason: "error" };
  }

  // Postgres functions returning a table type come back as a single object.
  const row = (Array.isArray(data) ? data[0] : data) as Row | null;
  if (!row) return { ok: false, reason: "error" };

  return { ok: true, attempt: map(row) };
}
