#!/usr/bin/env node
/**
 * Uploads `infra/media/` into the `media` bucket and records the rows.
 *
 *   node scripts/import-media.mjs                 # local, keys from app/.env.local
 *   SUPABASE_URL=… SERVICE_ROLE_KEY=… node scripts/import-media.mjs
 *
 * This is the half of the catalogue that a migration cannot carry: SQL moves
 * text, and a product photo is eight hundred kilobytes of binary. The images
 * reach the server anyway — the deploy does `git pull`, and `infra/media/` is
 * committed — so all this has to do is move them the last few centimetres from
 * the filesystem into storage.
 *
 * Idempotent, because the deploy runs it every time: the object path is derived
 * from a hash of the file contents, so an unchanged image resolves to the path
 * it already occupies and the row upserts onto itself. Editing an image gives it
 * a new path and a new row; the superseded object is left in the bucket rather
 * than deleted, since something may still be linking to it.
 *
 * Runs with the service-role key, which bypasses RLS — it is a deploy-time tool
 * and must never be reachable from the browser.
 */

import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MEDIA = join(HERE, "..", "media", "products");

const MIME = {
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  avif: "image/avif",
};

/* ------------------------------------------------------------------ setup -- */

/** Falls back to the app's env file so a local run needs no arguments. */
function fromEnvFile(key) {
  try {
    const text = readFileSync(join(HERE, "..", "..", "app", ".env.local"), "utf8");
    return new RegExp(`^${key}=(.*)$`, "m").exec(text)?.[1]?.trim();
  } catch {
    return undefined;
  }
}

const URL_BASE = (
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  fromEnvFile("NEXT_PUBLIC_SUPABASE_URL")
)?.replace(/\/$/, "");

const KEY =
  process.env.SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  fromEnvFile("SUPABASE_SERVICE_ROLE_KEY");

if (!URL_BASE || !KEY) {
  console.error("Missing SUPABASE_URL / SERVICE_ROLE_KEY, and app/.env.local was no help.");
  process.exit(1);
}

const auth = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function rest(path, init = {}) {
  const response = await fetch(`${URL_BASE}${path}`, {
    ...init,
    headers: { ...auth, ...(init.headers ?? {}) },
  });
  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} → ${response.status} ${await response.text()}`);
  }
  return response;
}

/* -------------------------------------------------------------------- run -- */

let folders;
try {
  folders = readdirSync(MEDIA, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
} catch {
  console.error(`No media at ${MEDIA}. Run: node scripts/prepare-media.mjs --src <folder>`);
  process.exit(1);
}

let uploaded = 0;
let missing = 0;

for (const ref of folders) {
  const found = await rest(
    `/rest/v1/products?ref=eq.${encodeURIComponent(ref)}&select=id,name`,
  ).then((r) => r.json());

  const product = found[0];
  if (!product) {
    // The catalogue migration has not run, or the folder was renamed. Either way
    // uploading an orphan object helps nobody.
    console.error(`  ! no product with ref ${ref} — ${MEDIA}/${ref} skipped`);
    missing += 1;
    continue;
  }

  const files = readdirSync(join(MEDIA, ref))
    .filter((name) => MIME[name.split(".").pop().toLowerCase()])
    .sort();

  for (const filename of files) {
    // `01-negro.webp` → position 1, colourway "negro". The colourway is what ties
    // a photo to one colour of a garment, so picking a swatch swaps the image.
    const [stem, extension] = [filename.slice(0, filename.lastIndexOf(".")), filename.split(".").pop()];
    const [positionPart, colorway = null] = stem.split("-");
    const position = Number.parseInt(positionPart, 10) || 0;

    const bytes = readFileSync(join(MEDIA, ref, filename));
    const fingerprint = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
    const path = `products/${product.id}/${fingerprint}.${extension}`;

    await rest(`/storage/v1/object/media/${path}`, {
      method: "POST",
      headers: { "content-type": MIME[extension.toLowerCase()], "x-upsert": "true" },
      body: bytes,
    });

    await rest(`/rest/v1/product_images?on_conflict=product_id,storage_path`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        product_id: product.id,
        storage_path: path,
        // The product name is the honest alt text here: the artworks are
        // untitled and describing 115 of them from a script would be invention.
        alt: product.name,
        colorway_id: colorway,
        position,
      }),
    });

    uploaded += 1;
  }
}

console.log(`\n  ${uploaded} images in the media bucket`);
if (missing) console.log(`  ${missing} folders had no matching product`);
