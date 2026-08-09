#!/usr/bin/env node
/**
 * Generates the catalogue migration from the content below.
 *
 *   node scripts/generate-catalog.mjs
 *
 * This replaces the old `generate-seed.mjs`, and the change of target is the
 * whole point: `seed.sql` is only ever loaded locally, while the deploy runs
 * `supabase db push` — so real catalogue data has to be a migration or it never
 * reaches the shop.
 *
 * It is an *initial load*, not the editing mechanism. A migration runs once per
 * database; day-to-day changes (a price, a new artwork, stock) go through the
 * admin panel. Regenerating this file after launch would rewrite history, so if
 * you need a bulk change later, add a new migration instead.
 *
 * The product list is derived from `infra/media/products/`, which is built by
 * `prepare-media.mjs`. One folder there is one product, so the images and the
 * rows cannot drift apart.
 */

import { createHash } from "node:crypto";
import { readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// Only to read the images' dimensions: the frame a cuadro is previewed in has to
// hang the way the artwork does. Already a dependency, for `prepare-media.mjs`.
import sharp from "sharp";

const HERE = dirname(fileURLToPath(import.meta.url));
const MEDIA = join(HERE, "..", "media", "products");
const OUT = join(HERE, "..", "supabase", "migrations", "20260808100100_catalog_content.sql");

/** Stable uuid v5-style id from a namespace + key, so re-running keeps ids. */
function uuid(namespace, key) {
  const hex = createHash("sha1").update(`${namespace}:${key}`).digest("hex");
  const bytes = hex.slice(0, 32).split("");
  bytes[12] = "5";
  bytes[16] = "8";
  const s = bytes.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

/** Deterministic opening stock, so a reset does not shuffle the shop. */
function stockFor(sku) {
  const n = Number.parseInt(createHash("sha1").update(sku).digest("hex").slice(0, 6), 16);
  return 3 + (n % 34);
}

const q = (value) =>
  value === null || value === undefined ? "null" : `'${String(value).replace(/'/g, "''")}'`;

const j = (value) =>
  value === null || value === undefined ? "null" : `${q(JSON.stringify(value))}::jsonb`;

/* ==========================================================================
   Categories

   Only the two the shop actually sells. The sample categories the development
   seed carried (sudaderas, gorras, …) are removed by the migration: an empty
   category is a dead end for a shopper and a thin page for a crawler.
   ========================================================================== */

const categories = [
  {
    id: "cuadros",
    slug: { es: "cuadros", gl: "cadros", en: "framed-prints" },
    name: { es: "Cuadros", gl: "Cadros", en: "Framed prints" },
    heading: {
      es: "Cuadros y láminas",
      gl: "Cadros e láminas",
      en: "Framed prints and artwork",
    },
    blurb: {
      es: "Obra de Guille Outes impresa sobre papel, lista para colgar. Puedes verla enmarcada antes de decidir: marco negro, blanco o madera, siempre con paspartú blanco.",
      gl: "Obra de Guille Outes impresa sobre papel, lista para colgar. Podes vela enmarcada antes de decidir: marco negro, branco ou madeira, sempre con paspartú branco.",
      en: "Work by Guille Outes printed on paper, ready to hang. See it framed before you decide: black, white or wood, always with a white mount.",
    },
    keywords: {
      es: ["cuadros", "láminas", "arte", "obra gráfica", "decoración", "marco", "paspartú"],
      gl: ["cadros", "láminas", "arte", "obra gráfica", "decoración", "marco", "paspartú"],
      en: ["framed prints", "art prints", "wall art", "artwork", "frame", "mount"],
    },
    details: {
      es: [
        "Impresión sobre papel de algodón",
        "Paspartú blanco incluido",
        "Marco a elegir: negro, blanco o madera",
        "Listo para colgar",
      ],
      gl: [
        "Impresión sobre papel de algodón",
        "Paspartú branco incluído",
        "Marco a elixir: negro, branco ou madeira",
        "Listo para colgar",
      ],
      en: [
        "Printed on cotton paper",
        "White mount included",
        "Choice of frame: black, white or wood",
        "Ready to hang",
      ],
    },
  },
  {
    id: "camisetas",
    slug: { es: "camisetas", gl: "camisetas", en: "t-shirts" },
    name: { es: "Camisetas", gl: "Camisetas", en: "T-shirts" },
    heading: { es: "Camisetas", gl: "Camisetas", en: "T-shirts" },
    blurb: {
      es: "Obra de Guille Outes estampada sobre algodón. Corte unisex.",
      gl: "Obra de Guille Outes estampada sobre algodón. Corte unisex.",
      en: "Work by Guille Outes printed on cotton. Unisex fit.",
    },
    keywords: {
      es: ["camiseta de arte", "camiseta ilustrada", "camiseta algodón"],
      gl: ["camiseta de arte", "camiseta ilustrada", "camiseta algodón"],
      en: ["art t-shirt", "illustrated tee", "cotton tee"],
    },
    details: {
      es: ["100 % algodón", "Corte unisex", "Lavar del revés a 30 °C"],
      gl: ["100 % algodón", "Corte unisex", "Lavar do revés a 30 °C"],
      en: ["100% cotton", "Unisex fit", "Wash inside out at 30 °C"],
    },
  },
];

/* ==========================================================================
   Products
   ========================================================================== */

/** Cuadros: 40 € small, 80 € large, as two sizes of one listing. */
const SMALL = "Pequeño";
const LARGE = "Grande";

const CUADRO_PRICE = 4000;
const CUADRO_LARGE_DELTA = 4000;

/**
 * What each format is printed at, in centimetres — the two standard European
 * paper sizes, turned to match the artwork itself.
 *
 * Not decoration: the framed preview draws the frame at these proportions and the
 * camera view ("en tu pared") scales the piece on the shopper's wall by these very
 * numbers. A vertical frame around a horizontal painting is as wrong as a 50 × 70
 * shown where a 30 × 40 was bought, so the orientation is read off the image rather
 * than assumed — two thirds of these artworks are landscape.
 *
 * The centimetres are still a default. What a piece really measures is per artwork
 * and is corrected from the admin panel, which is also the only place that can know
 * about a piece printed at anything other than a standard size.
 */
function cuadroSizes(orientation) {
  const turn = (width, height) =>
    orientation === "landscape" ? { width: height, height: width } : { width, height };

  return { [SMALL]: turn(30, 40), [LARGE]: turn(50, 70) };
}

/**
 * Which way up an artwork is, read off the image `prepare-media.mjs` produced.
 *
 * The delivery says nothing about orientation, and the alternative — a list of 115
 * refs maintained by hand — would be wrong the first time an artwork was replaced
 * by a different scan. A square scan counts as portrait, which is what the
 * storefront does with equal sides.
 */
async function artworkOrientation(ref) {
  const folder = join(MEDIA, ref);
  const first = readdirSync(folder)
    .filter((name) => /\.(webp|avif|png|jpe?g)$/i.test(name))
    .sort()[0];

  if (!first) return "portrait";

  const { width, height } = await sharp(join(folder, first)).metadata();
  return width && height && width > height ? "landscape" : "portrait";
}

/**
 * The artworks have no titles anywhere in the delivery — the files are called
 * `Guille Outes (37).png`. They are numbered for now and meant to be retitled in
 * the admin panel; the number is the artist's own, so it stays as the handle.
 */
function cuadro(ref, orientation) {
  const n = Number(ref.slice(4));
  const sizes = cuadroSizes(orientation);
  return {
    ref,
    slug: { es: `obra-${n}`, gl: `obra-${n}`, en: `artwork-${n}` },
    name: { es: `Obra Nº ${n}`, gl: `Obra Nº ${n}`, en: `Artwork No. ${n}` },
    description: {
      es: "Obra original de Guille Outes, impresa sobre papel de algodón y lista para enmarcar. Puedes previsualizarla con marco negro, blanco o de madera antes de elegir.",
      gl: "Obra orixinal de Guille Outes, impresa sobre papel de algodón e lista para enmarcar. Podes previsualizala con marco negro, branco ou de madeira antes de elixir.",
      en: "Original work by Guille Outes, printed on cotton paper and ready to frame. Preview it with a black, white or wood frame before you choose.",
    },
    keywords: {
      es: ["cuadro", "lámina", "arte", "Guille Outes", `obra ${n}`],
      gl: ["cadro", "lámina", "arte", "Guille Outes", `obra ${n}`],
      en: ["framed print", "art print", "wall art", "Guille Outes", `artwork ${n}`],
    },
    category: "cuadros",
    shape: "poster",
    print: "none",
    printable: false,
    price: CUADRO_PRICE,
    // A cuadro has no colourway to choose; the frame finish is the real choice
    // and lives in `frame` below. One neutral entry keeps the stock rows honest.
    colors: ["blanco"],
    sizes: [SMALL, LARGE],
    priceDelta: { [SMALL]: 0, [LARGE]: CUADRO_LARGE_DELTA },
    frame: {
      finishes: ["black", "white", "wood"],
      mount: 10,
      sizes,
      // The fallback pair, used before a size is chosen: the smaller format, which
      // is what a listing card shows.
      ...sizes[SMALL],
    },
    // Sort weight for "novedades": lower numbers are older, so the artist's own
    // numbering reads newest-first without inventing dates.
    arrived: n,
  };
}

const camiseta = {
  ref: "GO-T001",
  slug: { es: "camiseta-vaca", gl: "camiseta-vaca", en: "cow-t-shirt" },
  name: { es: "Camiseta Vaca", gl: "Camiseta Vaca", en: "Cow T-shirt" },
  description: {
    es: "La vaca de Guille Outes, estampada a todo color sobre el pecho. Corte unisex, disponible en cuatro colores.",
    gl: "A vaca de Guille Outes, estampada a toda cor sobre o peito. Corte unisex, dispoñible en catro cores.",
    en: "Guille Outes's cow, printed in full colour across the chest. Unisex fit, available in four colours.",
  },
  keywords: {
    es: ["camiseta vaca", "camiseta de arte", "camiseta ilustrada", "Guille Outes"],
    gl: ["camiseta vaca", "camiseta de arte", "camiseta ilustrada", "Guille Outes"],
    en: ["cow t-shirt", "art t-shirt", "illustrated tee", "Guille Outes"],
  },
  category: "camisetas",
  shape: "tee",
  print: "none",
  printable: true,
  price: 5000,
  // Order matches the image filenames produced by `prepare-media.mjs`.
  colors: ["negro", "blanco", "marino", "marron"],
  sizes: ["S", "M", "L", "XL"],
  arrived: 200,
  bestseller: true,
};

/**
 * The catalogue is whatever `prepare-media.mjs` produced, so a product can never
 * be listed without its artwork.
 */
const refs = readdirSync(MEDIA, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));

const products = await Promise.all(
  refs.map(async (ref) => {
    if (ref === camiseta.ref) return camiseta;
    if (/^GO-C\d{3}$/.test(ref)) return cuadro(ref, await artworkOrientation(ref));
    throw new Error(`No content defined for media folder ${ref}`);
  }),
);

/* ==========================================================================
   Emit
   ========================================================================== */

const lines = [];
const say = (line = "") => lines.push(line);

say("-- ============================================================================");
say("-- GENERATED FILE — do not edit by hand.");
say("-- Regenerate with:  node scripts/generate-catalog.mjs");
say("--");
say("-- The initial Guille Outes catalogue (es / gl / en): the framed prints and");
say("-- the t-shirt. Images are not here — they live in the `media` bucket and are");
say("-- uploaded by `import-media.mjs`, which the deploy runs after this migration.");
say("--");
say("-- After launch, edit the catalogue through the admin panel. Regenerating this");
say("-- file changes a migration that has already run and will not be re-applied.");
say("-- ============================================================================");
say();
say("begin;");
say();

say("-- ------------------------------------------------------------ sample data --");
say("--");
say("-- The development seed shipped 33 placeholder products (GO-001…), five sample");
say("-- collections and five invented authors. They are removed here, by reference");
say("-- rather than by `truncate`: truncating `products` cascades along the foreign");
say("-- key from `order_items` and would take the order history with it.");
say("delete from public.product_authors where product_id in (select id from public.products where ref like 'GO-0%');");
say("delete from public.products where ref like 'GO-0%';");
say("delete from public.author_works;");
say("delete from public.authors;");
say("delete from public.collections;");
say(
  `delete from public.categories where id not in (${categories.map((c) => q(c.id)).join(", ")});`,
);
say();

say("-- ------------------------------------------------------------- categories --");
categories.forEach((c, i) => {
  say(
    // `details` is not a column: it is the per-category fallback for a product's
    // spec list, applied above when the product does not override it.
    `insert into public.categories (id, slug, name, heading, blurb, keywords, position) values (${q(c.id)}, ${j(c.slug)}, ${j(c.name)}, ${j(c.heading)}, ${j(c.blurb)}, ${j(c.keywords)}, ${i})\n  on conflict (id) do update set slug = excluded.slug, name = excluded.name, heading = excluded.heading, blurb = excluded.blurb, keywords = excluded.keywords, position = excluded.position;`,
  );
});
say();

say("-- ---------------------------------------------------------------- products --");
const categoryById = new Map(categories.map((c) => [c.id, c]));

for (const p of products) {
  const id = uuid("product", p.ref);
  const category = categoryById.get(p.category);
  if (!category) throw new Error(`Unknown category ${p.category} on ${p.ref}`);

  const details = p.details ?? category.details;
  const audience = p.audience ?? "unisex";

  say(`-- ${p.ref} · ${p.name.es}`);
  say(
    `insert into public.products (id, ref, slug, name, description, details, keywords, category_id, collection_id, audience, shape, print, frame_preview, artwork_printable, price_cents, colorways, rating, reviews, bestseller, exclusive, arrived) values (` +
      [
        q(id),
        q(p.ref),
        j(p.slug),
        j(p.name),
        j(p.description),
        j(details),
        j(p.keywords),
        q(p.category),
        "null",
        `${q(audience)}::public.audience`,
        `${q(p.shape)}::public.art_shape`,
        `${q(p.print ?? "none")}::public.art_print`,
        j(p.frame ? { enabled: true, ...p.frame } : {}),
        p.printable ? "true" : "false",
        p.price,
        j(p.colors),
        // No reviews yet. An invented rating is a lie to the shopper and, on a
        // shop that emits Product structured data, to Google as well.
        0,
        0,
        p.bestseller ? "true" : "false",
        p.exclusive ? "true" : "false",
        p.arrived,
      ].join(", ") +
      `)\n  on conflict (ref) do update set slug = excluded.slug, name = excluded.name, description = excluded.description, details = excluded.details, keywords = excluded.keywords, category_id = excluded.category_id, shape = excluded.shape, print = excluded.print, frame_preview = excluded.frame_preview, artwork_printable = excluded.artwork_printable, price_cents = excluded.price_cents, colorways = excluded.colorways, arrived = excluded.arrived;`,
  );

  // One stock row per size × colourway.
  let position = 0;
  for (const color of p.colors) {
    for (const size of p.sizes) {
      const sku = `${p.ref}-${color}-${size}`
        .toUpperCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^A-Z0-9-]/g, "");
      const delta = p.priceDelta?.[size] ?? 0;
      say(
        `insert into public.product_variants (id, product_id, size, colorway_id, sku, stock, price_delta_cents, position) values (${q(uuid("variant", sku))}, ${q(id)}, ${q(size)}, ${q(color)}, ${q(sku)}, ${stockFor(sku)}, ${delta}, ${position})\n  on conflict (product_id, size, colorway_id) do update set sku = excluded.sku, price_delta_cents = excluded.price_delta_cents, position = excluded.position;`,
      );
      position += 1;
    }
  }
  say();
}

say("commit;");
say();

writeFileSync(OUT, lines.join("\n"), "utf8");

const variantCount = products.reduce((n, p) => n + p.colors.length * p.sizes.length, 0);

console.log(
  `Wrote ${OUT}\n  ${categories.length} categories, ${products.length} products, ${variantCount} variants`,
);
