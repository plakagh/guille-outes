import assert from "node:assert/strict";
import test from "node:test";
import {
  crossSell,
  parseFramePreview,
  parseProductVideo,
  parseVideoUrl,
  unitPriceFor,
  type Product,
} from "./catalog.ts";

/**
 * The product video is the one field where a shop types a raw address and the
 * storefront hands it to the browser. What matters is that only the three shapes
 * we know how to play get through, and that nothing else does — an unplayable src
 * would render a video zone that never starts, which is precisely what the field
 * is supposed to avoid.
 */

test("a YouTube video is recognised in every shape it is shared in", () => {
  const expected = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0";

  for (const url of [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/watch?v=dQw4w9WgXcQ&t=42",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  ]) {
    assert.deepEqual(parseVideoUrl(url), { provider: "youtube", src: expected, url }, url);
  }
});

test("Vimeo, from the page or from the player", () => {
  for (const url of ["https://vimeo.com/347119375", "https://player.vimeo.com/video/347119375"]) {
    assert.deepEqual(
      parseVideoUrl(url),
      { provider: "vimeo", src: "https://player.vimeo.com/video/347119375?dnt=1", url },
      url,
    );
  }
});

test("a self-hosted file is played as it is", () => {
  const url = "https://cdn.example.com/videos/taller.mp4";
  assert.deepEqual(parseVideoUrl(url), { provider: "file", src: url, url });
});

test("anything we cannot play is refused rather than stored", () => {
  for (const url of [
    "",
    "   ",
    "not a url",
    // http would break a page served over https.
    "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
    // Not a video address, just the platform.
    "https://www.youtube.com/",
    "https://vimeo.com/guilleoutes",
    // A page about a video is not a video.
    "https://example.com/nuestro-taller",
    // The whole point of the protocol check.
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
  ]) {
    assert.equal(parseVideoUrl(url), null, url);
  }
});

test("the caption is optional, and blank means none at all", () => {
  const url = "https://youtu.be/dQw4w9WgXcQ";

  assert.equal(parseProductVideo(url, "  ")?.caption, null);
  assert.equal(parseProductVideo(url, " Grabado en el taller ")?.caption, "Grabado en el taller");

  // No video, no zone — a caption on its own is not something to show.
  assert.equal(parseProductVideo(null, "Grabado en el taller"), null);
  assert.equal(parseProductVideo("", "Grabado en el taller"), null);
});

/* ============================================================= cross-sell */

/**
 * The basket shelf. What matters is not the exact ranking — that is a matter of
 * taste and will be tuned — but the two promises the shelf makes: it sends
 * people to a section they have not bought from, and it never offers them
 * something they cannot buy or already have.
 */

/** A catalogue row with only the fields `crossSell` reads filled in. */
function product(id: string, over: Partial<Product> = {}): Product {
  return {
    id,
    ref: id.toUpperCase(),
    slug: id,
    slugs: { es: id, gl: id, en: id },
    name: id,
    description: "",
    details: [],
    keywords: [],
    categoryId: "cuadros",
    collectionId: null,
    audience: "unisex",
    shape: "poster",
    print: "none",
    price: 4000,
    colorways: [],
    sizes: [],
    soldOutSizes: [],
    sizeGuide: null,
    framePreview: null,
    video: null,
    artworkPrintable: false,
    variants: [{ id: `${id}-v`, size: "Única", colorwayId: "negro", sku: null, stock: 3, priceDeltaCents: 0 }],
    images: [],
    credits: [],
    rating: 0,
    reviews: 0,
    bestseller: false,
    exclusive: false,
    published: true,
    arrived: 0,
    ...over,
  };
}

const slugsOf = (products: Product[]) => products.map((p) => p.slug);

test("a basket of cuadros is shown camisetas, and the other way round", () => {
  const cuadro = product("obra-107");
  const otherCuadro = product("obra-108");
  const tee = product("camiseta-a", { categoryId: "camisetas", price: 2500 });

  const catalog = [cuadro, otherCuadro, tee];

  assert.deepEqual(slugsOf(crossSell(catalog, [cuadro], 1)), ["camiseta-a"]);
  assert.deepEqual(slugsOf(crossSell(catalog, [tee], 1)), ["obra-107"]);
});

test("with several sections to offer, the shelf takes one from each in turn", () => {
  const catalog = [
    product("obra-107"),
    product("camiseta-a", { categoryId: "camisetas", bestseller: true }),
    product("camiseta-b", { categoryId: "camisetas", bestseller: true }),
    product("taza-a", { categoryId: "tazas" }),
  ];

  // Both camisetas outrank the taza, but four slots are not three of one thing.
  assert.deepEqual(slugsOf(crossSell(catalog, [catalog[0]], 3)), [
    "camiseta-a",
    "taza-a",
    "camiseta-b",
  ]);
});

test("more of the same section only once nothing else is left", () => {
  const cuadro = product("obra-107");
  const catalog = [cuadro, product("obra-108"), product("camiseta-a", { categoryId: "camisetas" })];

  assert.deepEqual(slugsOf(crossSell(catalog, [cuadro], 2)), ["camiseta-a", "obra-108"]);
});

test("nothing sold out, nothing already in the basket, nothing without a basket", () => {
  const cuadro = product("obra-107");
  const soldOut = product("camiseta-a", {
    categoryId: "camisetas",
    variants: [{ id: "v", size: "M", colorwayId: "negro", sku: null, stock: 0, priceDeltaCents: 0 }],
  });

  assert.deepEqual(crossSell([cuadro, soldOut], [cuadro], 3), []);
  assert.deepEqual(crossSell([cuadro], [], 3), []);
});

test("the same basket always produces the same shelf", () => {
  // Same score, same everything the ranking looks at: the tie is still broken
  // the same way twice, so the shelf does not rearrange itself under the cursor.
  const cuadro = product("obra-107");
  const catalog = [
    cuadro,
    product("camiseta-b", { categoryId: "camisetas" }),
    product("camiseta-a", { categoryId: "camisetas" }),
  ];

  assert.deepEqual(slugsOf(crossSell(catalog, [cuadro], 2)), ["camiseta-a", "camiseta-b"]);
  assert.deepEqual(
    slugsOf(crossSell([...catalog].reverse(), [cuadro], 2)),
    ["camiseta-a", "camiseta-b"],
  );
});

/* ================================================================= framing */

/**
 * A cuadro can be bought framed or not, and the difference is money. Three things
 * have to hold or somebody is charged wrongly: what the shop typed is what is
 * read back, a frame nobody chose costs nothing, and a finish this piece does not
 * sell is never billed for — the last one being what a stale tab or a crafted
 * request would ask for.
 */

test("a frame surcharge is read as stored, and nonsense means free", () => {
  const stored = (surcharge: unknown) =>
    parseFramePreview({ enabled: true, finishes: ["black"], mount: 10, surcharge });

  assert.equal(stored(1500)?.surcharge, 1500);
  // Absent is the shape every row written before framing was buyable has.
  assert.equal(parseFramePreview({ enabled: true, finishes: ["black"] })?.surcharge, 0);
  assert.equal(stored(-100)?.surcharge, 0);
  assert.equal(stored("mucho")?.surcharge, 0);
  assert.equal(stored(999_999)?.surcharge, 0);
});

test("the price of a unit is the format plus the frame that was chosen", () => {
  const cuadro = product("obra-1", {
    sizes: ["Pequeño", "Grande"],
    variants: [
      { id: "s", size: "Pequeño", colorwayId: "blanco", sku: null, stock: 3, priceDeltaCents: 0 },
      { id: "l", size: "Grande", colorwayId: "blanco", sku: null, stock: 3, priceDeltaCents: 2000 },
    ],
    framePreview: parseFramePreview({
      enabled: true,
      finishes: ["black", "wood"],
      mount: 10,
      surcharge: 1500,
    }),
  });

  assert.equal(unitPriceFor(cuadro, "Pequeño", "none"), 4000);
  assert.equal(unitPriceFor(cuadro, "Pequeño", "black"), 5500);
  // The variant's own surcharge and the frame's are both in there, once each.
  assert.equal(unitPriceFor(cuadro, "Grande", "wood"), 7500);
  // A finish this piece is not sold in is not a free frame: it is not a frame.
  assert.equal(unitPriceFor(cuadro, "Pequeño", "white"), 4000);
  // And a product with no framing has nothing to add whatever it is asked for.
  assert.equal(unitPriceFor(product("camiseta-a"), "Única", "black"), 4000);
});
