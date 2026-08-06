#!/usr/bin/env node
/**
 * Generates `supabase/seed.sql` from the content below.
 *
 * The trilingual catalogue lives here as plain data so translations are edited
 * in one place; the SQL (escaping, jsonb literals, deterministic uuids, one
 * stock row per size × colourway) is emitted mechanically.
 *
 *   node scripts/generate-seed.mjs
 *
 * Sample content: the authors and their bibliographies are placeholder records
 * for development. Replace them before going live.
 */

import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "supabase", "seed.sql");

/** Stable uuid v5-style id from a namespace + key, so reseeding keeps ids. */
function uuid(namespace, key) {
  const hex = createHash("sha1").update(`${namespace}:${key}`).digest("hex");
  const bytes = hex.slice(0, 32).split("");
  // Force version 5 / RFC-4122 variant bits.
  bytes[12] = "5";
  bytes[16] = "8";
  const s = bytes.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

/** Deterministic pseudo-stock so the catalogue looks alive without Math.random. */
function stockFor(sku) {
  const n = Number.parseInt(createHash("sha1").update(sku).digest("hex").slice(0, 6), 16);
  return 3 + (n % 34);
}

const q = (value) =>
  value === null || value === undefined ? "null" : `'${String(value).replace(/'/g, "''")}'`;

const j = (value) =>
  value === null || value === undefined ? "null" : `${q(JSON.stringify(value))}::jsonb`;

/* ==========================================================================
   Sizes
   ========================================================================== */

const APPAREL = ["XS", "S", "M", "L", "XL", "2XL"];
const KIDS = ["4", "6", "8", "10", "12", "14"];
const ONE = { es: "Única", gl: "Única", en: "One size" };

const ONE_SIZE_CATEGORIES = new Set([
  "gorras",
  "accesorios",
  "originales",
  "coleccionismo",
  "cuadros",
]);

function sizesFor(product) {
  if (product.sizes) return product.sizes;
  if (product.audience === "ninos") return KIDS;
  if (ONE_SIZE_CATEGORIES.has(product.category)) return [ONE.es];
  return APPAREL;
}

/* ==========================================================================
   Categories
   ========================================================================== */

const categories = [
  {
    id: "camisetas",
    slug: { es: "camisetas", gl: "camisetas", en: "t-shirts" },
    name: { es: "Camisetas", gl: "Camisetas", en: "T-shirts" },
    heading: { es: "Camisetas", gl: "Camisetas", en: "T-shirts" },
    blurb: {
      es: "Algodón peinado, cortes regular y oversize, y estampados serigrafiados en nuestro taller.",
      gl: "Algodón peiteado, cortes regular e oversize, e estampados serigrafiados no noso taller.",
      en: "Combed cotton, regular and oversize fits, screen-printed in our own workshop.",
    },
    keywords: {
      es: ["camiseta de arte", "camiseta algodón", "camiseta oversize", "camiseta serigrafiada"],
      gl: ["camiseta de arte", "camiseta algodón", "camiseta oversize", "camiseta serigrafiada"],
      en: ["art t-shirt", "cotton tee", "oversize tee", "screen printed tee"],
    },
    details: {
      es: [
        "100 % algodón peinado de 220 g",
        "Cuello de canalé 1×1 con cinta interior",
        "Estampado serigrafiado a mano",
        "Lavar del revés a 30 °C",
      ],
      gl: [
        "100 % algodón peiteado de 220 g",
        "Pescozo de canelé 1×1 con cinta interior",
        "Estampado serigrafiado a man",
        "Lavar do revés a 30 °C",
      ],
      en: [
        "100% combed cotton, 220 gsm",
        "1×1 ribbed collar with inner taping",
        "Hand screen-printed graphic",
        "Wash inside out at 30 °C",
      ],
    },
  },
  {
    id: "sudaderas",
    slug: { es: "sudaderas", gl: "sudadoiras", en: "sweatshirts" },
    name: { es: "Sudaderas", gl: "Sudadoiras", en: "Sweatshirts" },
    heading: { es: "Sudaderas y hoodies", gl: "Sudadoiras e hoodies", en: "Sweats & hoodies" },
    blurb: {
      es: "Felpa perchada de 380 g, capuchas forradas y bordados en pecho.",
      gl: "Felpa perchada de 380 g, capuchas forradas e bordados no peito.",
      en: "Brushed 380 gsm fleece, lined hoods and chest embroidery.",
    },
    keywords: {
      es: ["sudadera capucha", "hoodie oversize", "sudadera ilustrada", "felpa"],
      gl: ["sudadoira capucha", "hoodie oversize", "sudadoira ilustrada", "felpa"],
      en: ["hoodie", "oversize hoodie", "illustrated sweatshirt", "fleece"],
    },
    details: {
      es: [
        "Felpa perchada de 380 g (80 % algodón / 20 % poliéster)",
        "Capucha de doble capa con cordón mate",
        "Puños y bajo de canalé elástico",
        "Bordado en pecho",
      ],
      gl: [
        "Felpa perchada de 380 g (80 % algodón / 20 % poliéster)",
        "Capucha de dobre capa con cordón mate",
        "Puños e baixo de canelé elástico",
        "Bordado no peito",
      ],
      en: [
        "Brushed fleece, 380 gsm (80% cotton / 20% polyester)",
        "Double-layer hood with matte drawcord",
        "Ribbed cuffs and hem",
        "Embroidered chest logo",
      ],
    },
  },
  {
    id: "chaquetas",
    slug: { es: "chaquetas", gl: "chaquetas", en: "jackets" },
    name: { es: "Chaquetas", gl: "Chaquetas", en: "Jackets" },
    heading: {
      es: "Chaquetas y cortavientos",
      gl: "Chaquetas e cortaventos",
      en: "Jackets & windbreakers",
    },
    blurb: {
      es: "Capas exteriores para el taller y para la calle.",
      gl: "Capas exteriores para o taller e para a rúa.",
      en: "Outer layers for the workshop and for the street.",
    },
    keywords: {
      es: ["chaqueta de taller", "bomber", "cortavientos", "chaqueta serigrafiada"],
      gl: ["chaqueta de taller", "bomber", "cortaventos", "chaqueta serigrafiada"],
      en: ["work jacket", "bomber", "windbreaker", "screen printed jacket"],
    },
    details: {
      es: [
        "Tejido exterior repelente al agua",
        "Cremallera central con tirador metálico",
        "Bolsillos laterales con cierre",
        "Corte raglán para libertad de movimiento",
      ],
      gl: [
        "Tecido exterior repelente á auga",
        "Cremalleira central con tirador metálico",
        "Petos laterais con peche",
        "Corte raglán para liberdade de movemento",
      ],
      en: [
        "Water-repellent outer shell",
        "Full-length zip with metal puller",
        "Zipped side pockets",
        "Raglan cut for freedom of movement",
      ],
    },
  },
  {
    id: "pantalones",
    slug: { es: "pantalones", gl: "pantalons", en: "bottoms" },
    name: { es: "Pantalones", gl: "Pantalóns", en: "Bottoms" },
    heading: { es: "Pantalones y shorts", gl: "Pantalóns e shorts", en: "Trousers & shorts" },
    blurb: {
      es: "Shorts serigrafiados, joggers y tejidos técnicos con cintura elástica.",
      gl: "Shorts serigrafiados, joggers e tecidos técnicos con cintura elástica.",
      en: "Screen-printed shorts, joggers and technical fabrics with elastic waistbands.",
    },
    keywords: {
      es: ["short serigrafiado", "jogger", "pantalón corto", "short de taller"],
      gl: ["short serigrafiado", "jogger", "pantalón curto", "short de taller"],
      en: ["screen printed shorts", "jogger", "workshop shorts", "studio shorts"],
    },
    details: {
      es: [
        "Tejido de doble punto de 260 g",
        "Cintura elástica con cordón interior",
        "Bolsillos laterales con vivo",
        "Taping lateral aplicado",
      ],
      gl: [
        "Tecido de dobre punto de 260 g",
        "Cintura elástica con cordón interior",
        "Petos laterais con vivo",
        "Taping lateral aplicado",
      ],
      en: [
        "260 gsm double-knit fabric",
        "Elastic waistband with inner drawcord",
        "Piped side pockets",
        "Applied side taping",
      ],
    },
  },
  {
    id: "gorras",
    slug: { es: "gorras", gl: "gorras", en: "headwear" },
    name: { es: "Gorras", gl: "Gorras", en: "Headwear" },
    heading: { es: "Gorras y gorros", gl: "Gorras e gorros", en: "Caps & beanies" },
    blurb: {
      es: "Snapbacks estructuradas, trucker de malla, dad hats y beanies de canalé.",
      gl: "Snapbacks estruturadas, trucker de malla, dad hats e beanies de canelé.",
      en: "Structured snapbacks, mesh truckers, dad hats and ribbed beanies.",
    },
    keywords: {
      es: ["gorra snapback", "gorra trucker", "dad hat", "gorro beanie"],
      gl: ["gorra snapback", "gorra trucker", "dad hat", "gorro beanie"],
      en: ["snapback cap", "trucker cap", "dad hat", "beanie"],
    },
    details: {
      es: [
        "Corona estructurada de 6 paneles",
        "Ojales bordados para ventilación",
        "Cierre ajustable",
        "Visera precurvada",
      ],
      gl: [
        "Coroa estruturada de 6 paneis",
        "Olláis bordados para ventilación",
        "Peche axustable",
        "Viseira precurvada",
      ],
      en: [
        "Structured six-panel crown",
        "Embroidered ventilation eyelets",
        "Adjustable closure",
        "Pre-curved visor",
      ],
    },
  },
  {
    id: "accesorios",
    slug: { es: "accesorios", gl: "accesorios", en: "accessories" },
    name: { es: "Accesorios", gl: "Accesorios", en: "Accessories" },
    heading: { es: "Accesorios", gl: "Accesorios", en: "Accessories" },
    blurb: {
      es: "Tote bags de lona, botellas térmicas y los extras del día de taller.",
      gl: "Tote bags de lona, botellas térmicas e os extras do día de taller.",
      en: "Canvas tote bags, insulated bottles and studio-day extras.",
    },
    keywords: {
      es: ["tote bag", "botella térmica", "bolsa lona", "accesorios de arte"],
      gl: ["tote bag", "botella térmica", "bolsa lona", "accesorios de arte"],
      en: ["tote bag", "insulated bottle", "canvas bag", "art accessories"],
    },
    details: {
      es: [
        "Lona de algodón de 340 g",
        "Costuras reforzadas en asas",
        "Serigrafía a un color",
      ],
      gl: [
        "Lona de algodón de 340 g",
        "Costuras reforzadas nas asas",
        "Serigrafía a unha cor",
      ],
      en: ["340 gsm cotton canvas", "Reinforced handle stitching", "One-colour screen print"],
    },
  },
  {
    // Pieces painted by hand rather than printed: no two come out the same, so
    // the colourways here name the dominant ink, not a garment colour.
    id: "originales",
    slug: { es: "originales", gl: "orixinais", en: "originals" },
    name: { es: "Originales", gl: "Orixinais", en: "Originals" },
    heading: { es: "Obra original", gl: "Obra orixinal", en: "Original artwork" },
    blurb: {
      es: "Obra pintada a mano en el taller: tinta, gouache y collage sobre papel de algodón, firmada al dorso.",
      gl: "Obra pintada a man no taller: tinta, gouache e collage sobre papel de algodón, asinada no reverso.",
      en: "Work painted by hand in the workshop: ink, gouache and collage on cotton paper, signed on the back.",
    },
    keywords: {
      es: ["obra original", "arte sobre papel", "tinta original", "pintura a mano"],
      gl: ["obra orixinal", "arte sobre papel", "tinta orixinal", "pintura a man"],
      en: ["original artwork", "art on paper", "original ink", "hand painted"],
    },
    details: {
      es: [
        "Papel de algodón de 300 g",
        "Tinta y gouache aplicados a mano",
        "Firmada al dorso",
        "Se envía plana, entre cartones",
      ],
      gl: [
        "Papel de algodón de 300 g",
        "Tinta e gouache aplicados a man",
        "Asinada no reverso",
        "Envíase plana, entre cartóns",
      ],
      en: [
        "300 gsm cotton paper",
        "Ink and gouache applied by hand",
        "Signed on the back",
        "Ships flat, between boards",
      ],
    },
  },
  {
    id: "coleccionismo",
    slug: { es: "coleccionismo", gl: "coleccionismo", en: "prints" },
    name: { es: "Coleccionismo", gl: "Coleccionismo", en: "Prints" },
    heading: { es: "Coleccionismo", gl: "Coleccionismo", en: "Prints & collectibles" },
    blurb: {
      es: "Series serigrafiadas numeradas a mano y ediciones limitadas.",
      gl: "Series serigrafiadas numeradas a man e edicións limitadas.",
      en: "Hand-numbered screen-printed series and limited editions.",
    },
    keywords: {
      es: ["póster serigrafiado", "edición limitada", "lámina numerada", "arte gráfico"],
      gl: ["cartel serigrafiado", "edición limitada", "lámina numerada", "arte gráfico"],
      en: ["screen print poster", "limited edition", "numbered print", "graphic art"],
    },
    details: {
      es: [
        "Papel de 300 g sin ácido",
        "Serigrafía de tres tintas",
        "Numerado y firmado a mano",
        "Se envía en tubo rígido",
      ],
      gl: [
        "Papel de 300 g sen ácido",
        "Serigrafía de tres tintas",
        "Numerado e asinado a man",
        "Envíase en tubo ríxido",
      ],
      en: [
        "300 gsm acid-free paper",
        "Three-colour screen print",
        "Hand-numbered and signed",
        "Ships in a rigid tube",
      ],
    },
  },
  {
    // Work on paper, sold to be hung. Everything in here carries a `frame`, and
    // that is what turns on the framed preview and the camera wall view.
    id: "cuadros",
    slug: { es: "cuadros", gl: "cadros", en: "framed-prints" },
    name: { es: "Cuadros", gl: "Cadros", en: "Framed prints" },
    heading: {
      es: "Cuadros y láminas enmarcadas",
      gl: "Cadros e láminas enmarcadas",
      en: "Framed prints and artwork",
    },
    // Deliberately silent about the camera: the wall view needs one, and this
    // copy is read on desktops that have none. The button says so where it can
    // be honoured; the category text would be promising it everywhere.
    blurb: {
      es: "Obra sobre papel de nuestros autores, lista para colgar. Puedes verla enmarcada antes de decidir: marco negro, blanco o madera, siempre con paspartú blanco.",
      gl: "Obra sobre papel das nosas autoras, lista para colgar. Podes vela enmarcada antes de decidir: marco negro, branco ou madeira, sempre con paspartú branco.",
      en: "Work on paper by our authors, ready to hang. See it framed before you decide: black, white or wood, always with a white mount.",
    },
    keywords: {
      es: ["cuadros", "laminas", "serigrafia", "marco", "paspartu", "arte", "decoracion"],
      gl: ["cadros", "laminas", "serigrafia", "marco", "paspartu", "arte", "decoracion"],
      en: ["framed prints", "art prints", "serigraph", "frame", "mount", "wall art"],
    },
    details: {
      es: [
        "Papel de 300 g sin ácido",
        "Serigrafía de tres tintas",
        "Numerado y firmado a mano",
        "Se envía en tubo rígido",
      ],
      gl: [
        "Papel de 300 g sen ácido",
        "Serigrafía de tres tintas",
        "Numerado e asinado a man",
        "Envíase en tubo ríxido",
      ],
      en: [
        "300 gsm acid-free paper",
        "Three-colour screen print",
        "Hand-numbered and signed",
        "Ships in a rigid tube",
      ],
    },
  },
];

/* ==========================================================================
   Collections
   ========================================================================== */

const collections = [
  {
    // The id is what the storefront navigation and the home carousel look this
    // line up by, so it stays put even though the name and the slug moved on.
    id: "court-series",
    slug: { es: "serie-estudio", gl: "serie-estudio", en: "studio-series" },
    name: { es: "Serie Estudio", gl: "Serie Estudio", en: "Studio Series" },
    tagline: { es: "La línea de estudio", gl: "A liña de estudio", en: "The studio line" },
    blurb: {
      es: "La base del fondo de armario: camisetas de tirantes, shorts a conjunto y capas de trabajo con el logo aplicado en tono sobre tono.",
      gl: "A base do fondo de armario: camisetas de tirantes, shorts a conxunto e capas de traballo co logo aplicado en ton sobre ton.",
      en: "The core wardrobe: tanks, matching shorts and work layers with a tonal applied logo.",
    },
    keywords: {
      es: ["ropa de arte", "camiseta de tirantes", "serie estudio"],
      gl: ["roupa de arte", "camiseta de tirantes", "serie estudio"],
      en: ["art clothing", "printed tank", "studio series"],
    },
    accent: "#1d4ed8",
  },
  {
    id: "hardwood-94",
    slug: { es: "archivo-94", gl: "arquivo-94", en: "archive-94" },
    name: { es: "Archivo 94", gl: "Arquivo 94", en: "Archive 94" },
    tagline: { es: "Archivo noventero", gl: "Arquivo dos noventa", en: "Nineties archive" },
    blurb: {
      es: "Paleta de papel viejo, tipografía condensada y bloques de color rescatados del archivo de carteles de 1994.",
      gl: "Paleta de papel vello, tipografía condensada e bloques de cor rescatados do arquivo de carteis de 1994.",
      en: "Aged-paper palette, condensed type and colour blocking pulled from the 1994 poster archive.",
    },
    keywords: {
      es: ["arte retro", "años 90", "carteles vintage"],
      gl: ["arte retro", "anos 90", "carteis vintage"],
      en: ["retro art", "nineties", "vintage posters"],
    },
    accent: "#c9b791",
  },
  {
    id: "away-days",
    slug: { es: "away-days", gl: "away-days", en: "away-days" },
    name: { es: "Away Days", gl: "Away Days", en: "Away Days" },
    tagline: { es: "Fuera de casa", gl: "Fóra da casa", en: "On the road" },
    blurb: {
      es: "Siluetas oversize, tejidos lavados y grafismos pensados para viajar.",
      gl: "Siluetas oversize, tecidos lavados e grafismos pensados para viaxar.",
      en: "Oversize silhouettes, washed fabrics and graphics built for travelling.",
    },
    keywords: {
      es: ["oversize", "streetwear ilustrado", "ropa lavada"],
      gl: ["oversize", "streetwear ilustrado", "roupa lavada"],
      en: ["oversize", "illustrated streetwear", "garment dyed"],
    },
    accent: "#141414",
  },
  {
    id: "training-lab",
    slug: { es: "training-lab", gl: "training-lab", en: "training-lab" },
    name: { es: "Training Lab", gl: "Training Lab", en: "Training Lab" },
    tagline: { es: "Tejidos técnicos", gl: "Tecidos técnicos", en: "Technical fabrics" },
    blurb: {
      es: "Punto de secado rápido, costuras planas y piezas que aguantan la jornada de taller.",
      gl: "Punto de secado rápido, costuras planas e pezas que aguantan a xornada de taller.",
      en: "Quick-dry knits, flatlock seams and pieces that survive a full day in the workshop.",
    },
    keywords: {
      es: ["ropa técnica", "ropa de taller", "secado rápido"],
      gl: ["roupa técnica", "roupa de taller", "secado rápido"],
      en: ["technical apparel", "workwear", "quick dry"],
    },
    accent: "#0f7a4f",
  },
  {
    id: "origen",
    slug: { es: "origen", gl: "orixe", en: "origin" },
    name: { es: "Origen", gl: "Orixe", en: "Origin" },
    tagline: { es: "Edición numerada", gl: "Edición numerada", en: "Numbered edition" },
    blurb: {
      es: "Series cortas serigrafiadas y numeradas a mano. Cuando se agotan, no se reponen.",
      gl: "Series curtas serigrafiadas e numeradas a man. Cando se esgotan, non se repoñen.",
      en: "Short runs, screen-printed and hand-numbered. Once they sell out, they are gone.",
    },
    keywords: {
      es: ["edición limitada", "serie numerada", "hecho a mano"],
      gl: ["edición limitada", "serie numerada", "feito a man"],
      en: ["limited edition", "numbered series", "handmade"],
    },
    accent: "#7a1225",
  },
];

/* ==========================================================================
   Authors — sample records, replace before launch
   ========================================================================== */

const authors = [
  {
    key: "noa-vilarino",
    slug: { es: "noa-vilarino", gl: "noa-vilarino", en: "noa-vilarino" },
    name: "Noa Vilariño",
    role: {
      es: "Dirección de arte",
      gl: "Dirección de arte",
      en: "Art direction",
    },
    bio: {
      es: "Dirige la identidad visual de las colecciones y firma la mayoría de los grafismos del catálogo.",
      gl: "Dirixe a identidade visual das coleccións e asina a maioría dos grafismos do catálogo.",
      en: "Leads the visual identity of the collections and signs most of the graphics in the catalogue.",
    },
    statement: {
      es: "Trabajo con tipografía condensada y bloques de color porque una camiseta se lee a treinta metros, no a treinta centímetros.",
      gl: "Traballo con tipografía condensada e bloques de cor porque unha camiseta lese a trinta metros, non a trinta centímetros.",
      en: "I work with condensed type and colour blocks because a t-shirt is read from thirty metres away, not thirty centimetres.",
    },
    links: [
      { label: "Instagram", url: "https://instagram.com" },
      { label: "Portfolio", url: "https://example.com" },
    ],
    keywords: {
      es: ["dirección de arte", "tipografía condensada", "cartelismo"],
      gl: ["dirección de arte", "tipografía condensada", "cartelismo"],
      en: ["art direction", "condensed typography", "poster design"],
    },
    works: [
      {
        year: 2024,
        title: "Letra pintada: rótulos a mano en Galicia",
        publisher: "Edicións Rúa",
        kind: "book",
        url: "https://example.com/letra-pintada",
        note: {
          es: "Ensayo fotográfico sobre la rotulación a mano de los mercados municipales.",
          gl: "Ensaio fotográfico sobre a rotulación a man dos mercados municipais.",
          en: "Photographic essay on the hand-painted signage of municipal markets.",
        },
      },
      {
        year: 2022,
        title: "Bloques de color y legibilidad a distancia",
        publisher: "Revista Grafismo",
        kind: "article",
        url: "https://example.com/bloques-color",
      },
      {
        year: 2021,
        title: "Archivo 94: un año de carteles",
        publisher: "Fanzine propio",
        kind: "zine",
      },
    ],
  },
  {
    key: "brais-carballo",
    slug: { es: "brais-carballo", gl: "brais-carballo", en: "brais-carballo" },
    name: "Brais Carballo",
    role: { es: "Ilustración", gl: "Ilustración", en: "Illustration" },
    bio: {
      es: "Ilustrador y serigrafista. Dibuja las series numeradas y las estampa una por una.",
      gl: "Ilustrador e serigrafista. Debuxa as series numeradas e estámpaas unha por unha.",
      en: "Illustrator and screen printer. Draws the numbered series and pulls every print by hand.",
    },
    statement: {
      es: "Cada tirada tiene errores de registro. Son la prueba de que lo hizo una persona.",
      gl: "Cada tirada ten erros de rexistro. Son a proba de que o fixo unha persoa.",
      en: "Every run has registration errors. They are the proof a person made it.",
    },
    links: [{ label: "Instagram", url: "https://instagram.com" }],
    keywords: {
      es: ["ilustración", "serigrafía", "edición limitada"],
      gl: ["ilustración", "serigrafía", "edición limitada"],
      en: ["illustration", "screen printing", "limited edition"],
    },
    works: [
      {
        year: 2025,
        title: "Origen: cien láminas numeradas",
        publisher: "Autoedición",
        kind: "catalogue",
        note: {
          es: "Catálogo de la primera serie numerada, agotado.",
          gl: "Catálogo da primeira serie numerada, esgotado.",
          en: "Catalogue of the first numbered series, out of print.",
        },
      },
      {
        year: 2023,
        title: "Serigrafía en tiradas cortas: manual práctico",
        publisher: "Escola de Oficios",
        kind: "book",
      },
    ],
  },
  {
    key: "iria-seoane",
    slug: { es: "iria-seoane", gl: "iria-seoane", en: "iria-seoane" },
    name: "Iria Seoane",
    role: { es: "Patronaje", gl: "Patronaxe", en: "Pattern cutting" },
    bio: {
      es: "Responsable de patrones y escalado de tallas. Prueba cada prenda en el taller antes de aprobarla.",
      gl: "Responsable de patróns e escalado de tallas. Proba cada peza no taller antes de aprobala.",
      en: "Responsible for patterns and size grading. Tests every garment in the workshop before signing it off.",
    },
    statement: {
      es: "Una sisa mal resuelta se nota al levantar el brazo. El resto son detalles.",
      gl: "Unha sisa mal resolta nótase ao levantar o brazo. O resto son detalles.",
      en: "A badly cut armhole shows the moment you raise your arm. Everything else is detail.",
    },
    links: [{ label: "LinkedIn", url: "https://linkedin.com" }],
    keywords: {
      es: ["patronaje", "escalado de tallas", "ropa de taller"],
      gl: ["patronaxe", "escalado de tallas", "roupa de taller"],
      en: ["pattern cutting", "size grading", "workwear"],
    },
    works: [
      {
        year: 2024,
        title: "Escalado de tallas para prendas serigrafiadas",
        publisher: "Cadernos Téxtiles",
        kind: "article",
      },
      {
        year: 2020,
        title: "Del patrón plano al taller",
        publisher: "Congreso de Diseño Téxtil",
        kind: "talk",
      },
    ],
  },
  {
    key: "xabier-lema",
    slug: { es: "xabier-lema", gl: "xabier-lema", en: "xabier-lema" },
    name: "Xabier Lema",
    role: { es: "Producto técnico", gl: "Produto técnico", en: "Technical product" },
    bio: {
      es: "Selecciona tejidos y desarrolla la línea Training Lab junto a los talleres.",
      gl: "Selecciona tecidos e desenvolve a liña Training Lab xunto aos talleres.",
      en: "Sources fabrics and develops the Training Lab line together with the workshops.",
    },
    statement: {
      es: "Un tejido técnico que pica no lo usa nadie dos veces, por muy bien que transpire.",
      gl: "Un tecido técnico que pica non o usa ninguén dúas veces, por moi ben que transpire.",
      en: "A technical fabric that itches gets worn once, no matter how well it breathes.",
    },
    links: [],
    keywords: {
      es: ["tejidos técnicos", "desarrollo de producto", "sostenibilidad textil"],
      gl: ["tecidos técnicos", "desenvolvemento de produto", "sustentabilidade téxtil"],
      en: ["technical fabrics", "product development", "textile sustainability"],
    },
    works: [
      {
        year: 2025,
        title: "Poliéster reciclado en prendas de alta rotación",
        publisher: "Informe Téxtil Atlántico",
        kind: "article",
        url: "https://example.com/poliester",
      },
    ],
  },
  {
    key: "marta-ferreiro",
    slug: { es: "marta-ferreiro", gl: "marta-ferreiro", en: "marta-ferreiro" },
    name: "Marta Ferreiro",
    role: { es: "Fotografía", gl: "Fotografía", en: "Photography" },
    bio: {
      es: "Fotografía las campañas y documenta el proceso de taller de cada colección.",
      gl: "Fotografía as campañas e documenta o proceso de taller de cada colección.",
      en: "Shoots the campaigns and documents each collection's workshop process.",
    },
    statement: {
      es: "Prefiero la luz del taller a la de plató. Miente menos.",
      gl: "Prefiro a luz do taller á de plató. Mente menos.",
      en: "I prefer workshop light to studio light. It lies less.",
    },
    links: [{ label: "Instagram", url: "https://instagram.com" }],
    keywords: {
      es: ["fotografía de producto", "campaña", "documental"],
      gl: ["fotografía de produto", "campaña", "documental"],
      en: ["product photography", "campaign", "documentary"],
    },
    works: [
      {
        year: 2024,
        title: "Talleres",
        publisher: "Galería Atlántica",
        kind: "exhibition",
        note: {
          es: "Serie de 40 fotografías en talleres de serigrafía de A Coruña.",
          gl: "Serie de 40 fotografías en talleres de serigrafía da Coruña.",
          en: "Series of 40 photographs in screen-printing workshops around A Coruña.",
        },
      },
    ],
  },
];

const authorId = (key) => uuid("author", key);

/* ==========================================================================
   Products
   ========================================================================== */

const products = [
  {
    ref: "GO-001",
    slug: {
      es: "camiseta-serie-estudio-logo",
      gl: "camiseta-serie-estudio-logo",
      en: "studio-series-logo-tee",
    },
    name: {
      es: "Camiseta Serie Estudio Logo",
      gl: "Camiseta Serie Estudio Logo",
      en: "Studio Series Logo Tee",
    },
    description: {
      es: "La camiseta de todos los días de la línea de estudio: algodón peinado de 220 g, caída recta y logotipo serigrafiado en el centro del pecho.",
      gl: "A camiseta de todos os días da liña de estudio: algodón peiteado de 220 g, caída recta e logotipo serigrafiado no centro do peito.",
      en: "The everyday tee from the studio line: 220 gsm combed cotton, straight drape and a screen-printed chest logo.",
    },
    keywords: {
      es: ["camiseta serie estudio", "camiseta logo", "camiseta de arte negra"],
      gl: ["camiseta serie estudio", "camiseta logo", "camiseta de arte negra"],
      en: ["studio series tee", "logo t-shirt", "black art tee"],
    },
    category: "camisetas",
    collection: "court-series",
    shape: "tee",
    printable: true,
    print: "wordmark",
    price: 3495,
    colors: ["negro", "blanco", "marino", "electrico"],
    rating: 4.7,
    reviews: 412,
    arrived: 96,
    bestseller: true,
    authors: [["noa-vilarino", { es: "Diseño gráfico", gl: "Deseño gráfico", en: "Graphic design" }]],
  },
  {
    ref: "GO-002",
    slug: { es: "camiseta-archivo-94", gl: "camiseta-arquivo-94", en: "archive-94-tee" },
    name: { es: "Camiseta Archivo 94", gl: "Camiseta Arquivo 94", en: "Archive 94 Tee" },
    description: {
      es: "Reedición del algodón de 1994: tono papel viejo, cuello alto de canalé y bloque tipográfico condensado.",
      gl: "Reedición do algodón de 1994: ton papel vello, pescozo alto de canelé e bloque tipográfico condensado.",
      en: "A reissue of the 1994 cotton tee: aged-paper tone, high ribbed collar and a condensed type block.",
    },
    keywords: {
      es: ["camiseta retro", "camiseta años 90", "archivo 94"],
      gl: ["camiseta retro", "camiseta anos 90", "arquivo 94"],
      en: ["retro tee", "nineties t-shirt", "archive 94"],
    },
    category: "camisetas",
    collection: "hardwood-94",
    shape: "tee",
    print: "wordmark",
    price: 3695,
    compareAt: 4495,
    colors: ["arena", "hueso", "granate"],
    soldOut: ["XS"],
    rating: 4.6,
    reviews: 238,
    arrived: 84,
    bestseller: true,
    authors: [
      ["noa-vilarino", { es: "Dirección de arte", gl: "Dirección de arte", en: "Art direction" }],
      ["brais-carballo", { es: "Ilustración", gl: "Ilustración", en: "Illustration" }],
    ],
  },
  {
    ref: "GO-003",
    slug: {
      es: "camiseta-away-days-oversize",
      gl: "camiseta-away-days-oversize",
      en: "away-days-oversize-tee",
    },
    name: {
      es: "Camiseta Away Days Oversize",
      gl: "Camiseta Away Days Oversize",
      en: "Away Days Oversize Tee",
    },
    description: {
      es: "Corte oversize con hombro caído y tejido lavado en prenda para que no encoja tras el primer lavado.",
      gl: "Corte oversize con ombreiro caído e tecido lavado en peza para que non encolla tras o primeiro lavado.",
      en: "Oversize cut with dropped shoulders and garment-washed fabric so it will not shrink after the first wash.",
    },
    keywords: {
      es: ["camiseta oversize", "hombro caído", "away days"],
      gl: ["camiseta oversize", "ombreiro caído", "away days"],
      en: ["oversize tee", "dropped shoulder", "away days"],
    },
    category: "camisetas",
    collection: "away-days",
    shape: "tee",
    print: "wordmark",
    price: 3995,
    colors: ["negro", "gris", "verde"],
    rating: 4.8,
    reviews: 176,
    arrived: 99,
    authors: [["noa-vilarino", { es: "Diseño gráfico", gl: "Deseño gráfico", en: "Graphic design" }]],
  },
  {
    ref: "GO-004",
    slug: { es: "camiseta-origen-numerada", gl: "camiseta-orixe-numerada", en: "origin-numbered-tee" },
    name: {
      es: "Camiseta Origen Numerada",
      gl: "Camiseta Orixe Numerada",
      en: "Origin Numbered Tee",
    },
    description: {
      es: "Serie corta de 300 unidades, con monograma bordado en pecho y número de serie impreso en la etiqueta interior.",
      gl: "Serie curta de 300 unidades, con monograma bordado no peito e número de serie impreso na etiqueta interior.",
      en: "A short run of 300, with an embroidered chest monogram and the serial number printed on the inner label.",
    },
    keywords: {
      es: ["edición limitada", "camiseta numerada", "monograma bordado"],
      gl: ["edición limitada", "camiseta numerada", "monograma bordado"],
      en: ["limited edition", "numbered tee", "embroidered monogram"],
    },
    category: "camisetas",
    collection: "origen",
    shape: "tee",
    print: "monogram",
    price: 4500,
    colors: ["granate", "negro"],
    soldOut: ["2XL"],
    rating: 4.9,
    reviews: 64,
    arrived: 100,
    exclusive: true,
    authors: [
      ["brais-carballo", { es: "Ilustración y serigrafía", gl: "Ilustración e serigrafía", en: "Illustration & printing" }],
    ],
  },
  {
    ref: "GO-005",
    slug: { es: "camiseta-training-lab-dry", gl: "camiseta-training-lab-dry", en: "training-lab-dry-tee" },
    name: {
      es: "Camiseta Training Lab Dry",
      gl: "Camiseta Training Lab Dry",
      en: "Training Lab Dry Tee",
    },
    description: {
      es: "Punto técnico de secado rápido con costuras planas y paneles de ventilación en la espalda.",
      gl: "Punto técnico de secado rápido con costuras planas e paneis de ventilación nas costas.",
      en: "Quick-dry technical knit with flatlock seams and ventilation panels across the back.",
    },
    keywords: {
      es: ["camiseta técnica", "secado rápido", "entrenamiento"],
      gl: ["camiseta técnica", "secado rápido", "adestramento"],
      en: ["technical tee", "quick dry", "training"],
    },
    category: "camisetas",
    collection: "training-lab",
    shape: "tee",
    print: "monogram",
    price: 2995,
    compareAt: 3495,
    colors: ["electrico", "negro", "verde"],
    rating: 4.4,
    reviews: 301,
    arrived: 78,
    authors: [
      ["xabier-lema", { es: "Desarrollo técnico", gl: "Desenvolvemento técnico", en: "Technical development" }],
    ],
  },
  {
    ref: "GO-006",
    slug: {
      es: "camiseta-cropped-serie-estudio",
      gl: "camiseta-cropped-serie-estudio",
      en: "studio-series-cropped-tee",
    },
    name: {
      es: "Camiseta Cropped Serie Estudio",
      gl: "Camiseta Cropped Serie Estudio",
      en: "Studio Series Cropped Tee",
    },
    description: {
      es: "Largo cropped con bajo recto y logotipo reducido en el pecho izquierdo.",
      gl: "Longo cropped con baixo recto e logotipo reducido no peito esquerdo.",
      en: "Cropped length with a straight hem and a small logo on the left chest.",
    },
    keywords: {
      es: ["camiseta cropped", "camiseta corta mujer", "serie estudio"],
      gl: ["camiseta cropped", "camiseta curta muller", "serie estudio"],
      en: ["cropped tee", "women's short tee", "studio series"],
    },
    category: "camisetas",
    collection: "court-series",
    audience: "mujer",
    shape: "tee",
    print: "wordmark",
    price: 3295,
    colors: ["blanco", "negro", "rojo"],
    sizes: ["XS", "S", "M", "L", "XL"],
    rating: 4.5,
    reviews: 129,
    arrived: 92,
    authors: [["iria-seoane", { es: "Patronaje", gl: "Patronaxe", en: "Pattern cutting" }]],
  },
  {
    ref: "GO-007",
    slug: {
      es: "camiseta-junior-serie-estudio",
      gl: "camiseta-junior-serie-estudio",
      en: "studio-series-junior-tee",
    },
    name: {
      es: "Camiseta Junior Serie Estudio",
      gl: "Camiseta Junior Serie Estudio",
      en: "Studio Series Junior Tee",
    },
    description: {
      es: "La misma camiseta de la serie de adultos, en tallas de 4 a 14 años.",
      gl: "A mesma camiseta da serie de adultos, en tallas de 4 a 14 anos.",
      en: "The same tee as the adult series, in sizes from 4 to 14 years.",
    },
    keywords: {
      es: ["camiseta niño", "arte infantil", "serie estudio junior"],
      gl: ["camiseta neno", "arte infantil", "serie estudio junior"],
      en: ["kids t-shirt", "kids art", "studio series junior"],
    },
    category: "camisetas",
    collection: "court-series",
    audience: "ninos",
    shape: "tee",
    printable: true,
    print: "wordmark",
    price: 2495,
    colors: ["electrico", "blanco", "negro"],
    rating: 4.6,
    reviews: 88,
    arrived: 74,
    authors: [["iria-seoane", { es: "Patronaje", gl: "Patronaxe", en: "Pattern cutting" }]],
  },
  {
    ref: "GO-008",
    slug: {
      es: "sudadera-capucha-serie-estudio",
      gl: "sudadoira-capucha-serie-estudio",
      en: "studio-series-hoodie",
    },
    name: {
      es: "Sudadera con Capucha Serie Estudio",
      gl: "Sudadoira con Capucha Serie Estudio",
      en: "Studio Series Hoodie",
    },
    description: {
      es: "Felpa perchada de 380 g, capucha de doble capa y bolsillo canguro. El básico del invierno.",
      gl: "Felpa perchada de 380 g, capucha de dobre capa e peto canguro. O básico do inverno.",
      en: "380 gsm brushed fleece, double-layer hood and kangaroo pocket. The winter staple.",
    },
    keywords: {
      es: ["sudadera capucha", "hoodie negro", "serie estudio"],
      gl: ["sudadoira capucha", "hoodie negro", "serie estudio"],
      en: ["hoodie", "black hoodie", "studio series"],
    },
    category: "sudaderas",
    collection: "court-series",
    shape: "hoodie",
    print: "wordmark",
    price: 6995,
    colors: ["negro", "gris", "marino"],
    rating: 4.9,
    reviews: 523,
    arrived: 95,
    bestseller: true,
    authors: [
      ["noa-vilarino", { es: "Diseño gráfico", gl: "Deseño gráfico", en: "Graphic design" }],
      ["iria-seoane", { es: "Patronaje", gl: "Patronaxe", en: "Pattern cutting" }],
    ],
  },
  {
    ref: "GO-009",
    slug: { es: "hoodie-oversize-away-days", gl: "hoodie-oversize-away-days", en: "away-days-oversize-hoodie" },
    name: {
      es: "Hoodie Oversize Away Days",
      gl: "Hoodie Oversize Away Days",
      en: "Away Days Oversize Hoodie",
    },
    description: {
      es: "Silueta amplia con hombro caído y bordado tonal. Pensada para llevar dos tallas por encima.",
      gl: "Silueta ampla con ombreiro caído e bordado tonal. Pensada para levar dúas tallas por riba.",
      en: "Roomy silhouette with dropped shoulders and tonal embroidery. Designed to be worn two sizes up.",
    },
    keywords: {
      es: ["hoodie oversize", "sudadera ancha", "bordado tonal"],
      gl: ["hoodie oversize", "sudadoira ancha", "bordado tonal"],
      en: ["oversize hoodie", "boxy sweatshirt", "tonal embroidery"],
    },
    category: "sudaderas",
    collection: "away-days",
    shape: "hoodie",
    print: "wordmark",
    price: 7495,
    compareAt: 8995,
    colors: ["hueso", "negro", "verde"],
    soldOut: ["S"],
    rating: 4.7,
    reviews: 214,
    arrived: 98,
    bestseller: true,
    authors: [["noa-vilarino", { es: "Dirección de arte", gl: "Dirección de arte", en: "Art direction" }]],
  },
  {
    ref: "GO-010",
    slug: { es: "sudadera-crew-archivo-94", gl: "sudadoira-crew-arquivo-94", en: "archive-94-crew" },
    name: {
      es: "Sudadera Crew Archivo 94",
      gl: "Sudadoira Crew Arquivo 94",
      en: "Archive 94 Crew",
    },
    description: {
      es: "Cuello redondo de canalé con refuerzo en V y logo aplicado en tejido.",
      gl: "Pescozo redondo de canelé con reforzo en V e logo aplicado en tecido.",
      en: "Ribbed crew neck with a V insert and a fabric-applied logo.",
    },
    keywords: {
      es: ["sudadera cuello redondo", "crewneck", "archivo 94"],
      gl: ["sudadoira pescozo redondo", "crewneck", "arquivo 94"],
      en: ["crewneck sweatshirt", "crew", "archive 94"],
    },
    category: "sudaderas",
    collection: "hardwood-94",
    shape: "hoodie",
    print: "wordmark",
    price: 6495,
    colors: ["arena", "granate", "marino"],
    rating: 4.5,
    reviews: 143,
    arrived: 80,
    authors: [["brais-carballo", { es: "Ilustración", gl: "Ilustración", en: "Illustration" }]],
  },
  {
    ref: "GO-011",
    slug: {
      es: "sudadera-media-cremallera-training-lab",
      gl: "sudadoira-media-cremalleira-training-lab",
      en: "training-lab-half-zip",
    },
    name: {
      es: "Sudadera Media Cremallera Training Lab",
      gl: "Sudadoira Media Cremalleira Training Lab",
      en: "Training Lab Half-Zip",
    },
    description: {
      es: "Media cremallera con cuello alto y tejido técnico de interlock.",
      gl: "Media cremalleira con pescozo alto e tecido técnico de interlock.",
      en: "Half-zip with a high collar in technical interlock fabric.",
    },
    keywords: {
      es: ["media cremallera", "sudadera técnica", "cuello alto"],
      gl: ["media cremalleira", "sudadoira técnica", "pescozo alto"],
      en: ["half zip", "technical sweatshirt", "high collar"],
    },
    category: "sudaderas",
    collection: "training-lab",
    shape: "hoodie",
    print: "monogram",
    price: 5995,
    colors: ["negro", "electrico"],
    rating: 4.4,
    reviews: 97,
    arrived: 88,
    authors: [["xabier-lema", { es: "Desarrollo técnico", gl: "Desenvolvemento técnico", en: "Technical development" }]],
  },
  {
    ref: "GO-012",
    slug: { es: "hoodie-mujer-away-days", gl: "hoodie-muller-away-days", en: "away-days-womens-hoodie" },
    name: {
      es: "Hoodie Mujer Away Days",
      gl: "Hoodie Muller Away Days",
      en: "Away Days Women's Hoodie",
    },
    description: {
      es: "Corte relajado con bajo elástico y capucha forrada en jersey.",
      gl: "Corte relaxado con baixo elástico e capucha forrada en xersei.",
      en: "Relaxed cut with an elasticated hem and a jersey-lined hood.",
    },
    keywords: {
      es: ["sudadera mujer", "hoodie relajado", "away days"],
      gl: ["sudadoira muller", "hoodie relaxado", "away days"],
      en: ["women's hoodie", "relaxed hoodie", "away days"],
    },
    category: "sudaderas",
    collection: "away-days",
    audience: "mujer",
    shape: "hoodie",
    print: "wordmark",
    price: 6995,
    colors: ["hueso", "rojo", "negro"],
    sizes: ["XS", "S", "M", "L", "XL"],
    rating: 4.8,
    reviews: 168,
    arrived: 94,
    authors: [["iria-seoane", { es: "Patronaje", gl: "Patronaxe", en: "Pattern cutting" }]],
  },
  {
    ref: "GO-013",
    slug: { es: "sudadera-junior-monograma", gl: "sudadoira-junior-monograma", en: "junior-monogram-hoodie" },
    name: {
      es: "Sudadera Junior Monograma",
      gl: "Sudadoira Junior Monograma",
      en: "Junior Monogram Hoodie",
    },
    description: {
      es: "Felpa suave sin cordones, homologada para tallas infantiles.",
      gl: "Felpa suave sen cordóns, homologada para tallas infantís.",
      en: "Soft fleece with no drawcords, compliant with children's sizing standards.",
    },
    keywords: {
      es: ["sudadera niño", "hoodie infantil", "sin cordones"],
      gl: ["sudadoira neno", "hoodie infantil", "sen cordóns"],
      en: ["kids hoodie", "children's sweatshirt", "drawcord free"],
    },
    category: "sudaderas",
    collection: "court-series",
    audience: "ninos",
    shape: "hoodie",
    print: "monogram",
    price: 4495,
    compareAt: 5495,
    colors: ["marino", "negro"],
    rating: 4.6,
    reviews: 71,
    arrived: 68,
    authors: [["iria-seoane", { es: "Patronaje", gl: "Patronaxe", en: "Pattern cutting" }]],
  },
  {
    ref: "GO-014",
    slug: {
      es: "camiseta-tirantes-serie-estudio",
      gl: "camiseta-tirantes-serie-estudio",
      en: "studio-series-tank",
    },
    name: {
      es: "Camiseta de Tirantes Serie Estudio",
      gl: "Camiseta de Tirantes Serie Estudio",
      en: "Studio Series Tank",
    },
    description: {
      es: "Tirantes en malla de doble capa, con el número de edición termosellado a la espalda y ribetes en canalé.",
      gl: "Tirantes en malla de dobre capa, co número de edición termosellado nas costas e ribetes en canelé.",
      en: "Double-layer mesh tank, with the edition number heat-sealed on the back and ribbed trims.",
    },
    keywords: {
      es: ["camiseta de tirantes", "malla doble capa", "número de edición"],
      gl: ["camiseta de tirantes", "malla dobre capa", "número de edición"],
      en: ["mesh tank", "double mesh", "edition number"],
    },
    category: "camisetas",
    collection: "court-series",
    shape: "jersey",
    print: "number",
    price: 8995,
    colors: ["electrico", "blanco", "negro"],
    soldOut: ["XS", "2XL"],
    rating: 4.9,
    reviews: 389,
    arrived: 97,
    bestseller: true,
    authors: [
      ["noa-vilarino", { es: "Dirección de arte", gl: "Dirección de arte", en: "Art direction" }],
      ["iria-seoane", { es: "Patronaje", gl: "Patronaxe", en: "Pattern cutting" }],
      ["xabier-lema", { es: "Tejido técnico", gl: "Tecido técnico", en: "Technical fabric" }],
    ],
  },
  {
    ref: "GO-015",
    slug: {
      es: "tirantes-archivo-94-reversible",
      gl: "tirantes-arquivo-94-reversible",
      en: "archive-94-reversible-tank",
    },
    name: {
      es: "Tirantes Archivo 94 Reversible",
      gl: "Tirantes Arquivo 94 Reversible",
      en: "Archive 94 Reversible Tank",
    },
    description: {
      es: "Doble cara: arena por fuera, granate por dentro. Dos camisetas en una.",
      gl: "Dobre cara: area por fóra, granate por dentro. Dúas camisetas nunha.",
      en: "Two-sided: sand outside, maroon inside. Two tanks in one.",
    },
    keywords: {
      es: ["tirantes reversible", "camiseta doble cara", "archivo 94"],
      gl: ["tirantes reversible", "camiseta dobre cara", "arquivo 94"],
      en: ["reversible tank", "two-sided tank", "archive 94"],
    },
    category: "camisetas",
    collection: "hardwood-94",
    shape: "jersey",
    print: "number",
    price: 9995,
    compareAt: 11995,
    colors: ["arena", "granate"],
    rating: 4.7,
    reviews: 112,
    arrived: 86,
    authors: [
      ["noa-vilarino", { es: "Dirección de arte", gl: "Dirección de arte", en: "Art direction" }],
      ["brais-carballo", { es: "Ilustración", gl: "Ilustración", en: "Illustration" }],
    ],
  },
  {
    ref: "GO-016",
    slug: { es: "tirantes-origen-23", gl: "tirantes-orixe-23", en: "origin-23-tank" },
    name: { es: "Tirantes Origen 23", gl: "Tirantes Orixe 23", en: "Origin 23 Tank" },
    description: {
      es: "Edición de 150 unidades con el número bordado y etiqueta numerada a mano en el bajo.",
      gl: "Edición de 150 unidades co número bordado e etiqueta numerada a man no baixo.",
      en: "Edition of 150 with an embroidered number and a hand-numbered label at the hem.",
    },
    keywords: {
      es: ["tirantes numerado", "edición 150", "número bordado"],
      gl: ["tirantes numerado", "edición 150", "número bordado"],
      en: ["numbered tank", "edition of 150", "embroidered number"],
    },
    category: "camisetas",
    collection: "origen",
    shape: "jersey",
    print: "number",
    price: 12000,
    colors: ["granate", "negro"],
    soldOut: ["XL", "2XL"],
    rating: 5,
    reviews: 41,
    arrived: 100,
    exclusive: true,
    authors: [
      ["brais-carballo", { es: "Ilustración y serigrafía", gl: "Ilustración e serigrafía", en: "Illustration & printing" }],
      ["noa-vilarino", { es: "Dirección de arte", gl: "Dirección de arte", en: "Art direction" }],
    ],
  },
  {
    ref: "GO-017",
    slug: {
      es: "chaqueta-trabajo-serie-estudio",
      gl: "chaqueta-traballo-serie-estudio",
      en: "studio-series-work-jacket",
    },
    name: {
      es: "Chaqueta de Trabajo Serie Estudio",
      gl: "Chaqueta de Traballo Serie Estudio",
      en: "Studio Series Work Jacket",
    },
    description: {
      es: "La chaqueta del taller: cuello alzado, cremallera completa y taping en mangas.",
      gl: "A chaqueta do taller: pescozo alzado, cremalleira completa e taping nas mangas.",
      en: "The workshop jacket: stand collar, full-length zip and taped sleeves.",
    },
    keywords: {
      es: ["chaqueta de trabajo", "chaqueta taller", "cuello alzado"],
      gl: ["chaqueta de traballo", "chaqueta taller", "pescozo alzado"],
      en: ["work jacket", "studio jacket", "stand collar"],
    },
    category: "chaquetas",
    collection: "court-series",
    shape: "jacket",
    print: "none",
    price: 10995,
    colors: ["marino", "negro", "electrico"],
    rating: 4.6,
    reviews: 134,
    arrived: 90,
    authors: [["iria-seoane", { es: "Patronaje", gl: "Patronaxe", en: "Pattern cutting" }]],
  },
  {
    ref: "GO-018",
    slug: { es: "bomber-away-days", gl: "bomber-away-days", en: "away-days-bomber" },
    name: { es: "Bomber Away Days", gl: "Bomber Away Days", en: "Away Days Bomber" },
    description: {
      es: "Bomber acolchada con forro térmico y escudo bordado en la espalda.",
      gl: "Bomber acolchada con forro térmico e escudo bordado nas costas.",
      en: "Padded bomber with a thermal lining and an embroidered crest on the back.",
    },
    keywords: {
      es: ["bomber acolchada", "chaqueta invierno", "escudo bordado"],
      gl: ["bomber acolchada", "chaqueta inverno", "escudo bordado"],
      en: ["padded bomber", "winter jacket", "embroidered crest"],
    },
    category: "chaquetas",
    collection: "away-days",
    shape: "jacket",
    print: "none",
    price: 13995,
    compareAt: 16995,
    colors: ["negro", "verde"],
    soldOut: ["XS"],
    rating: 4.8,
    reviews: 76,
    arrived: 93,
    authors: [
      ["noa-vilarino", { es: "Dirección de arte", gl: "Dirección de arte", en: "Art direction" }],
      ["iria-seoane", { es: "Patronaje", gl: "Patronaxe", en: "Pattern cutting" }],
    ],
  },
  {
    ref: "GO-019",
    slug: { es: "cortavientos-training-lab", gl: "cortaventos-training-lab", en: "training-lab-windbreaker" },
    name: {
      es: "Cortavientos Training Lab",
      gl: "Cortaventos Training Lab",
      en: "Training Lab Windbreaker",
    },
    description: {
      es: "Ripstop ligero, repelente al agua y plegable en su propio bolsillo.",
      gl: "Ripstop lixeiro, repelente á auga e pregable no seu propio peto.",
      en: "Lightweight ripstop, water-repellent and packable into its own pocket.",
    },
    keywords: {
      es: ["cortavientos", "ripstop", "chaqueta ligera"],
      gl: ["cortaventos", "ripstop", "chaqueta lixeira"],
      en: ["windbreaker", "ripstop", "packable jacket"],
    },
    category: "chaquetas",
    collection: "training-lab",
    shape: "jacket",
    print: "none",
    price: 8995,
    colors: ["electrico", "negro", "naranja"],
    rating: 4.3,
    reviews: 58,
    arrived: 82,
    authors: [["xabier-lema", { es: "Desarrollo técnico", gl: "Desenvolvemento técnico", en: "Technical development" }]],
  },
  {
    ref: "GO-020",
    slug: { es: "short-serie-estudio", gl: "short-serie-estudio", en: "studio-series-shorts" },
    name: {
      es: "Short Serie Estudio",
      gl: "Short Serie Estudio",
      en: "Studio Series Shorts",
    },
    description: {
      es: "Short de taller con cintura elástica, cordón oculto y taping lateral.",
      gl: "Short de taller con cintura elástica, cordón oculto e taping lateral.",
      en: "Workshop shorts with an elastic waistband, hidden drawcord and side taping.",
    },
    keywords: {
      es: ["short serigrafiado", "short de taller", "pantalón corto"],
      gl: ["short serigrafiado", "short de taller", "pantalón curto"],
      en: ["screen printed shorts", "workshop shorts", "studio shorts"],
    },
    category: "pantalones",
    collection: "court-series",
    shape: "shorts",
    print: "wordmark",
    price: 4995,
    colors: ["electrico", "negro", "blanco"],
    rating: 4.7,
    reviews: 267,
    arrived: 91,
    bestseller: true,
    authors: [["iria-seoane", { es: "Patronaje", gl: "Patronaxe", en: "Pattern cutting" }]],
  },
  {
    ref: "GO-021",
    slug: { es: "short-archivo-94", gl: "short-arquivo-94", en: "archive-94-shorts" },
    name: { es: "Short Archivo 94", gl: "Short Arquivo 94", en: "Archive 94 Shorts" },
    description: {
      es: "Largo por encima de la rodilla y bloque de color en la pernera.",
      gl: "Longo por riba do xeonllo e bloque de cor na perna.",
      en: "Above-the-knee length with colour blocking down the leg.",
    },
    keywords: {
      es: ["short retro", "bloque de color", "archivo 94"],
      gl: ["short retro", "bloque de cor", "arquivo 94"],
      en: ["retro shorts", "colour block", "archive 94"],
    },
    category: "pantalones",
    collection: "hardwood-94",
    shape: "shorts",
    print: "wordmark",
    price: 4495,
    compareAt: 5495,
    colors: ["arena", "granate", "marino"],
    rating: 4.5,
    reviews: 121,
    arrived: 76,
    authors: [["brais-carballo", { es: "Ilustración", gl: "Ilustración", en: "Illustration" }]],
  },
  {
    ref: "GO-022",
    slug: { es: "jogger-training-lab", gl: "jogger-training-lab", en: "training-lab-jogger" },
    name: { es: "Jogger Training Lab", gl: "Jogger Training Lab", en: "Training Lab Jogger" },
    description: {
      es: "Jogger de punto técnico con bajo elástico y bolsillo con cremallera.",
      gl: "Jogger de punto técnico con baixo elástico e peto con cremalleira.",
      en: "Technical knit jogger with an elasticated hem and a zipped pocket.",
    },
    keywords: {
      es: ["jogger", "pantalón técnico", "bajo elástico"],
      gl: ["jogger", "pantalón técnico", "baixo elástico"],
      en: ["jogger", "technical trousers", "cuffed hem"],
    },
    category: "pantalones",
    collection: "training-lab",
    shape: "shorts",
    print: "monogram",
    price: 6495,
    colors: ["negro", "gris", "verde"],
    rating: 4.6,
    reviews: 189,
    arrived: 87,
    authors: [["xabier-lema", { es: "Desarrollo técnico", gl: "Desenvolvemento técnico", en: "Technical development" }]],
  },
  {
    ref: "GO-023",
    slug: { es: "short-junior-serie-estudio", gl: "short-junior-serie-estudio", en: "studio-series-junior-shorts" },
    name: {
      es: "Short Junior Serie Estudio",
      gl: "Short Junior Serie Estudio",
      en: "Studio Series Junior Shorts",
    },
    description: {
      es: "Versión infantil del short de taller, con cintura ajustable.",
      gl: "Versión infantil do short de taller, con cintura axustable.",
      en: "Kids' version of the workshop shorts, with an adjustable waistband.",
    },
    keywords: {
      es: ["short niño", "arte infantil", "cintura ajustable"],
      gl: ["short neno", "arte infantil", "cintura axustable"],
      en: ["kids shorts", "kids art", "adjustable waist"],
    },
    category: "pantalones",
    collection: "court-series",
    audience: "ninos",
    shape: "shorts",
    print: "wordmark",
    price: 3195,
    colors: ["electrico", "negro"],
    rating: 4.4,
    reviews: 52,
    arrived: 66,
    authors: [["iria-seoane", { es: "Patronaje", gl: "Patronaxe", en: "Pattern cutting" }]],
  },
  {
    ref: "GO-024",
    slug: { es: "gorra-snapback-serie-estudio", gl: "gorra-snapback-serie-estudio", en: "studio-series-snapback" },
    name: {
      es: "Gorra Snapback Serie Estudio",
      gl: "Gorra Snapback Serie Estudio",
      en: "Studio Series Snapback",
    },
    description: {
      es: "Corona estructurada de seis paneles, visera plana y cierre snapback.",
      gl: "Coroa estruturada de seis paneis, viseira plana e peche snapback.",
      en: "Structured six-panel crown, flat brim and snapback closure.",
    },
    keywords: {
      es: ["gorra snapback", "visera plana", "gorra negra"],
      gl: ["gorra snapback", "viseira plana", "gorra negra"],
      en: ["snapback cap", "flat brim", "black cap"],
    },
    category: "gorras",
    collection: "court-series",
    shape: "cap",
    print: "monogram",
    price: 2995,
    colors: ["negro", "electrico", "blanco", "granate"],
    rating: 4.8,
    reviews: 344,
    arrived: 94,
    bestseller: true,
    authors: [["noa-vilarino", { es: "Diseño gráfico", gl: "Deseño gráfico", en: "Graphic design" }]],
  },
  {
    ref: "GO-025",
    slug: { es: "gorra-trucker-away-days", gl: "gorra-trucker-away-days", en: "away-days-trucker" },
    name: { es: "Gorra Trucker Away Days", gl: "Gorra Trucker Away Days", en: "Away Days Trucker" },
    description: {
      es: "Frontal de sarga con espalda de malla y parche bordado.",
      gl: "Fronte de sarxa con costas de malla e parche bordado.",
      en: "Twill front with a mesh back and an embroidered patch.",
    },
    keywords: {
      es: ["gorra trucker", "gorra malla", "parche bordado"],
      gl: ["gorra trucker", "gorra malla", "parche bordado"],
      en: ["trucker cap", "mesh cap", "embroidered patch"],
    },
    category: "gorras",
    collection: "away-days",
    shape: "cap",
    print: "wordmark",
    price: 2495,
    compareAt: 2995,
    colors: ["hueso", "negro", "verde"],
    rating: 4.5,
    reviews: 156,
    arrived: 89,
    authors: [["brais-carballo", { es: "Ilustración", gl: "Ilustración", en: "Illustration" }]],
  },
  {
    ref: "GO-026",
    slug: { es: "dad-hat-monograma", gl: "dad-hat-monograma", en: "monogram-dad-hat" },
    name: { es: "Dad Hat Monograma", gl: "Dad Hat Monograma", en: "Monogram Dad Hat" },
    description: {
      es: "Corona blanda sin estructurar, visera curvada y correa metálica.",
      gl: "Coroa branda sen estruturar, viseira curvada e correa metálica.",
      en: "Unstructured soft crown, curved brim and metal strap.",
    },
    keywords: {
      es: ["dad hat", "gorra sin estructura", "visera curvada"],
      gl: ["dad hat", "gorra sen estrutura", "viseira curvada"],
      en: ["dad hat", "unstructured cap", "curved brim"],
    },
    category: "gorras",
    collection: "origen",
    shape: "cap",
    print: "monogram",
    price: 2695,
    colors: ["arena", "marino", "negro"],
    rating: 4.6,
    reviews: 98,
    arrived: 85,
    authors: [["noa-vilarino", { es: "Diseño gráfico", gl: "Deseño gráfico", en: "Graphic design" }]],
  },
  {
    ref: "GO-027",
    slug: { es: "gorro-beanie-origen", gl: "gorro-beanie-orixe", en: "origin-beanie" },
    name: { es: "Gorro Beanie Origen", gl: "Gorro Beanie Orixe", en: "Origin Beanie" },
    description: {
      es: "Canalé grueso con vuelta doble y etiqueta tejida.",
      gl: "Canelé groso con volta dobre e etiqueta tecida.",
      en: "Chunky rib with a double turn-up and a woven label.",
    },
    keywords: {
      es: ["gorro beanie", "gorro lana", "canalé grueso"],
      gl: ["gorro beanie", "gorro la", "canelé groso"],
      en: ["beanie", "knit hat", "chunky rib"],
    },
    category: "gorras",
    collection: "origen",
    shape: "beanie",
    print: "wordmark",
    price: 2295,
    colors: ["granate", "negro", "hueso"],
    rating: 4.7,
    reviews: 132,
    arrived: 79,
    authors: [["brais-carballo", { es: "Ilustración", gl: "Ilustración", en: "Illustration" }]],
  },
  {
    ref: "GO-028",
    slug: { es: "tote-bag-serie-estudio", gl: "tote-bag-serie-estudio", en: "studio-series-tote-bag" },
    name: { es: "Tote Bag Serie Estudio", gl: "Tote Bag Serie Estudio", en: "Studio Series Tote Bag" },
    description: {
      es: "Lona de 340 g con asas reforzadas y fondo plano.",
      gl: "Lona de 340 g con asas reforzadas e fondo plano.",
      en: "340 gsm canvas with reinforced handles and a flat base.",
    },
    keywords: {
      es: ["tote bag", "bolsa lona", "bolsa serigrafiada"],
      gl: ["tote bag", "bolsa lona", "bolsa serigrafiada"],
      en: ["tote bag", "canvas bag", "screen printed bag"],
    },
    category: "accesorios",
    collection: "court-series",
    shape: "tote",
    print: "wordmark",
    price: 1995,
    colors: ["hueso", "negro"],
    rating: 4.7,
    reviews: 211,
    arrived: 83,
    bestseller: true,
    authors: [["noa-vilarino", { es: "Diseño gráfico", gl: "Deseño gráfico", en: "Graphic design" }]],
  },
  {
    ref: "GO-029",
    slug: { es: "botella-termica-750-ml", gl: "botella-termica-750-ml", en: "insulated-bottle-750-ml" },
    name: {
      es: "Botella Térmica 750 ml",
      gl: "Botella Térmica 750 ml",
      en: "Insulated Bottle 750 ml",
    },
    description: {
      es: "Acero inoxidable de doble pared: 12 h de frío, 6 h de calor.",
      gl: "Aceiro inoxidable de dobre parede: 12 h de frío, 6 h de calor.",
      en: "Double-walled stainless steel: 12 h cold, 6 h hot.",
    },
    keywords: {
      es: ["botella térmica", "acero inoxidable", "botella deporte"],
      gl: ["botella térmica", "aceiro inoxidable", "botella deporte"],
      en: ["insulated bottle", "stainless steel", "sports bottle"],
    },
    category: "accesorios",
    collection: "training-lab",
    shape: "bottle",
    print: "monogram",
    price: 2795,
    compareAt: 3295,
    colors: ["negro", "electrico", "blanco"],
    rating: 4.6,
    reviews: 174,
    arrived: 81,
    authors: [["xabier-lema", { es: "Desarrollo técnico", gl: "Desenvolvemento técnico", en: "Technical development" }]],
  },
  {
    ref: "GO-030",
    slug: { es: "original-tinta-serie-estudio", gl: "orixinal-tinta-serie-estudio", en: "studio-series-ink-original" },
    name: {
      es: "Original Tinta Serie Estudio",
      gl: "Orixinal Tinta Serie Estudio",
      en: "Studio Series Ink Original",
    },
    description: {
      es: "Tinta sobre papel de algodón, 50 × 70 cm. Pintado a mano en el taller y firmado al dorso: ninguno sale igual que el anterior.",
      gl: "Tinta sobre papel de algodón, 50 × 70 cm. Pintado a man no taller e asinado no reverso: ningún sae igual que o anterior.",
      en: "Ink on cotton paper, 50 × 70 cm. Painted by hand in the workshop and signed on the back: no two come out alike.",
    },
    keywords: {
      es: ["obra original", "tinta sobre papel", "pintado a mano"],
      gl: ["obra orixinal", "tinta sobre papel", "pintado a man"],
      en: ["original artwork", "ink on paper", "hand painted"],
    },
    category: "originales",
    collection: "court-series",
    shape: "poster",
    print: "none",
    // Sold to be hung, so it gets the framed preview and the wall view.
    frame: { finishes: ["black", "white", "wood"], mount: 10, width: 50, height: 70 },
    price: 3995,
    colors: ["naranja", "negro"],
    rating: 4.8,
    reviews: 263,
    arrived: 77,
    bestseller: true,
    authors: [
      ["brais-carballo", { es: "Obra original", gl: "Obra orixinal", en: "Original artwork" }],
    ],
  },
  {
    ref: "GO-031",
    slug: { es: "original-gouache-archivo-94", gl: "orixinal-gouache-arquivo-94", en: "archive-94-gouache-original" },
    name: {
      es: "Original Gouache Archivo 94",
      gl: "Orixinal Gouache Arquivo 94",
      en: "Archive 94 Gouache Original",
    },
    description: {
      es: "Gouache sobre papel de archivo, 40 × 50 cm. Recupera la paleta de los carteles del 94 en una pieza pintada a mano.",
      gl: "Gouache sobre papel de arquivo, 40 × 50 cm. Recupera a paleta dos carteis do 94 nunha peza pintada a man.",
      en: "Gouache on archival paper, 40 × 50 cm. The palette of the 1994 posters, in a piece painted by hand.",
    },
    keywords: {
      es: ["obra original", "gouache", "papel de archivo"],
      gl: ["obra orixinal", "gouache", "papel de arquivo"],
      en: ["original artwork", "gouache", "archival paper"],
    },
    category: "originales",
    collection: "hardwood-94",
    shape: "poster",
    print: "none",
    frame: { finishes: ["black", "wood"], mount: 8, width: 40, height: 50 },
    price: 4995,
    colors: ["arena", "naranja"],
    rating: 4.7,
    reviews: 84,
    arrived: 72,
    authors: [
      ["noa-vilarino", { es: "Obra original", gl: "Obra orixinal", en: "Original artwork" }],
    ],
  },
  {
    ref: "GO-032",
    slug: { es: "poster-serigrafiado-origen", gl: "cartel-serigrafiado-orixe", en: "origin-screen-print-poster" },
    name: {
      es: "Póster Serigrafiado Origen",
      gl: "Cartel Serigrafiado Orixe",
      en: "Origin Screen-Print Poster",
    },
    description: {
      es: "50 × 70 cm serigrafiado a tres tintas, numerado y firmado a mano.",
      gl: "50 × 70 cm serigrafiado a tres tintas, numerado e asinado a man.",
      en: "50 × 70 cm, three-colour screen print, hand-numbered and signed.",
    },
    keywords: {
      es: ["póster serigrafiado", "lámina numerada", "50x70"],
      gl: ["cartel serigrafiado", "lámina numerada", "50x70"],
      en: ["screen print poster", "numbered print", "50x70"],
    },
    category: "cuadros",
    collection: "origen",
    shape: "poster",
    print: "none",
    // 50 × 70, as the description says. The camera view hangs it at that size.
    frame: { finishes: ["black", "white", "wood"], mount: 10, width: 50, height: 70 },
    price: 3500,
    colors: ["granate", "marino", "negro"],
    rating: 4.9,
    reviews: 47,
    arrived: 100,
    exclusive: true,
    authors: [
      ["brais-carballo", { es: "Ilustración y serigrafía", gl: "Ilustración e serigrafía", en: "Illustration & printing" }],
      ["marta-ferreiro", { es: "Fotografía de referencia", gl: "Fotografía de referencia", en: "Reference photography" }],
    ],
  },
  {
    ref: "GO-033",
    slug: { es: "poster-archivo-94", gl: "cartel-arquivo-94", en: "archive-94-poster" },
    name: { es: "Póster Archivo 94", gl: "Cartel Arquivo 94", en: "Archive 94 Poster" },
    description: {
      es: "Reproducción del cartel original de 1994 en papel de 300 g.",
      gl: "Reprodución do cartel orixinal de 1994 en papel de 300 g.",
      en: "Reproduction of the original 1994 poster on 300 gsm paper.",
    },
    keywords: {
      es: ["cartel retro", "póster años 90", "archivo 94"],
      gl: ["cartel retro", "cartel anos 90", "arquivo 94"],
      en: ["retro poster", "nineties print", "archive 94"],
    },
    category: "cuadros",
    collection: "hardwood-94",
    shape: "poster",
    print: "none",
    // Landscape: a reproduction of a wide format poster, and the one piece in the
    // catalogue that exercises a horizontal cuadro end to end.
    frame: { finishes: ["black", "wood"], mount: 8, width: 70, height: 50 },
    price: 2900,
    compareAt: 3500,
    colors: ["arena", "morado"],
    rating: 4.5,
    reviews: 33,
    arrived: 70,
    authors: [["marta-ferreiro", { es: "Fotografía", gl: "Fotografía", en: "Photography" }]],
  },
];

/* ==========================================================================
   Emit
   ========================================================================== */

const lines = [];
const say = (line = "") => lines.push(line);

say("-- ============================================================================");
say("-- GENERATED FILE — do not edit by hand.");
say("-- Regenerate with:  node scripts/generate-seed.mjs");
say("--");
say("-- Development seed for the Guille Outes catalogue (es / gl / en).");
say("-- Authors and their bibliographies are sample records: replace before launch.");
say("-- ============================================================================");
say();
say("begin;");
say();
say("-- Idempotent: wipe the catalogue, keep auth users and profiles untouched.");
say("truncate table public.product_authors, public.product_images, public.product_variants,");
say("               public.products, public.author_works, public.authors,");
say("               public.collections, public.categories restart identity cascade;");
say();

say("-- ---------------------------------------------------------------- categories");
categories.forEach((c, i) => {
  say(
    `insert into public.categories (id, slug, name, heading, blurb, keywords, position) values (${q(c.id)}, ${j(c.slug)}, ${j(c.name)}, ${j(c.heading)}, ${j(c.blurb)}, ${j(c.keywords)}, ${i});`,
  );
});
say();

say("-- --------------------------------------------------------------- collections");
collections.forEach((c, i) => {
  say(
    `insert into public.collections (id, slug, name, tagline, blurb, keywords, accent, position) values (${q(c.id)}, ${j(c.slug)}, ${j(c.name)}, ${j(c.tagline)}, ${j(c.blurb)}, ${j(c.keywords)}, ${q(c.accent)}, ${i});`,
  );
});
say();

say("-- ------------------------------------------------------------------- authors");
authors.forEach((a, i) => {
  say(
    `insert into public.authors (id, slug, name, role, bio, statement, links, keywords, position) values (${q(authorId(a.key))}, ${j(a.slug)}, ${q(a.name)}, ${j(a.role)}, ${j(a.bio)}, ${j(a.statement)}, ${j(a.links)}, ${j(a.keywords)}, ${i});`,
  );
  a.works.forEach((w, k) => {
    say(
      `insert into public.author_works (id, author_id, year, title, publisher, kind, url, note, position) values (${q(uuid("work", `${a.key}:${w.title}`))}, ${q(authorId(a.key))}, ${w.year ?? "null"}, ${q(w.title)}, ${q(w.publisher ?? null)}, ${q(w.kind)}, ${q(w.url ?? null)}, ${j(w.note ?? null)}, ${k});`,
    );
  });
});
say();

say("-- ------------------------------------------------------------------ products");
const categoryById = new Map(categories.map((c) => [c.id, c]));

for (const p of products) {
  const id = uuid("product", p.ref);
  const category = categoryById.get(p.category);
  if (!category) throw new Error(`Unknown category ${p.category} on ${p.ref}`);

  const details = p.details ?? category.details;
  const audience = p.audience ?? "unisex";
  const sizes = sizesFor({ ...p, audience });
  const soldOut = new Set(p.soldOut ?? []);

  say(`-- ${p.ref} · ${p.name.es}`);
  say(
    `insert into public.products (id, ref, slug, name, description, details, keywords, category_id, collection_id, audience, shape, print, frame_preview, artwork_printable, price_cents, compare_at_cents, colorways, rating, reviews, bestseller, exclusive, arrived) values (` +
      [
        q(id),
        q(p.ref),
        j(p.slug),
        j(p.name),
        j(p.description),
        j(details),
        j(p.keywords),
        q(p.category),
        q(p.collection),
        `${q(audience)}::public.audience`,
        `${q(p.shape)}::public.art_shape`,
        `${q(p.print ?? "wordmark")}::public.art_print`,
        // No `frame` means not sold framed, which the storefront reads as an
        // empty object rather than as null.
        j(p.frame ? { enabled: true, ...p.frame } : {}),
        // Whether a drawing from the children's gallery can be printed on it.
        // Off unless a product says otherwise: the print area and the process
        // are not the same on every garment.
        p.printable ? "true" : "false",
        p.price,
        p.compareAt ?? "null",
        j(p.colors),
        p.rating,
        p.reviews,
        p.bestseller ? "true" : "false",
        p.exclusive ? "true" : "false",
        p.arrived,
      ].join(", ") +
      `);`,
  );

  // One stock row per size × colourway.
  let position = 0;
  for (const color of p.colors) {
    for (const size of sizes) {
      const sku = `${p.ref}-${color}-${size}`.toUpperCase().replace(/[^A-Z0-9-]/g, "");
      const stock = soldOut.has(size) ? 0 : stockFor(sku);
      say(
        `insert into public.product_variants (id, product_id, size, colorway_id, sku, stock, position) values (${q(uuid("variant", sku))}, ${q(id)}, ${q(size)}, ${q(color)}, ${q(sku)}, ${stock}, ${position});`,
      );
      position += 1;
    }
  }

  for (const [key, role] of p.authors ?? []) {
    const index = (p.authors ?? []).findIndex(([k]) => k === key);
    say(
      `insert into public.product_authors (product_id, author_id, role, position) values (${q(id)}, ${q(authorId(key))}, ${j(role)}, ${index});`,
    );
  }
  say();
}

say("commit;");
say();

writeFileSync(OUT, lines.join("\n"), "utf8");

const variantCount = products.reduce(
  (total, p) =>
    total + p.colors.length * sizesFor({ ...p, audience: p.audience ?? "unisex" }).length,
  0,
);

console.log(
  `Wrote ${OUT}\n  ${categories.length} categories, ${collections.length} collections, ` +
    `${authors.length} authors, ${authors.reduce((n, a) => n + a.works.length, 0)} works, ` +
    `${products.length} products, ${variantCount} variants`,
);
