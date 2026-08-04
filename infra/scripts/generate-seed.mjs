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

const ONE_SIZE_CATEGORIES = new Set(["gorras", "accesorios", "balones", "coleccionismo"]);

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
      es: ["camiseta baloncesto", "camiseta algodón", "camiseta oversize", "camiseta serigrafiada"],
      gl: ["camiseta baloncesto", "camiseta algodón", "camiseta oversize", "camiseta serigrafiada"],
      en: ["basketball t-shirt", "cotton tee", "oversize tee", "screen printed tee"],
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
      es: ["sudadera capucha", "hoodie oversize", "sudadera baloncesto", "felpa"],
      gl: ["sudadoira capucha", "hoodie oversize", "sudadoira baloncesto", "felpa"],
      en: ["hoodie", "oversize hoodie", "basketball sweatshirt", "fleece"],
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
      es: "Capas exteriores para el calentamiento y para la calle.",
      gl: "Capas exteriores para o quecemento e para a rúa.",
      en: "Outer layers for the warm-up and for the street.",
    },
    keywords: {
      es: ["chaqueta calentamiento", "bomber", "cortavientos", "chaqueta baloncesto"],
      gl: ["chaqueta quecemento", "bomber", "cortaventos", "chaqueta baloncesto"],
      en: ["warm-up jacket", "bomber", "windbreaker", "basketball jacket"],
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
      es: "Shorts de juego, joggers y tejidos técnicos con cintura elástica.",
      gl: "Shorts de xogo, joggers e tecidos técnicos con cintura elástica.",
      en: "Game shorts, joggers and technical fabrics with elastic waistbands.",
    },
    keywords: {
      es: ["short baloncesto", "jogger", "pantalón corto", "short de juego"],
      gl: ["short baloncesto", "jogger", "pantalón curto", "short de xogo"],
      en: ["basketball shorts", "jogger", "game shorts", "training shorts"],
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
      es: "Tote bags de lona, botellas térmicas y los extras del día de partido.",
      gl: "Tote bags de lona, botellas térmicas e os extras do día de partido.",
      en: "Canvas tote bags, insulated bottles and game-day extras.",
    },
    keywords: {
      es: ["tote bag", "botella térmica", "bolsa lona", "accesorios baloncesto"],
      gl: ["tote bag", "botella térmica", "bolsa lona", "accesorios baloncesto"],
      en: ["tote bag", "insulated bottle", "canvas bag", "basketball accessories"],
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
    id: "balones",
    slug: { es: "balones", gl: "balons", en: "basketballs" },
    name: { es: "Balones", gl: "Balóns", en: "Basketballs" },
    heading: { es: "Balones", gl: "Balóns", en: "Basketballs" },
    blurb: {
      es: "Cuero compuesto, agarre profundo y talla oficial.",
      gl: "Coiro composto, agarre profundo e talla oficial.",
      en: "Composite leather, deep grip and official sizing.",
    },
    keywords: {
      es: ["balón baloncesto", "balón talla 7", "balón indoor", "pelota baloncesto"],
      gl: ["balón baloncesto", "balón talla 7", "balón indoor", "pelota baloncesto"],
      en: ["basketball", "size 7 basketball", "indoor basketball", "outdoor basketball"],
    },
    details: {
      es: [
        "Cuero compuesto con agarre profundo",
        "Cámara de butilo",
        "Uso interior y exterior",
        "Se envía sin inflar",
      ],
      gl: [
        "Coiro composto con agarre profundo",
        "Cámara de butilo",
        "Uso interior e exterior",
        "Envíase sen inflar",
      ],
      en: [
        "Composite leather with deep channel grip",
        "Butyl bladder",
        "Indoor and outdoor use",
        "Ships deflated",
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
      es: ["póster serigrafiado", "edición limitada", "lámina numerada", "arte baloncesto"],
      gl: ["cartel serigrafiado", "edición limitada", "lámina numerada", "arte baloncesto"],
      en: ["screen print poster", "limited edition", "numbered print", "basketball art"],
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
    id: "court-series",
    slug: { es: "court-series", gl: "court-series", en: "court-series" },
    name: { es: "Court Series", gl: "Court Series", en: "Court Series" },
    tagline: { es: "La línea de pista", gl: "A liña de pista", en: "The on-court line" },
    blurb: {
      es: "La base del vestuario: camisetas de juego, shorts a conjunto y capas de calentamiento con el logo aplicado en tono sobre tono.",
      gl: "A base do vestiario: camisetas de xogo, shorts a conxunto e capas de quecemento co logo aplicado en ton sobre ton.",
      en: "The core kit: game jerseys, matching shorts and warm-up layers with a tonal applied logo.",
    },
    keywords: {
      es: ["equipación baloncesto", "camiseta de juego", "court series"],
      gl: ["equipación baloncesto", "camiseta de xogo", "court series"],
      en: ["basketball kit", "game jersey", "court series"],
    },
    accent: "#1d4ed8",
  },
  {
    id: "hardwood-94",
    slug: { es: "hardwood-94", gl: "hardwood-94", en: "hardwood-94" },
    name: { es: "Hardwood 94", gl: "Hardwood 94", en: "Hardwood 94" },
    tagline: { es: "Archivo noventero", gl: "Arquivo dos noventa", en: "Nineties archive" },
    blurb: {
      es: "Paleta de parqué, tipografía condensada y bloques de color rescatados del archivo de 1994.",
      gl: "Paleta de parqué, tipografía condensada e bloques de cor rescatados do arquivo de 1994.",
      en: "Hardwood palette, condensed type and colour blocking pulled from the 1994 archive.",
    },
    keywords: {
      es: ["retro baloncesto", "años 90", "vintage baloncesto"],
      gl: ["retro baloncesto", "anos 90", "vintage baloncesto"],
      en: ["retro basketball", "nineties", "vintage basketball"],
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
      es: ["oversize", "streetwear baloncesto", "ropa lavada"],
      gl: ["oversize", "streetwear baloncesto", "roupa lavada"],
      en: ["oversize", "basketball streetwear", "garment dyed"],
    },
    accent: "#141414",
  },
  {
    id: "training-lab",
    slug: { es: "training-lab", gl: "training-lab", en: "training-lab" },
    name: { es: "Training Lab", gl: "Training Lab", en: "Training Lab" },
    tagline: { es: "Tejidos técnicos", gl: "Tecidos técnicos", en: "Technical fabrics" },
    blurb: {
      es: "Punto de secado rápido, costuras planas y piezas que aguantan la sesión doble.",
      gl: "Punto de secado rápido, costuras planas e pezas que aguantan a sesión dobre.",
      en: "Quick-dry knits, flatlock seams and pieces that survive a double session.",
    },
    keywords: {
      es: ["ropa técnica", "entrenamiento", "secado rápido"],
      gl: ["roupa técnica", "adestramento", "secado rápido"],
      en: ["technical apparel", "training", "quick dry"],
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
      es: "Dirige la identidad visual de las colecciones y firma la mayoría de los grafismos de pista.",
      gl: "Dirixe a identidade visual das coleccións e asina a maioría dos grafismos de pista.",
      en: "Leads the visual identity of the collections and signs most of the on-court graphics.",
    },
    statement: {
      es: "Trabajo con tipografía condensada y bloques de color porque una camiseta se lee a treinta metros, no a treinta centímetros.",
      gl: "Traballo con tipografía condensada e bloques de cor porque unha camiseta lese a trinta metros, non a trinta centímetros.",
      en: "I work with condensed type and colour blocks because a jersey is read from thirty metres away, not thirty centimetres.",
    },
    links: [
      { label: "Instagram", url: "https://instagram.com" },
      { label: "Portfolio", url: "https://example.com" },
    ],
    keywords: {
      es: ["dirección de arte", "tipografía condensada", "diseño deportivo"],
      gl: ["dirección de arte", "tipografía condensada", "deseño deportivo"],
      en: ["art direction", "condensed typography", "sports design"],
    },
    works: [
      {
        year: 2024,
        title: "Court Type: rótulos de pista en la liga gallega",
        publisher: "Edicións Rúa",
        kind: "book",
        url: "https://example.com/court-type",
        note: {
          es: "Ensayo fotográfico sobre la rotulación de pabellones municipales.",
          gl: "Ensaio fotográfico sobre a rotulación de pavillóns municipais.",
          en: "Photographic essay on the signage of municipal sports halls.",
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
        title: "Hardwood: un archivo de parqué",
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
        title: "Origen: cien láminas de pista",
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
      es: "Responsable de patrones y escalado de tallas. Prueba cada prenda en pista antes de aprobarla.",
      gl: "Responsable de patróns e escalado de tallas. Proba cada peza en pista antes de aprobala.",
      en: "Responsible for patterns and size grading. Tests every garment on court before signing it off.",
    },
    statement: {
      es: "Una sisa mal resuelta se nota en el primer tiro. El resto son detalles.",
      gl: "Unha sisa mal resolta nótase no primeiro tiro. O resto son detalles.",
      en: "A badly cut armhole shows on the first shot. Everything else is detail.",
    },
    links: [{ label: "LinkedIn", url: "https://linkedin.com" }],
    keywords: {
      es: ["patronaje", "escalado de tallas", "ropa deportiva"],
      gl: ["patronaxe", "escalado de tallas", "roupa deportiva"],
      en: ["pattern cutting", "size grading", "sportswear"],
    },
    works: [
      {
        year: 2024,
        title: "Escalado de tallas para prendas de equipo",
        publisher: "Cadernos Téxtiles",
        kind: "article",
      },
      {
        year: 2020,
        title: "Del patrón plano a la pista",
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
      es: "Prefiero la luz del pabellón a la del estudio. Miente menos.",
      gl: "Prefiro a luz do pavillón á do estudio. Mente menos.",
      en: "I prefer sports-hall light to studio light. It lies less.",
    },
    links: [{ label: "Instagram", url: "https://instagram.com" }],
    keywords: {
      es: ["fotografía deportiva", "campaña", "documental"],
      gl: ["fotografía deportiva", "campaña", "documental"],
      en: ["sports photography", "campaign", "documentary"],
    },
    works: [
      {
        year: 2024,
        title: "Pabellones",
        publisher: "Galería Atlántica",
        kind: "exhibition",
        note: {
          es: "Serie de 40 fotografías en polideportivos de A Coruña.",
          gl: "Serie de 40 fotografías en polideportivos da Coruña.",
          en: "Series of 40 photographs in sports centres around A Coruña.",
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
      es: "camiseta-court-series-logo",
      gl: "camiseta-court-series-logo",
      en: "court-series-logo-tee",
    },
    name: {
      es: "Camiseta Court Series Logo",
      gl: "Camiseta Court Series Logo",
      en: "Court Series Logo Tee",
    },
    description: {
      es: "La camiseta de todos los días de la línea de pista: algodón peinado de 220 g, caída recta y logotipo serigrafiado en el centro del pecho.",
      gl: "A camiseta de todos os días da liña de pista: algodón peiteado de 220 g, caída recta e logotipo serigrafiado no centro do peito.",
      en: "The everyday tee from the on-court line: 220 gsm combed cotton, straight drape and a screen-printed chest logo.",
    },
    keywords: {
      es: ["camiseta court series", "camiseta logo", "camiseta baloncesto negra"],
      gl: ["camiseta court series", "camiseta logo", "camiseta baloncesto negra"],
      en: ["court series tee", "logo t-shirt", "black basketball tee"],
    },
    category: "camisetas",
    collection: "court-series",
    shape: "tee",
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
    slug: { es: "camiseta-hardwood-94", gl: "camiseta-hardwood-94", en: "hardwood-94-tee" },
    name: { es: "Camiseta Hardwood 94", gl: "Camiseta Hardwood 94", en: "Hardwood 94 Tee" },
    description: {
      es: "Reedición del algodón de 1994: tono parqué, cuello alto de canalé y bloque tipográfico condensado.",
      gl: "Reedición do algodón de 1994: ton parqué, pescozo alto de canelé e bloque tipográfico condensado.",
      en: "A reissue of the 1994 cotton tee: hardwood tone, high ribbed collar and a condensed type block.",
    },
    keywords: {
      es: ["camiseta retro", "camiseta años 90", "hardwood"],
      gl: ["camiseta retro", "camiseta anos 90", "hardwood"],
      en: ["retro tee", "nineties t-shirt", "hardwood"],
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
      es: "camiseta-cropped-court-series",
      gl: "camiseta-cropped-court-series",
      en: "court-series-cropped-tee",
    },
    name: {
      es: "Camiseta Cropped Court Series",
      gl: "Camiseta Cropped Court Series",
      en: "Court Series Cropped Tee",
    },
    description: {
      es: "Largo cropped con bajo recto y logotipo reducido en el pecho izquierdo.",
      gl: "Longo cropped con baixo recto e logotipo reducido no peito esquerdo.",
      en: "Cropped length with a straight hem and a small logo on the left chest.",
    },
    keywords: {
      es: ["camiseta cropped", "camiseta corta mujer", "court series"],
      gl: ["camiseta cropped", "camiseta curta muller", "court series"],
      en: ["cropped tee", "women's short tee", "court series"],
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
      es: "camiseta-junior-court-series",
      gl: "camiseta-junior-court-series",
      en: "court-series-junior-tee",
    },
    name: {
      es: "Camiseta Junior Court Series",
      gl: "Camiseta Junior Court Series",
      en: "Court Series Junior Tee",
    },
    description: {
      es: "La misma camiseta de la primera plantilla, en tallas de 4 a 14 años.",
      gl: "A mesma camiseta do primeiro equipo, en tallas de 4 a 14 anos.",
      en: "The same tee as the first team, in sizes from 4 to 14 years.",
    },
    keywords: {
      es: ["camiseta niño", "baloncesto infantil", "court series junior"],
      gl: ["camiseta neno", "baloncesto infantil", "court series junior"],
      en: ["kids t-shirt", "youth basketball", "court series junior"],
    },
    category: "camisetas",
    collection: "court-series",
    audience: "ninos",
    shape: "tee",
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
      es: "sudadera-capucha-court-series",
      gl: "sudadoira-capucha-court-series",
      en: "court-series-hoodie",
    },
    name: {
      es: "Sudadera con Capucha Court Series",
      gl: "Sudadoira con Capucha Court Series",
      en: "Court Series Hoodie",
    },
    description: {
      es: "Felpa perchada de 380 g, capucha de doble capa y bolsillo canguro. El básico del invierno.",
      gl: "Felpa perchada de 380 g, capucha de dobre capa e peto canguro. O básico do inverno.",
      en: "380 gsm brushed fleece, double-layer hood and kangaroo pocket. The winter staple.",
    },
    keywords: {
      es: ["sudadera capucha", "hoodie negro", "court series"],
      gl: ["sudadoira capucha", "hoodie negro", "court series"],
      en: ["hoodie", "black hoodie", "court series"],
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
    slug: { es: "sudadera-crew-hardwood-94", gl: "sudadoira-crew-hardwood-94", en: "hardwood-94-crew" },
    name: {
      es: "Sudadera Crew Hardwood 94",
      gl: "Sudadoira Crew Hardwood 94",
      en: "Hardwood 94 Crew",
    },
    description: {
      es: "Cuello redondo de canalé con refuerzo en V y logo aplicado en tejido.",
      gl: "Pescozo redondo de canelé con reforzo en V e logo aplicado en tecido.",
      en: "Ribbed crew neck with a V insert and a fabric-applied logo.",
    },
    keywords: {
      es: ["sudadera cuello redondo", "crewneck", "hardwood"],
      gl: ["sudadoira pescozo redondo", "crewneck", "hardwood"],
      en: ["crewneck sweatshirt", "crew", "hardwood"],
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
      es: "camiseta-de-juego-court-series",
      gl: "camiseta-de-xogo-court-series",
      en: "court-series-game-jersey",
    },
    name: {
      es: "Camiseta de Juego Court Series",
      gl: "Camiseta de Xogo Court Series",
      en: "Court Series Game Jersey",
    },
    description: {
      es: "Réplica de la camiseta de competición: malla de doble capa, números termosellados y ribetes en canalé.",
      gl: "Réplica da camiseta de competición: malla de dobre capa, números termosellados e ribetes en canelé.",
      en: "Replica of the competition jersey: double-layer mesh, heat-sealed numbers and ribbed trims.",
    },
    keywords: {
      es: ["camiseta de juego", "jersey baloncesto", "malla doble capa", "dorsal"],
      gl: ["camiseta de xogo", "jersey baloncesto", "malla dobre capa", "dorsal"],
      en: ["game jersey", "basketball jersey", "double mesh", "player number"],
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
      es: "jersey-hardwood-94-reversible",
      gl: "jersey-hardwood-94-reversible",
      en: "hardwood-94-reversible-jersey",
    },
    name: {
      es: "Jersey Hardwood 94 Reversible",
      gl: "Jersey Hardwood 94 Reversible",
      en: "Hardwood 94 Reversible Jersey",
    },
    description: {
      es: "Doble cara: parqué por fuera, granate por dentro. Dos camisetas en una.",
      gl: "Dobre cara: parqué por fóra, granate por dentro. Dúas camisetas nunha.",
      en: "Two-sided: hardwood outside, maroon inside. Two jerseys in one.",
    },
    keywords: {
      es: ["jersey reversible", "camiseta doble cara", "hardwood"],
      gl: ["jersey reversible", "camiseta dobre cara", "hardwood"],
      en: ["reversible jersey", "two-sided jersey", "hardwood"],
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
    slug: { es: "jersey-origen-23", gl: "jersey-orixe-23", en: "origin-23-jersey" },
    name: { es: "Jersey Origen 23", gl: "Jersey Orixe 23", en: "Origin 23 Jersey" },
    description: {
      es: "Edición de 150 unidades con dorsal bordado y etiqueta numerada a mano en el bajo.",
      gl: "Edición de 150 unidades con dorsal bordado e etiqueta numerada a man no baixo.",
      en: "Edition of 150 with an embroidered number and a hand-numbered label at the hem.",
    },
    keywords: {
      es: ["jersey numerado", "edición 150", "dorsal bordado"],
      gl: ["jersey numerado", "edición 150", "dorsal bordado"],
      en: ["numbered jersey", "edition of 150", "embroidered number"],
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
      es: "chaqueta-warm-up-court-series",
      gl: "chaqueta-warm-up-court-series",
      en: "court-series-warm-up-jacket",
    },
    name: {
      es: "Chaqueta Warm-Up Court Series",
      gl: "Chaqueta Warm-Up Court Series",
      en: "Court Series Warm-Up Jacket",
    },
    description: {
      es: "La chaqueta del calentamiento: cuello alzado, cremallera completa y taping en mangas.",
      gl: "A chaqueta do quecemento: pescozo alzado, cremalleira completa e taping nas mangas.",
      en: "The warm-up jacket: stand collar, full-length zip and taped sleeves.",
    },
    keywords: {
      es: ["chaqueta calentamiento", "warm up", "cuello alzado"],
      gl: ["chaqueta quecemento", "warm up", "pescozo alzado"],
      en: ["warm-up jacket", "track jacket", "stand collar"],
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
    slug: { es: "short-de-juego-court-series", gl: "short-de-xogo-court-series", en: "court-series-game-shorts" },
    name: {
      es: "Short de Juego Court Series",
      gl: "Short de Xogo Court Series",
      en: "Court Series Game Shorts",
    },
    description: {
      es: "Short de competición con cintura elástica, cordón oculto y taping lateral.",
      gl: "Short de competición con cintura elástica, cordón oculto e taping lateral.",
      en: "Competition shorts with an elastic waistband, hidden drawcord and side taping.",
    },
    keywords: {
      es: ["short baloncesto", "short de juego", "pantalón corto deportivo"],
      gl: ["short baloncesto", "short de xogo", "pantalón curto deportivo"],
      en: ["basketball shorts", "game shorts", "athletic shorts"],
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
    slug: { es: "short-hardwood-94", gl: "short-hardwood-94", en: "hardwood-94-shorts" },
    name: { es: "Short Hardwood 94", gl: "Short Hardwood 94", en: "Hardwood 94 Shorts" },
    description: {
      es: "Largo por encima de la rodilla y bloque de color en la pernera.",
      gl: "Longo por riba do xeonllo e bloque de cor na perna.",
      en: "Above-the-knee length with colour blocking down the leg.",
    },
    keywords: {
      es: ["short retro", "bloque de color", "hardwood"],
      gl: ["short retro", "bloque de cor", "hardwood"],
      en: ["retro shorts", "colour block", "hardwood"],
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
    slug: { es: "short-junior-court-series", gl: "short-junior-court-series", en: "court-series-junior-shorts" },
    name: {
      es: "Short Junior Court Series",
      gl: "Short Junior Court Series",
      en: "Court Series Junior Shorts",
    },
    description: {
      es: "Versión infantil del short de juego, con cintura ajustable.",
      gl: "Versión infantil do short de xogo, con cintura axustable.",
      en: "Kids' version of the game shorts, with an adjustable waistband.",
    },
    keywords: {
      es: ["short niño", "baloncesto infantil", "cintura ajustable"],
      gl: ["short neno", "baloncesto infantil", "cintura axustable"],
      en: ["kids shorts", "youth basketball", "adjustable waist"],
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
    slug: { es: "gorra-snapback-court-series", gl: "gorra-snapback-court-series", en: "court-series-snapback" },
    name: {
      es: "Gorra Snapback Court Series",
      gl: "Gorra Snapback Court Series",
      en: "Court Series Snapback",
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
    slug: { es: "tote-bag-court-series", gl: "tote-bag-court-series", en: "court-series-tote-bag" },
    name: { es: "Tote Bag Court Series", gl: "Tote Bag Court Series", en: "Court Series Tote Bag" },
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
    slug: { es: "balon-court-series-talla-7", gl: "balon-court-series-talla-7", en: "court-series-size-7-basketball" },
    name: {
      es: "Balón Court Series Talla 7",
      gl: "Balón Court Series Talla 7",
      en: "Court Series Size 7 Basketball",
    },
    description: {
      es: "Talla oficial 7 en cuero compuesto, con agarre profundo para exterior.",
      gl: "Talla oficial 7 en coiro composto, con agarre profundo para exterior.",
      en: "Official size 7 in composite leather, with a deep grip for outdoor play.",
    },
    keywords: {
      es: ["balón talla 7", "balón exterior", "cuero compuesto"],
      gl: ["balón talla 7", "balón exterior", "coiro composto"],
      en: ["size 7 basketball", "outdoor basketball", "composite leather"],
    },
    category: "balones",
    collection: "court-series",
    shape: "ball",
    print: "wordmark",
    price: 3995,
    colors: ["naranja", "negro"],
    rating: 4.8,
    reviews: 263,
    arrived: 77,
    bestseller: true,
    authors: [["xabier-lema", { es: "Desarrollo técnico", gl: "Desenvolvemento técnico", en: "Technical development" }]],
  },
  {
    ref: "GO-031",
    slug: { es: "balon-indoor-hardwood-94", gl: "balon-indoor-hardwood-94", en: "hardwood-94-indoor-basketball" },
    name: {
      es: "Balón Indoor Hardwood 94",
      gl: "Balón Indoor Hardwood 94",
      en: "Hardwood 94 Indoor Basketball",
    },
    description: {
      es: "Cuero curtido para pista interior, con tacto blando desde el primer partido.",
      gl: "Coiro curtido para pista interior, con tacto brando desde o primeiro partido.",
      en: "Tanned leather for indoor courts, soft to the touch from the first game.",
    },
    keywords: {
      es: ["balón indoor", "cuero curtido", "balón pista"],
      gl: ["balón indoor", "coiro curtido", "balón pista"],
      en: ["indoor basketball", "tanned leather", "court ball"],
    },
    category: "balones",
    collection: "hardwood-94",
    shape: "ball",
    print: "monogram",
    price: 4995,
    colors: ["arena", "naranja"],
    rating: 4.7,
    reviews: 84,
    arrived: 72,
    authors: [["xabier-lema", { es: "Desarrollo técnico", gl: "Desenvolvemento técnico", en: "Technical development" }]],
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
    category: "coleccionismo",
    collection: "origen",
    shape: "poster",
    print: "none",
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
    slug: { es: "poster-hardwood-94", gl: "cartel-hardwood-94", en: "hardwood-94-poster" },
    name: { es: "Póster Hardwood 94", gl: "Cartel Hardwood 94", en: "Hardwood 94 Poster" },
    description: {
      es: "Reproducción del cartel original de la temporada 94 en papel de 300 g.",
      gl: "Reprodución do cartel orixinal da tempada 94 en papel de 300 g.",
      en: "Reproduction of the original 1994 season poster on 300 gsm paper.",
    },
    keywords: {
      es: ["cartel retro", "póster años 90", "hardwood"],
      gl: ["cartel retro", "cartel anos 90", "hardwood"],
      en: ["retro poster", "nineties print", "hardwood"],
    },
    category: "coleccionismo",
    collection: "hardwood-94",
    shape: "poster",
    print: "none",
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
    `insert into public.products (id, ref, slug, name, description, details, keywords, category_id, collection_id, audience, shape, print, price_cents, compare_at_cents, colorways, rating, reviews, bestseller, exclusive, arrived) values (` +
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
