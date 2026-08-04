import "server-only";

import { cache } from "react";
import { canStoreSecrets, open, seal } from "@/lib/payments/secret-box";
import type { RedsysCredentials, RedsysEnvironment } from "@/lib/payments/redsys";
import { createElevatedClient } from "@/lib/supabase/elevated";
import { createClient, getViewer } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/supabase/env";

/**
 * Reads and writes the Redsys configuration.
 *
 * The merchant secret never leaves this module in plaintext except as part of a
 * `RedsysCredentials` object handed straight to the signing code. The admin UI
 * only ever sees whether a secret is present.
 */

const PROVIDER = "redsys";

/** Everything the admin form needs — no secret material. */
export type PaymentSettingsView = {
  enabled: boolean;
  environment: RedsysEnvironment;
  merchantCode: string;
  terminal: string;
  merchantName: string;
  currency: number;
  /** Total attempts allowed per order, including the first. */
  maxAttempts: number;
  /** A secret is stored and decryptable. */
  hasSecret: boolean;
  /** A secret is stored but cannot be decrypted with the current key. */
  secretUnreadable: boolean;
  /** The server has no PAYMENTS_ENCRYPTION_KEY, so nothing can be stored. */
  canStoreSecrets: boolean;
  updatedAt: string | null;
};

type Row = {
  enabled: boolean;
  environment: string;
  merchant_code: string | null;
  terminal: string;
  merchant_name: string | null;
  currency: number;
  secret_key_encrypted: string | null;
  max_attempts: number;
  updated_at: string | null;
};

const SELECT =
  "enabled, environment, merchant_code, terminal, merchant_name, currency, secret_key_encrypted, max_attempts, updated_at";

/**
 * The gateway URLs to register in the bank's admin panel. Derived from
 * NEXT_PUBLIC_SITE_URL so they cannot drift from what we actually send.
 */
export function gatewayUrls(baseUrl: string = SITE_URL) {
  const origin = baseUrl.replace(/\/$/, "");
  return {
    notify: `${origin}/api/payments/redsys/notify`,
    /** URLOK / URLKO are per-transaction; shown for reference. */
    returnExample: `${origin}/es/pedido/<referencia>`,
    reachable: !/localhost|127\.0\.0\.1/.test(origin),
  };
}

/** Admin-facing view. Requires an admin session (RLS enforces it too). */
export const getPaymentSettingsView = cache(async (): Promise<PaymentSettingsView | null> => {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_settings")
    .select(SELECT)
    .eq("provider", PROVIDER)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as Row;

  const stored = row.secret_key_encrypted;
  const decrypted = open(stored);

  return {
    enabled: row.enabled,
    environment: row.environment === "live" ? "live" : "test",
    merchantCode: row.merchant_code ?? "",
    terminal: row.terminal,
    merchantName: row.merchant_name ?? "",
    currency: row.currency,
    maxAttempts: row.max_attempts,
    hasSecret: decrypted !== null,
    secretUnreadable: stored !== null && decrypted === null,
    canStoreSecrets: canStoreSecrets(),
    updatedAt: row.updated_at,
  };
});

/** True when a decryptable secret is already stored. */
async function hasStoredSecret(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payment_settings")
    .select("secret_key_encrypted")
    .eq("provider", PROVIDER)
    .maybeSingle();

  return open((data as { secret_key_encrypted: string | null } | null)?.secret_key_encrypted ?? null) !== null;
}

export type SaveSettingsInput = {
  enabled: boolean;
  environment: RedsysEnvironment;
  merchantCode: string;
  terminal: string;
  merchantName: string;
  currency: number;
  maxAttempts: number;
  /** Undefined leaves the stored secret untouched. */
  secretKey?: string;
};

export type SaveOutcome =
  | { ok: true }
  | {
      ok: false;
      error: "forbidden" | "no_encryption_key" | "bad_secret" | "incomplete" | string;
    };

export async function savePaymentSettings(input: SaveSettingsInput): Promise<SaveOutcome> {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return { ok: false, error: "forbidden" };

  const patch: Record<string, unknown> = {
    enabled: input.enabled,
    environment: input.environment,
    merchant_code: input.merchantCode || null,
    terminal: input.terminal || "1",
    merchant_name: input.merchantName || null,
    currency: input.currency,
    max_attempts: Math.min(5, Math.max(1, input.maxAttempts)),
    updated_by: viewer.id,
  };

  if (input.secretKey !== undefined) {
    if (!canStoreSecrets()) return { ok: false, error: "no_encryption_key" };

    // Reject a key that cannot possibly work before it is stored, so the admin
    // finds out here rather than at the first checkout.
    const decoded = Buffer.from(input.secretKey.trim(), "base64");
    if (decoded.length !== 24) return { ok: false, error: "bad_secret" };

    patch.secret_key_encrypted = seal(input.secretKey.trim());
  }

  // Saving a partially-filled configuration is fine — you might be waiting on
  // the bank — but switching it ON while it cannot sign would send shoppers to a
  // gateway that rejects them. Refuse that combination.
  if (input.enabled) {
    const willHaveSecret =
      input.secretKey !== undefined ? true : (await hasStoredSecret()) === true;

    if (!/^\d{9}$/.test(input.merchantCode) || !/^\d{1,3}$/.test(input.terminal) || !willHaveSecret) {
      return { ok: false, error: "incomplete" };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("payment_settings")
    .update(patch)
    .eq("provider", PROVIDER);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/* ------------------------------------------------------- checkout + callback */

/**
 * Credentials for signing, or null when the gateway is not ready.
 *
 * Used by the checkout path (with the shopper's own session — RLS lets an admin
 * read the row, and the anon role cannot, so this deliberately uses the elevated
 * client: a shopper must be able to pay without being able to read the merchant
 * configuration).
 */
export async function getRedsysCredentials(): Promise<RedsysCredentials | null> {
  const supabase = createElevatedClient();
  const { data, error } = await supabase
    .from("payment_settings")
    .select(SELECT)
    .eq("provider", PROVIDER)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as Row;

  if (!row.enabled || !row.merchant_code) return null;

  const secretKey = open(row.secret_key_encrypted);
  if (!secretKey) return null;

  return {
    merchantCode: row.merchant_code,
    terminal: row.terminal,
    secretKey,
    environment: row.environment === "live" ? "live" : "test",
    currency: row.currency,
  };
}

/** True when checkout can hand a shopper over to the bank. */
export async function isGatewayReady(): Promise<boolean> {
  return (await getRedsysCredentials()) !== null;
}
