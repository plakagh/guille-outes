import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  buildRedsysForm,
  classifyResponse,
  isRetryable,
  REDSYS_ENDPOINTS,
  verifyRedsysNotification,
  type RedsysCredentials,
} from "./redsys.ts";

/**
 * Run with:  pnpm test
 *
 * The interesting part of Redsys is the per-order key diversification (3DES-CBC,
 * zero IV, NUL padding). We cannot test against a real terminal without bank
 * credentials, so the key steps are cross-checked against OpenSSL — an
 * independent implementation — rather than only against themselves.
 */

// The key Redsys publishes for its own test terminal. It is already base64 and
// decodes to exactly the 24 bytes 3DES needs.
const SECRET = "sq7HjrUOBfKmC576ILgskD5srU870gJ7";

const CREDENTIALS: RedsysCredentials = {
  merchantCode: "999008881",
  terminal: "1",
  secretKey: SECRET,
  environment: "test",
  currency: 978,
};

const ORDER = {
  orderRef: "000000100001",
  amountCents: 3495,
  description: "Guille Outes",
  locale: "es" as const,
  notifyUrl: "https://example.com/api/payments/redsys/notify",
  successUrl: "https://example.com/es/pedido/000000100001",
  failureUrl: "https://example.com/es/pedido/000000100001?fallo=1",
};

/** The 3DES step, done by OpenSSL instead of Node. */
function diversifyWithOpenssl(orderRef: string, secretBase64: string): Buffer {
  const key = Buffer.from(secretBase64, "base64");
  const blocks = Math.ceil(orderRef.length / 8) || 1;
  const padded = Buffer.alloc(blocks * 8, 0);
  padded.write(orderRef, "utf8");

  const out = execFileSync(
    "openssl",
    [
      "enc",
      "-des-ede3-cbc",
      "-K",
      key.toString("hex"),
      "-iv",
      "0000000000000000",
      "-nopad",
    ],
    { input: padded, maxBuffer: 1024 },
  );

  return out.subarray(0, padded.length);
}

test("key diversification matches OpenSSL", () => {
  // Reproduce what the module does internally by signing a known payload and
  // comparing against a signature built on the OpenSSL-derived key.
  const form = buildRedsysForm(CREDENTIALS, ORDER);
  const payload = form.fields.Ds_MerchantParameters;

  const opensslKey = diversifyWithOpenssl(ORDER.orderRef, SECRET);
  const expected = createHmac("sha256", opensslKey).update(payload, "utf8").digest("base64");

  assert.equal(form.fields.Ds_Signature, expected);
});

test("HMAC step matches the OpenSSL CLI", () => {
  const form = buildRedsysForm(CREDENTIALS, ORDER);
  const key = diversifyWithOpenssl(ORDER.orderRef, SECRET);

  const cli = execFileSync(
    "openssl",
    ["dgst", "-sha256", "-mac", "HMAC", "-macopt", `hexkey:${key.toString("hex")}`, "-binary"],
    { input: form.fields.Ds_MerchantParameters, maxBuffer: 1024 },
  );

  assert.equal(form.fields.Ds_Signature, cli.toString("base64"));
});

test("request carries the fields Redsys requires", () => {
  const form = buildRedsysForm(CREDENTIALS, ORDER);
  assert.equal(form.endpoint, REDSYS_ENDPOINTS.test);
  assert.equal(form.fields.Ds_SignatureVersion, "HMAC_SHA256_V1");

  const params = JSON.parse(
    Buffer.from(form.fields.Ds_MerchantParameters, "base64").toString("utf8"),
  );

  assert.equal(params.DS_MERCHANT_AMOUNT, "3495", "amount is minor units, no separators");
  assert.equal(params.DS_MERCHANT_ORDER, ORDER.orderRef);
  assert.equal(params.DS_MERCHANT_MERCHANTCODE, "999008881");
  assert.equal(params.DS_MERCHANT_CURRENCY, "978");
  assert.equal(params.DS_MERCHANT_TRANSACTIONTYPE, "0");
  assert.equal(params.DS_MERCHANT_CONSUMERLANGUAGE, "001");
  assert.equal(params.DS_MERCHANT_MERCHANTURL, ORDER.notifyUrl);
});

test("consumer language follows the locale, including Galician", () => {
  const read = (locale: "es" | "gl" | "en") =>
    JSON.parse(
      Buffer.from(
        buildRedsysForm(CREDENTIALS, { ...ORDER, locale }).fields.Ds_MerchantParameters,
        "base64",
      ).toString("utf8"),
    ).DS_MERCHANT_CONSUMERLANGUAGE;

  assert.equal(read("es"), "001");
  assert.equal(read("en"), "002");
  assert.equal(read("gl"), "012");
});

test("live and test environments hit different hosts", () => {
  assert.match(REDSYS_ENDPOINTS.test, /sis-t\.redsys\.es/);
  assert.match(REDSYS_ENDPOINTS.live, /^https:\/\/sis\.redsys\.es/);
  assert.notEqual(REDSYS_ENDPOINTS.test, REDSYS_ENDPOINTS.live);
});

/* ---------------------------------------------------------- notifications */

/** Builds a callback the way the bank would, so verification can be exercised. */
function fakeNotification(
  fields: Record<string, string>,
  { urlSafe = false, secret = SECRET } = {},
) {
  const json = JSON.stringify(fields);
  const standard = Buffer.from(json, "utf8").toString("base64");
  const payload = urlSafe ? standard.replace(/\+/g, "-").replace(/\//g, "_") : standard;

  const key = diversifyWithOpenssl(fields.Ds_Order, secret);
  const raw = createHmac("sha256", key).update(payload, "utf8").digest("base64");

  return {
    Ds_SignatureVersion: "HMAC_SHA256_V1",
    Ds_MerchantParameters: payload,
    Ds_Signature: urlSafe ? raw.replace(/\+/g, "-").replace(/\//g, "_") : raw,
  };
}

const APPROVED = {
  Ds_Date: "04/08/2026",
  Ds_Hour: "12:30",
  Ds_Amount: "3495",
  Ds_Currency: "978",
  Ds_Order: "000000100001",
  Ds_MerchantCode: "999008881",
  Ds_Terminal: "001",
  Ds_Response: "0000",
  Ds_AuthorisationCode: "123456",
  Ds_TransactionType: "0",
  Ds_SecurePayment: "1",
};

test("accepts a correctly signed notification", () => {
  const result = verifyRedsysNotification(fakeNotification(APPROVED), SECRET);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.notification.orderRef, "000000100001");
  assert.equal(result.notification.responseCode, "0000");
  assert.equal(result.notification.authorisationCode, "123456");
  assert.equal(result.notification.amountCents, 3495);
  assert.equal(result.notification.currency, 978);
});

test("accepts URL-safe base64, which some deployments send", () => {
  const result = verifyRedsysNotification(fakeNotification(APPROVED, { urlSafe: true }), SECRET);
  assert.equal(result.ok, true);
});

test("rejects a tampered amount", () => {
  // Sign the real amount, then swap in a bigger one: the signature no longer fits.
  const honest = fakeNotification(APPROVED);
  const forged = JSON.stringify({ ...APPROVED, Ds_Amount: "1" });

  const result = verifyRedsysNotification(
    {
      ...honest,
      Ds_MerchantParameters: Buffer.from(forged, "utf8").toString("base64"),
    },
    SECRET,
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "signature mismatch");
});

test("rejects a notification signed with another merchant's key", () => {
  const otherSecret = Buffer.alloc(24, 7).toString("base64");
  const result = verifyRedsysNotification(
    fakeNotification(APPROVED, { secret: otherSecret }),
    SECRET,
  );
  assert.equal(result.ok, false);
});

test("rejects missing or malformed payloads", () => {
  assert.equal(verifyRedsysNotification({}, SECRET).ok, false);
  assert.equal(
    verifyRedsysNotification(
      { Ds_MerchantParameters: "not base64 json", Ds_Signature: "x" },
      SECRET,
    ).ok,
    false,
  );
  // Valid JSON but no order reference: nothing to derive a key from.
  assert.equal(
    verifyRedsysNotification(
      {
        Ds_MerchantParameters: Buffer.from('{"Ds_Response":"0000"}').toString("base64"),
        Ds_Signature: "x",
      },
      SECRET,
    ).ok,
    false,
  );
});

/* -------------------------------------------------------------- validation */

test("the published test key decodes to a 24-byte 3DES key", () => {
  assert.equal(Buffer.from(SECRET, "base64").length, 24);
});

test("refuses to build a request with invalid credentials", () => {
  assert.throws(
    () => buildRedsysForm({ ...CREDENTIALS, merchantCode: "123" }, ORDER),
    /9 digits/,
  );
  assert.throws(
    () => buildRedsysForm({ ...CREDENTIALS, secretKey: "c2hvcnQ=" }, ORDER),
    /24 bytes/,
  );
  assert.throws(
    () => buildRedsysForm(CREDENTIALS, { ...ORDER, orderRef: "abc" }),
    /4–12 characters/,
  );
  assert.throws(() => buildRedsysForm(CREDENTIALS, { ...ORDER, amountCents: 0 }), /positive/);
});

/* ----------------------------------------------------------- response codes */

test("classifies gateway response codes", () => {
  for (const code of ["0000", "0001", "0099", "000", "0900"]) {
    assert.equal(classifyResponse(code), "paid", code);
  }
  assert.equal(classifyResponse("9915"), "cancelled");
  for (const code of ["0101", "0190", "9104", "0913"]) {
    assert.equal(classifyResponse(code), "failed", code);
  }
  assert.equal(classifyResponse("nonsense"), "failed");
});

test("flags the declines worth asking the shopper to retry", () => {
  assert.equal(isRetryable("0129"), true, "wrong CVV");
  assert.equal(isRetryable("0101"), true, "expired card");
  assert.equal(isRetryable("9104"), false);
});
