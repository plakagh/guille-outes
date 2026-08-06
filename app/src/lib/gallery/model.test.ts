import assert from "node:assert/strict";
import test from "node:test";
import {
  artworkSlug,
  creditLine,
  isArtworkType,
  parseAuthorAge,
  parseAuthorName,
  parseTitle,
} from "./model.ts";

/**
 * The rules that decide what ends up published about a child.
 *
 * These run on the server before anything is written, and again in the browser
 * so a mistake is caught before a file is uploaded. Both call this module, so
 * these tests cover both.
 */

test("a first name with two words is a first name", () => {
  // The obvious rule — reject anything with a space — would refuse these, which
  // are ordinary given names in Castellano and Galego.
  for (const name of ["Ana María", "José Luis", "Xosé Manuel", "María"]) {
    const parsed = parseAuthorName(name);
    assert.equal(parsed.ok, true, `refused ${name}`);
    if (parsed.ok) assert.equal(parsed.value, name);
  }
});

test("a full name is refused rather than trimmed", () => {
  // Silently publishing "Martina" would be guessing at what a parent meant
  // about their own child, so this comes back for correction.
  const parsed = parseAuthorName("Martina García López");
  assert.equal(parsed.ok, false);
  if (!parsed.ok) assert.equal(parsed.error, "name_looks_like_full_name");
});

test("names are tidied, not padded into something new", () => {
  const parsed = parseAuthorName("  Martina   ");
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(parsed.value, "Martina");

  // Collapsed whitespace must not turn a two-word name into a three-word one.
  const spaced = parseAuthorName("Ana    María");
  assert.equal(spaced.ok, true);
  if (spaced.ok) assert.equal(spaced.value, "Ana María");
});

test("an empty or oversized name is refused", () => {
  assert.deepEqual(parseAuthorName("   "), { ok: false, error: "name_empty" });
  assert.deepEqual(parseAuthorName("M".repeat(25)), { ok: false, error: "name_too_long" });
});

test("no age is a valid answer", () => {
  // A shop has no business insisting on knowing how old a child is.
  assert.deepEqual(parseAuthorAge(""), { ok: true, value: null });
  assert.deepEqual(parseAuthorAge("   "), { ok: true, value: null });
});

test("an age that is typed has to be a real age", () => {
  assert.deepEqual(parseAuthorAge("7"), { ok: true, value: 7 });
  assert.deepEqual(parseAuthorAge("0"), { ok: false, error: "age_out_of_range" });
  assert.deepEqual(parseAuthorAge("18"), { ok: false, error: "age_out_of_range" });
  assert.deepEqual(parseAuthorAge("7.5"), { ok: false, error: "age_out_of_range" });
  assert.deepEqual(parseAuthorAge("siete"), { ok: false, error: "age_out_of_range" });
});

test("titles are required and bounded", () => {
  assert.deepEqual(parseTitle("  "), { ok: false, error: "title_empty" });
  assert.deepEqual(parseTitle("x".repeat(61)), { ok: false, error: "title_too_long" });

  const parsed = parseTitle("  Mi   perro Nube ");
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(parsed.value, "Mi perro Nube");
});

test("the slug always matches what the database will accept", () => {
  // `artworks.slug` has a CHECK for exactly this shape.
  const shape = /^[a-z0-9]+(-[a-z0-9]+)*$/;

  assert.match(artworkSlug("Mi perro Nube", "k3f9a1"), shape);
  assert.match(artworkSlug("Águila ñu", "k3f9a1"), shape);
  // A title made entirely of emoji slugifies to nothing; a URL is our problem.
  assert.match(artworkSlug("🌟🌟🌟", "k3f9a1"), shape);
  assert.equal(artworkSlug("🌟🌟🌟", "k3f9a1"), "dibujo-k3f9a1");
  // A very long title must not produce a slug ending in a stray hyphen.
  assert.match(artworkSlug("palabra ".repeat(20), "k3f9a1"), shape);
});

test("no artwork slug can shadow the studio", () => {
  // /galeria/taller is a sibling of /galeria/<slug>. Every slug carries a
  // suffix, so the collision cannot happen.
  for (const reserved of ["taller", "obradoiro", "studio"]) {
    assert.notEqual(artworkSlug(reserved, "k3f9a1"), reserved);
  }
});

test("the credit line drops the age when there is none", () => {
  assert.equal(creditLine("Martina", 7, "años"), "Martina, 7 años");
  assert.equal(creditLine("Martina", null, "años"), "Martina");
});

test("SVG is not an accepted upload", () => {
  // An SVG is a script container, and a public-read one served from our own
  // origin is stored XSS. The storage policy refuses the extension too.
  assert.equal(isArtworkType("image/svg+xml"), false);
  assert.equal(isArtworkType("image/jpeg"), true);
  assert.equal(isArtworkType("image/png"), true);
  assert.equal(isArtworkType("text/html"), false);
});
