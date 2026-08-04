import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Envelope encryption for gateway credentials.
 *
 * The Redsys merchant secret lets whoever holds it forge payment notifications,
 * so it must not sit in the database as plaintext: `infra/scripts/backup.sh`
 * ships a nightly `pg_dump` to object storage, and a database dump is a much
 * easier thing to leak than a running server's environment.
 *
 * So the database stores AES-256-GCM ciphertext and the key lives only in
 * `PAYMENTS_ENCRYPTION_KEY`. Losing that variable means re-entering the merchant
 * secret in the admin panel — recoverable. Leaking the database alone gives an
 * attacker nothing usable.
 *
 * GCM (not CBC) because it authenticates: a tampered blob fails to decrypt
 * rather than silently producing garbage.
 */

const ENV_VAR = "PAYMENTS_ENCRYPTION_KEY";
const IV_BYTES = 12;
const TAG_BYTES = 16;

export class MissingEncryptionKeyError extends Error {
  constructor() {
    super(
      `${ENV_VAR} is not set, so payment credentials cannot be stored. ` +
        `Generate one with:  openssl rand -base64 32`,
    );
    this.name = "MissingEncryptionKeyError";
  }
}

/** True when the server is configured to store gateway credentials at all. */
export function canStoreSecrets(): boolean {
  return readKey() !== null;
}

function readKey(): Buffer | null {
  const raw = process.env[ENV_VAR];
  if (!raw) return null;

  const key = Buffer.from(raw.trim(), "base64");
  // A 32-byte key is required for AES-256; anything else is a configuration
  // mistake and must not silently degrade to a weaker cipher.
  return key.length === 32 ? key : null;
}

function requireKey(): Buffer {
  const key = readKey();
  if (!key) throw new MissingEncryptionKeyError();
  return key;
}

/** Returns base64(iv || authTag || ciphertext). */
export function seal(plaintext: string): string {
  const key = requireKey();
  const iv = randomBytes(IV_BYTES);

  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

/** Returns null when the blob is absent, truncated, or fails authentication. */
export function open(sealed: string | null): string | null {
  if (!sealed) return null;

  const key = readKey();
  if (!key) return null;

  const buffer = Buffer.from(sealed, "base64");
  if (buffer.length <= IV_BYTES + TAG_BYTES) return null;

  const iv = buffer.subarray(0, IV_BYTES);
  const tag = buffer.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = buffer.subarray(IV_BYTES + TAG_BYTES);

  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    // Wrong key or tampered blob. Never fall back to returning the raw bytes.
    return null;
  }
}
