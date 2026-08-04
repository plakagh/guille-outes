import { createCipheriv, createHmac, timingSafeEqual } from "node:crypto";
import type { Locale } from "@/lib/i18n/config";

/**
 * Redsys "pago por redirección" protocol (HMAC-SHA256 v1).
 *
 * Mirrors the reference implementation the acquiring banks distribute
 * (`apiRedsys.php` / `RedsysAPI`), which works like this:
 *
 *   1. The merchant secret arrives base64-encoded and decodes to 24 bytes — a
 *      3DES key.
 *   2. That key is *diversified per order*: the order reference is encrypted
 *      with 3DES-CBC, a zero IV and zero padding. The result is the signing key
 *      for this one transaction.
 *   3. The request parameters are JSON, base64-encoded, and the signature is
 *      base64(HMAC-SHA256(thatBase64String, diversifiedKey)).
 *
 * Notifications come back the same way, except the bank uses URL-safe base64,
 * and the signature must be computed over the *raw string received* — not over a
 * re-encoded version of the parsed object.
 *
 * Pure functions only: no database, no configuration lookup, no I/O.
 */

export type RedsysEnvironment = "test" | "live";

export const REDSYS_ENDPOINTS: Record<RedsysEnvironment, string> = {
  test: "https://sis-t.redsys.es:25443/sis/realizarPago",
  live: "https://sis.redsys.es/sis/realizarPago",
};

/** Redsys `Ds_Merchant_ConsumerLanguage` codes. */
const LANGUAGE_CODES: Record<Locale, string> = {
  es: "001",
  en: "002",
  gl: "012",
};

export type RedsysCredentials = {
  merchantCode: string;
  terminal: string;
  /** Base64 as shown in the bank's admin panel. */
  secretKey: string;
  environment: RedsysEnvironment;
  currency: number;
};

export type RedsysOrderRequest = {
  orderRef: string;
  /** Integer minor units — cents for EUR. */
  amountCents: number;
  description?: string;
  cardHolder?: string;
  locale: Locale;
  /** Server-to-server callback. Must be publicly reachable. */
  notifyUrl: string;
  successUrl: string;
  failureUrl: string;
};

export type RedsysForm = {
  endpoint: string;
  fields: {
    Ds_SignatureVersion: "HMAC_SHA256_V1";
    Ds_MerchantParameters: string;
    Ds_Signature: string;
  };
};

/* ------------------------------------------------------------------ base64 */

const toUrlSafe = (value: string) => value.replace(/\+/g, "-").replace(/\//g, "_");
const fromUrlSafe = (value: string) => value.replace(/-/g, "+").replace(/_/g, "/");

/* -------------------------------------------------------------------- crypto */

/**
 * Derives this order's signing key: 3DES-CBC over the order reference with a
 * zero IV and zero padding. `setAutoPadding(false)` is required because Redsys
 * pads with NUL bytes, not PKCS#7.
 */
function diversifyKey(orderRef: string, secretKeyBase64: string): Buffer {
  const key = Buffer.from(secretKeyBase64, "base64");
  if (key.length !== 24) {
    throw new Error(
      `The Redsys secret must decode to 24 bytes for 3DES; got ${key.length}. ` +
        "Copy the key exactly as the bank shows it, without whitespace.",
    );
  }

  const blockCount = Math.ceil(orderRef.length / 8) || 1;
  const padded = Buffer.alloc(blockCount * 8, 0);
  padded.write(orderRef, "utf8");

  const cipher = createCipheriv("des-ede3-cbc", key, Buffer.alloc(8, 0));
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(padded), cipher.final()]).subarray(0, padded.length);
}

function sign(payloadBase64: string, orderRef: string, secretKeyBase64: string): string {
  const signingKey = diversifyKey(orderRef, secretKeyBase64);
  return createHmac("sha256", signingKey).update(payloadBase64, "utf8").digest("base64");
}

/* ------------------------------------------------------------------ request */

/** Builds the auto-submitting form the shopper's browser POSTs to the bank. */
export function buildRedsysForm(
  credentials: RedsysCredentials,
  order: RedsysOrderRequest,
): RedsysForm {
  if (!/^\d{9}$/.test(credentials.merchantCode)) {
    throw new Error("The Redsys merchant code (FUC) must be exactly 9 digits.");
  }
  if (!/^\d{1,3}$/.test(credentials.terminal)) {
    throw new Error("The Redsys terminal must be numeric, usually 1.");
  }
  if (!/^\d{4}[0-9a-zA-Z]{0,8}$/.test(order.orderRef)) {
    throw new Error(
      "The order reference must be 4–12 characters and start with four digits.",
    );
  }
  if (!Number.isInteger(order.amountCents) || order.amountCents <= 0) {
    throw new Error("The amount must be a positive integer number of cents.");
  }

  const parameters: Record<string, string> = {
    DS_MERCHANT_AMOUNT: String(order.amountCents),
    DS_MERCHANT_ORDER: order.orderRef,
    DS_MERCHANT_MERCHANTCODE: credentials.merchantCode,
    DS_MERCHANT_CURRENCY: String(credentials.currency),
    // 0 = authorisation (charge now).
    DS_MERCHANT_TRANSACTIONTYPE: "0",
    DS_MERCHANT_TERMINAL: credentials.terminal,
    DS_MERCHANT_MERCHANTURL: order.notifyUrl,
    DS_MERCHANT_URLOK: order.successUrl,
    DS_MERCHANT_URLKO: order.failureUrl,
    DS_MERCHANT_CONSUMERLANGUAGE: LANGUAGE_CODES[order.locale],
  };

  // Redsys truncates these silently; trim them here so the hosted page reads well.
  if (order.description) {
    parameters.DS_MERCHANT_PRODUCTDESCRIPTION = order.description.slice(0, 125);
  }
  if (order.cardHolder) {
    parameters.DS_MERCHANT_TITULAR = order.cardHolder.slice(0, 60);
  }

  const payload = Buffer.from(JSON.stringify(parameters), "utf8").toString("base64");

  return {
    endpoint: REDSYS_ENDPOINTS[credentials.environment],
    fields: {
      Ds_SignatureVersion: "HMAC_SHA256_V1",
      Ds_MerchantParameters: payload,
      Ds_Signature: sign(payload, order.orderRef, credentials.secretKey),
    },
  };
}

/* ------------------------------------------------------------- notification */

export type RedsysNotification = {
  orderRef: string;
  responseCode: string;
  authorisationCode: string | null;
  amountCents: number | null;
  currency: number | null;
  merchantCode: string | null;
  terminal: string | null;
  /** Every field the bank sent, for the audit trail. */
  raw: Record<string, unknown>;
};

export type VerifyResult =
  | { ok: true; notification: RedsysNotification }
  | { ok: false; reason: string; notification?: RedsysNotification };

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Verifies a gateway callback and decodes it.
 *
 * The signature is computed over the raw `Ds_MerchantParameters` string exactly
 * as received — re-encoding the parsed JSON would change byte-for-byte output
 * and never match. Both URL-safe and standard base64 are accepted because
 * different Redsys deployments differ here.
 */
export function verifyRedsysNotification(
  body: { Ds_MerchantParameters?: string; Ds_Signature?: string; Ds_SignatureVersion?: string },
  secretKeyBase64: string,
): VerifyResult {
  const payload = body.Ds_MerchantParameters;
  const received = body.Ds_Signature;

  if (!payload || !received) {
    return { ok: false, reason: "missing Ds_MerchantParameters or Ds_Signature" };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(Buffer.from(fromUrlSafe(payload), "base64").toString("utf8"));
  } catch {
    return { ok: false, reason: "Ds_MerchantParameters is not valid base64 JSON" };
  }

  const field = (key: string): string | null => {
    const value = parsed[key];
    return typeof value === "string" ? value : typeof value === "number" ? String(value) : null;
  };

  const orderRef = field("Ds_Order");
  if (!orderRef) return { ok: false, reason: "notification has no Ds_Order" };

  let expected: string;
  try {
    expected = sign(payload, orderRef, secretKeyBase64);
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "signing failed" };
  }

  const matches =
    safeEqual(received, expected) || safeEqual(received, toUrlSafe(expected));

  const amount = field("Ds_Amount");
  const currency = field("Ds_Currency");

  const notification: RedsysNotification = {
    orderRef,
    responseCode: field("Ds_Response") ?? "",
    authorisationCode: field("Ds_AuthorisationCode"),
    amountCents: amount !== null ? Number.parseInt(amount, 10) : null,
    currency: currency !== null ? Number.parseInt(currency, 10) : null,
    merchantCode: field("Ds_MerchantCode"),
    terminal: field("Ds_Terminal"),
    raw: parsed,
  };

  if (!matches) return { ok: false, reason: "signature mismatch", notification };
  return { ok: true, notification };
}

/* --------------------------------------------------------------- responses */

export type PaymentOutcome = "paid" | "cancelled" | "failed";

/**
 * Maps `Ds_Response` to an order status.
 *
 * 0000–0099 authorise the charge; 0900 is a completed refund; 9915 is the
 * shopper pressing cancel on the bank's page. Everything else is a decline.
 */
export function classifyResponse(code: string): PaymentOutcome {
  const numeric = Number.parseInt(code, 10);
  if (!Number.isFinite(numeric)) return "failed";
  if (numeric >= 0 && numeric <= 99) return "paid";
  if (numeric === 900) return "paid";
  if (numeric === 9915 || numeric === 915) return "cancelled";
  return "failed";
}

/** True when the shopper still has something to fix (wrong CVV, expired card…). */
export function isRetryable(code: string): boolean {
  const numeric = Number.parseInt(code, 10);
  return [101, 102, 129, 180, 184, 190, 191, 202, 904, 909, 912, 9912].includes(numeric);
}
