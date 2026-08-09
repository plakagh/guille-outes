#!/usr/bin/env node
/**
 * Converts the photographer's delivery into the web-ready media tree.
 *
 *   node scripts/prepare-media.mjs --src "/path/to/Guille Outes Web"
 *
 * The originals are 2–4 MB PNGs — too heavy for git and, in places, over the
 * bucket's 8 MB limit. They are resized to fit 1600 px and re-encoded as webp
 * into `infra/media/`, which *is* committed: the deploy pulls the repo onto the
 * VPS, so anything under `media/` travels to production for free.
 *
 * Layout produced, read back by `import-media.mjs`:
 *
 *   media/products/<ref>/<position>[-<colorway>].webp
 *
 * The position orders the gallery; the optional colourway suffix ties a photo to
 * one colour of the garment, so picking "Negro" swaps the image.
 *
 * Re-running is safe: output is overwritten, and unchanged bytes produce an
 * identical file.
 */

import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = dirname(fileURLToPath(import.meta.url));
const MEDIA = join(HERE, "..", "media", "products");

/** Longest side, in pixels. Enough for a full-bleed product page on a retina display. */
const MAX_EDGE = 1600;
const QUALITY = 82;

/* ==========================================================================
   The delivery
   ========================================================================== */

/**
 * One entry per source folder. This is deliberately declarative rather than
 * clever: the delivery is a one-off shape, and guessing at filenames is how you
 * end up with the wrong artwork on the wrong product.
 */
const SOURCES = [
  {
    folder: "cuadros",
    /**
     * `Guille Outes (37).png` → GO-C037. One artwork per file, one photo each.
     * The number is the artist's own ordering, so it is kept rather than
     * renumbered — it is the only handle anyone has on these files.
     */
    map(filename) {
      const match = /\((\d+)\)/.exec(filename);
      if (!match) return null;
      const n = Number(match[1]);
      return { ref: `GO-C${String(n).padStart(3, "0")}`, position: 1, colorway: null };
    },
  },
  {
    folder: "camisetas",
    /**
     * One artwork (the cow) photographed on four garment colours, so every file
     * is an image *of the same product* keyed by colourway.
     *
     * `paca_azul.png` is a typo for `vaca_azul` — same cow, same crop. Mapped
     * explicitly so a fixed filename later does not silently drop the image.
     */
    map(filename) {
      const colorways = {
        "paca_azul.png": "marino",
        "vaca_azul.png": "marino",
        "vaca_blanca.png": "blanco",
        "vaca_marron.png": "marron",
        "vaca_negra.png": "negro",
      };
      const colorway = colorways[filename];
      if (!colorway) return null;
      // Position follows the palette order used by the product record.
      const order = ["negro", "blanco", "marino", "marron"];
      return { ref: "GO-T001", position: order.indexOf(colorway) + 1, colorway };
    },
  },
];

/* ==========================================================================
   Run
   ========================================================================== */

const args = process.argv.slice(2);
const srcIndex = args.indexOf("--src");
const SRC = srcIndex >= 0 ? args[srcIndex + 1] : process.env.MEDIA_SOURCE;

if (!SRC) {
  console.error("Usage: node scripts/prepare-media.mjs --src <folder>");
  console.error("       (or set MEDIA_SOURCE)");
  process.exit(1);
}

// A clean rebuild, so a source file that disappears does not leave a stale webp
// behind that `import-media.mjs` would happily keep uploading.
rmSync(MEDIA, { recursive: true, force: true });
mkdirSync(MEDIA, { recursive: true });

let written = 0;
let bytes = 0;
let skipped = 0;

for (const source of SOURCES) {
  const dir = join(SRC, source.folder);

  let entries;
  try {
    entries = readdirSync(dir).filter((name) => /\.(png|jpe?g|webp|tiff?)$/i.test(name)).sort();
  } catch {
    console.error(`  ! ${source.folder}/ not found under ${SRC} — skipped`);
    continue;
  }

  for (const filename of entries) {
    const target = source.map(filename);
    if (!target) {
      console.error(`  ! ${source.folder}/${filename} — unrecognised name, skipped`);
      skipped += 1;
      continue;
    }

    const { ref, position, colorway } = target;
    const suffix = colorway ? `-${colorway}` : "";
    const out = join(MEDIA, ref, `${String(position).padStart(2, "0")}${suffix}.webp`);

    const buffer = await sharp(join(dir, filename))
      .rotate() // honour EXIF orientation before it is stripped
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toBuffer();

    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, buffer);

    written += 1;
    bytes += buffer.length;
  }
}

const mb = (bytes / 1024 / 1024).toFixed(1);
console.log(`\n  ${written} images → infra/media/products/  (${mb} MB)`);
if (skipped) console.log(`  ${skipped} skipped`);
