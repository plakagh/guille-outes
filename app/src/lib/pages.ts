import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/i18n/config";

/**
 * Help-centre and legal articles.
 *
 * Content is authored as locale bundles and resolved at render time, so a
 * missing translation degrades to Castellano rather than to an empty page. The
 * legal texts are working templates and are marked as such: they must be
 * reviewed by a lawyer before the shop opens.
 */

type Bundle = Partial<Record<Locale, string>> & { es: string };
type ListBundle = Partial<Record<Locale, string[]>> & { es: string[] };
type TableBundle = {
  head: ListBundle;
  rows: Partial<Record<Locale, string[][]>> & { es: string[][] };
};

type RawBlock =
  | { type: "p"; text: Bundle }
  | { type: "list"; items: ListBundle }
  | { type: "table"; table: TableBundle };

type RawSection = { heading?: Bundle; blocks: RawBlock[] };

type RawDoc = {
  /** Canonical id, used as the Castellano slug when `slugs` omits one. */
  slug: string;
  /** Public slug per locale. Missing locales fall back to `slug`. */
  slugs?: Partial<Record<Locale, string>>;
  topic: Topic;
  title: Bundle;
  summary: Bundle;
  keywords?: ListBundle;
  sections: RawSection[];
};

export type Topic = "orders" | "product" | "brand" | "legal";

/* ------------------------------------------------------------- resolution */

export type Block =
  | { type: "p"; text: string }
  | { type: "list"; items: string[] }
  | { type: "table"; head: string[]; rows: string[][] };

export type Section = { heading?: string; blocks: Block[] };

export type Doc = {
  /** The slug for the locale this Doc was resolved in. */
  slug: string;
  /** Every locale's slug, for canonical links and hreflang. */
  slugs: Record<Locale, string>;
  topic: Topic;
  title: string;
  summary: string;
  keywords: string[];
  sections: Section[];
};

function pick<T>(bundle: Partial<Record<Locale, T>> & { es: T }, locale: Locale): T {
  // `es` is required by the type, so the fallback always yields a T. The cast is
  // only needed because TypeScript cannot rule out `undefined` inside T itself.
  return (bundle[locale] ?? bundle[DEFAULT_LOCALE]) as T;
}

function resolveBlock(block: RawBlock, locale: Locale): Block {
  if (block.type === "p") return { type: "p", text: pick(block.text, locale) };
  if (block.type === "list") return { type: "list", items: pick(block.items, locale) };
  return {
    type: "table",
    head: pick(block.table.head, locale),
    rows: pick(block.table.rows, locale),
  };
}

/** Fills in every locale, defaulting to the canonical slug. */
function docSlugs(doc: RawDoc): Record<Locale, string> {
  return Object.fromEntries(
    LOCALES.map((locale) => [locale, doc.slugs?.[locale] ?? doc.slug]),
  ) as Record<Locale, string>;
}

function resolveDoc(doc: RawDoc, locale: Locale): Doc {
  const slugs = docSlugs(doc);
  return {
    slug: slugs[locale],
    slugs,
    topic: doc.topic,
    title: pick(doc.title, locale),
    summary: pick(doc.summary, locale),
    keywords: doc.keywords ? pick(doc.keywords, locale) : [],
    sections: doc.sections.map((section) => ({
      heading: section.heading ? pick(section.heading, locale) : undefined,
      blocks: section.blocks.map((block) => resolveBlock(block, locale)),
    })),
  };
}

/* ------------------------------------------------------------- help docs */

const p = (es: string, gl: string, en: string): RawBlock => ({ type: "p", text: { es, gl, en } });
const items = (es: string[], gl: string[], en: string[]): RawBlock => ({
  type: "list",
  items: { es, gl, en },
});

const HELP: RawDoc[] = [
  {
    slug: "envios",
    slugs: { gl: "envios", en: "shipping" },
    topic: "orders",
    title: { es: "Envíos y entregas", gl: "Envíos e entregas", en: "Shipping and delivery" },
    summary: {
      es: "Plazos, costes y zonas de reparto.",
      gl: "Prazos, custos e zonas de reparto.",
      en: "Lead times, costs and delivery areas.",
    },
    keywords: {
      es: ["envío gratis", "plazos de entrega", "gastos de envío"],
      gl: ["envío gratis", "prazos de entrega", "gastos de envío"],
      en: ["free shipping", "delivery times", "shipping costs"],
    },
    sections: [
      {
        blocks: [
          p(
            "Preparamos los pedidos de lunes a viernes. Si compras antes de las 14:00 en día laborable, sale el mismo día.",
            "Preparamos os pedidos de luns a venres. Se compras antes das 14:00 en día laborable, sae o mesmo día.",
            "We pack orders Monday to Friday. Order before 14:00 on a working day and it ships the same day.",
          ),
          {
            type: "table",
            table: {
              head: {
                es: ["Destino", "Plazo estimado", "Coste"],
                gl: ["Destino", "Prazo estimado", "Custo"],
                en: ["Destination", "Estimated time", "Cost"],
              },
              rows: {
                es: [
                  ["Península", "24–72 h laborables", "4,95 € · gratis desde 60 €"],
                  ["Baleares", "3–4 días laborables", "6,95 €"],
                  ["Canarias, Ceuta y Melilla", "4–6 días laborables", "12,95 €"],
                  ["Portugal continental", "3–5 días laborables", "5,95 €"],
                  ["Resto de la UE", "4–7 días laborables", "9,95 €"],
                ],
                gl: [
                  ["Península", "24–72 h laborables", "4,95 € · gratis desde 60 €"],
                  ["Baleares", "3–4 días laborables", "6,95 €"],
                  ["Canarias, Ceuta e Melilla", "4–6 días laborables", "12,95 €"],
                  ["Portugal continental", "3–5 días laborables", "5,95 €"],
                  ["Resto da UE", "4–7 días laborables", "9,95 €"],
                ],
                en: [
                  ["Mainland Spain", "24–72 working hours", "€4.95 · free over €60"],
                  ["Balearic Islands", "3–4 working days", "€6.95"],
                  ["Canaries, Ceuta and Melilla", "4–6 working days", "€12.95"],
                  ["Mainland Portugal", "3–5 working days", "€5.95"],
                  ["Rest of the EU", "4–7 working days", "€9.95"],
                ],
              },
            },
          },
          p(
            "En cuanto el paquete sale del taller recibes un correo con el número de seguimiento. Las piezas de la serie Origen se serigrafían por encargo y suman de 3 a 5 días laborables.",
            "En canto o paquete sae do taller recibes un correo co número de seguimento. As pezas da serie Orixe serigráfanse por encarga e suman de 3 a 5 días laborables.",
            "As soon as the parcel leaves the workshop you get an email with the tracking number. Origin series pieces are printed to order and add 3 to 5 working days.",
          ),
        ],
      },
    ],
  },
  {
    slug: "devoluciones",
    slugs: { gl: "devolucions", en: "returns" },
    topic: "orders",
    title: {
      es: "Devoluciones y cambios",
      gl: "Devolucións e cambios",
      en: "Returns and exchanges",
    },
    summary: {
      es: "30 días, sin coste y sin dar explicaciones.",
      gl: "30 días, sen custo e sen dar explicacións.",
      en: "30 days, free, no questions asked.",
    },
    sections: [
      {
        blocks: [
          p(
            "Tienes 30 días naturales desde la recepción para devolver o cambiar cualquier artículo sin usar y con su etiqueta original.",
            "Tes 30 días naturais desde a recepción para devolver ou cambiar calquera artigo sen usar e coa súa etiqueta orixinal.",
            "You have 30 calendar days from delivery to return or exchange any unused item with its original tag.",
          ),
          items(
            [
              "Entra en «Mis pedidos» y elige el artículo a devolver.",
              "Descarga la etiqueta prepagada que te generamos.",
              "Deja el paquete en un punto del transportista o pide recogida a domicilio.",
              "El reembolso se emite en el mismo método de pago en 3–5 días laborables.",
            ],
            [
              "Entra en «Os meus pedidos» e escolle o artigo a devolver.",
              "Descarga a etiqueta prepagada que xeramos.",
              "Deixa o paquete nun punto do transportista ou pide recollida a domicilio.",
              "O reembolso emítese no mesmo método de pagamento en 3–5 días laborables.",
            ],
            [
              "Go to “My orders” and pick the item to return.",
              "Download the prepaid label we generate for you.",
              "Drop the parcel at a courier point or book a home collection.",
              "The refund goes back to the original payment method in 3–5 working days.",
            ],
          ),
        ],
      },
      {
        heading: {
          es: "Qué no se puede devolver",
          gl: "Que non se pode devolver",
          en: "What cannot be returned",
        },
        blocks: [
          items(
            [
              "Artículos personalizados con nombre o dorsal.",
              "Prendas lavadas, usadas o sin etiqueta.",
              "Tarjetas regalo.",
            ],
            [
              "Artigos personalizados con nome ou dorsal.",
              "Pezas lavadas, usadas ou sen etiqueta.",
              "Tarxetas agasallo.",
            ],
            [
              "Items personalised with a name or number.",
              "Garments that have been washed, worn or had the tag removed.",
              "Gift cards.",
            ],
          ),
        ],
      },
    ],
  },
  {
    slug: "tallas",
    slugs: { gl: "tallas", en: "size-guide" },
    topic: "product",
    title: { es: "Guía de tallas", gl: "Guía de tallas", en: "Size guide" },
    summary: {
      es: "Medidas de cada corte y cómo elegir.",
      gl: "Medidas de cada corte e como escoller.",
      en: "Measurements for each fit, and how to choose.",
    },
    sections: [
      {
        blocks: [
          p(
            "Todas las medidas son de la prenda en plano, en centímetros, con una tolerancia de ±1 cm. Si dudas entre dos tallas y buscas caída holgada, sube una.",
            "Todas as medidas son da peza en plano, en centímetros, cunha tolerancia de ±1 cm. Se dubidas entre dúas tallas e buscas caída folgada, sobe unha.",
            "All measurements are taken flat, in centimetres, with a ±1 cm tolerance. If you are between sizes and want a looser drape, size up.",
          ),
        ],
      },
      {
        heading: {
          es: "Camisetas y sudaderas (corte regular)",
          gl: "Camisetas e sudadoiras (corte regular)",
          en: "T-shirts and sweatshirts (regular fit)",
        },
        blocks: [
          {
            type: "table",
            table: {
              head: {
                es: ["Talla", "Pecho", "Largo", "Manga"],
                gl: ["Talla", "Peito", "Longo", "Manga"],
                en: ["Size", "Chest", "Length", "Sleeve"],
              },
              rows: {
                es: [
                  ["XS", "48", "66", "19"],
                  ["S", "51", "69", "20"],
                  ["M", "54", "72", "21"],
                  ["L", "57", "74", "22"],
                  ["XL", "60", "76", "23"],
                  ["2XL", "63", "78", "24"],
                ],
              },
            },
          },
          p(
            "Los cortes oversize de Away Days añaden 4 cm de pecho y 3 cm de largo sobre esta tabla.",
            "Os cortes oversize de Away Days engaden 4 cm de peito e 3 cm de longo sobre esta táboa.",
            "The Away Days oversize fits add 4 cm at the chest and 3 cm in length over this table.",
          ),
        ],
      },
      {
        heading: { es: "Niños y niñas", gl: "Nenos e nenas", en: "Kids" },
        blocks: [
          {
            type: "table",
            table: {
              head: {
                es: ["Talla", "Edad orientativa", "Altura"],
                gl: ["Talla", "Idade orientativa", "Altura"],
                en: ["Size", "Approx. age", "Height"],
              },
              rows: {
                es: [
                  ["4", "3–4", "98–104"],
                  ["6", "5–6", "110–116"],
                  ["8", "7–8", "122–128"],
                  ["10", "9–10", "134–140"],
                  ["12", "11–12", "146–152"],
                  ["14", "13–14", "158–164"],
                ],
              },
            },
          },
        ],
      },
    ],
  },
  {
    slug: "pedidos",
    slugs: { gl: "pedidos", en: "track-order" },
    topic: "orders",
    title: {
      es: "Seguimiento de pedido",
      gl: "Seguimento de pedido",
      en: "Track your order",
    },
    summary: {
      es: "Dónde está tu paquete y cómo modificarlo.",
      gl: "Onde está o teu paquete e como modificalo.",
      en: "Where your parcel is, and how to change it.",
    },
    sections: [
      {
        blocks: [
          p(
            "Introduce el número de pedido y el correo de la compra en «Mis pedidos» para ver el estado: recibido, en preparación, enviado o entregado.",
            "Introduce o número de pedido e o correo da compra en «Os meus pedidos» para ver o estado: recibido, en preparación, enviado ou entregado.",
            "Enter your order number and the email you bought with under “My orders” to see the status: received, packing, shipped or delivered.",
          ),
          p(
            "Mientras el pedido esté «en preparación» puedes cambiar la dirección o cancelarlo escribiéndonos. Una vez enviado, habrá que tramitarlo como devolución.",
            "Mentres o pedido estea «en preparación» podes cambiar o enderezo ou cancelalo escribíndonos. Unha vez enviado, haberá que tramitalo como devolución.",
            "While the order is still packing you can change the address or cancel it by emailing us. Once shipped, it has to go through the returns flow.",
          ),
        ],
      },
    ],
  },
  {
    slug: "pagos",
    slugs: { gl: "pagamentos", en: "payment-methods" },
    topic: "orders",
    title: { es: "Formas de pago", gl: "Formas de pagamento", en: "Payment methods" },
    summary: {
      es: "Métodos aceptados y seguridad.",
      gl: "Métodos aceptados e seguridade.",
      en: "Accepted methods and security.",
    },
    sections: [
      {
        blocks: [
          items(
            [
              "Tarjeta de crédito y débito: Visa, Mastercard y American Express.",
              "PayPal, Bizum, Apple Pay y Google Pay.",
              "Klarna: paga en 3 plazos sin intereses.",
            ],
            [
              "Tarxeta de crédito e débito: Visa, Mastercard e American Express.",
              "PayPal, Bizum, Apple Pay e Google Pay.",
              "Klarna: paga en 3 prazos sen xuros.",
            ],
            [
              "Credit and debit cards: Visa, Mastercard and American Express.",
              "PayPal, Bizum, Apple Pay and Google Pay.",
              "Klarna: pay in 3 interest-free instalments.",
            ],
          ),
          p(
            "Todas las transacciones se procesan con cifrado TLS y verificación 3-D Secure. No almacenamos los datos completos de la tarjeta en ningún momento.",
            "Todas as transaccións procésanse con cifrado TLS e verificación 3-D Secure. Non almacenamos os datos completos da tarxeta en ningún momento.",
            "Every transaction is processed over TLS with 3-D Secure. We never store full card details.",
          ),
        ],
      },
    ],
  },
  {
    slug: "personalizacion",
    slugs: { gl: "personalizacion", en: "personalisation" },
    topic: "product",
    title: { es: "Personalización", gl: "Personalización", en: "Personalisation" },
    summary: {
      es: "Añade nombre y dorsal a tu camiseta.",
      gl: "Engade nome e dorsal á túa camiseta.",
      en: "Add a name and number to your jersey.",
    },
    sections: [
      {
        blocks: [
          p(
            "Puedes personalizar cualquier camiseta de juego con nombre (hasta 12 caracteres) y dorsal (del 0 al 99), en vinilo termosellado y en la tipografía de la colección.",
            "Podes personalizar calquera camiseta de xogo con nome (até 12 caracteres) e dorsal (do 0 ao 99), en vinilo termosellado e na tipografía da colección.",
            "Any game jersey can be personalised with a name (up to 12 characters) and a number (0–99), in heat-sealed vinyl and the collection's own typeface.",
          ),
          items(
            [
              "Coste: 12 € por prenda.",
              "Plazo adicional: 48 h laborables.",
              "No admite devolución, salvo defecto de fabricación.",
              "No aceptamos nombres ofensivos ni marcas de terceros.",
            ],
            [
              "Custo: 12 € por peza.",
              "Prazo adicional: 48 h laborables.",
              "Non admite devolución, salvo defecto de fabricación.",
              "Non aceptamos nomes ofensivos nin marcas de terceiros.",
            ],
            [
              "Cost: €12 per garment.",
              "Adds 48 working hours to the lead time.",
              "Not returnable unless faulty.",
              "We do not print offensive names or third-party trademarks.",
            ],
          ),
        ],
      },
    ],
  },
  {
    slug: "tarjeta-regalo",
    slugs: { gl: "tarxeta-agasallo", en: "gift-card" },
    topic: "product",
    title: { es: "Tarjeta regalo", gl: "Tarxeta agasallo", en: "Gift card" },
    summary: {
      es: "De 20 € a 200 €, sin caducidad.",
      gl: "De 20 € a 200 €, sen caducidade.",
      en: "From €20 to €200, no expiry.",
    },
    sections: [
      {
        blocks: [
          p(
            "La tarjeta regalo llega por correo en minutos, con un código único que se canjea al pagar. Puede usarse en varias compras hasta agotar el saldo.",
            "A tarxeta agasallo chega por correo en minutos, cun código único que se canxea ao pagar. Pode usarse en varias compras até esgotar o saldo.",
            "The gift card arrives by email within minutes, with a unique code redeemed at checkout. It can be spent across several orders until the balance runs out.",
          ),
          items(
            ["Importes: 20, 30, 50, 100 y 200 €.", "Sin caducidad.", "No reembolsable en efectivo."],
            ["Importes: 20, 30, 50, 100 e 200 €.", "Sen caducidade.", "Non reembolsable en efectivo."],
            ["Amounts: €20, €30, €50, €100 and €200.", "No expiry date.", "Not exchangeable for cash."],
          ),
        ],
      },
    ],
  },
  {
    slug: "contacto",
    slugs: { gl: "contacto", en: "contact" },
    topic: "orders",
    title: { es: "Contacto", gl: "Contacto", en: "Contact" },
    summary: {
      es: "Escríbenos: contestamos personas.",
      gl: "Escríbenos: contestamos persoas.",
      en: "Email us — a person replies.",
    },
    sections: [
      {
        blocks: [
          p(
            "Atendemos por correo de lunes a viernes, de 9:00 a 18:00 (CET). Respondemos en menos de 24 h laborables.",
            "Atendemos por correo de luns a venres, de 9:00 a 18:00 (CET). Respondemos en menos de 24 h laborables.",
            "We answer email Monday to Friday, 9:00–18:00 CET, within 24 working hours.",
          ),
          items(
            [
              "Pedidos y devoluciones: pedidos@guilleoutes.com",
              "Dudas de producto y tallas: tienda@guilleoutes.com",
              "Colaboraciones y prensa: hola@guilleoutes.com",
            ],
            [
              "Pedidos e devolucións: pedidos@guilleoutes.com",
              "Dúbidas de produto e tallas: tenda@guilleoutes.com",
              "Colaboracións e prensa: ola@guilleoutes.com",
            ],
            [
              "Orders and returns: orders@guilleoutes.com",
              "Product and sizing questions: shop@guilleoutes.com",
              "Collaborations and press: hello@guilleoutes.com",
            ],
          ),
        ],
      },
    ],
  },
  {
    slug: "sobre-nosotros",
    slugs: { gl: "sobre-nos", en: "about" },
    topic: "brand",
    title: { es: "El proyecto", gl: "O proxecto", en: "The project" },
    summary: {
      es: "Qué es Guille Outes y por qué existe.",
      gl: "Que é Guille Outes e por que existe.",
      en: "What Guille Outes is, and why it exists.",
    },
    sections: [
      {
        blocks: [
          p(
            "Guille Outes empezó con una serigrafía de garaje, veinte camisetas y una pista de barrio. La idea era sencilla: ropa de baloncesto que aguante, sin logos ajenos y sin tiradas infinitas.",
            "Guille Outes empezou cunha serigrafía de garaxe, vinte camisetas e unha pista de barrio. A idea era sinxela: roupa de baloncesto que aguante, sen logos alleos e sen tiradas infinitas.",
            "Guille Outes started with a garage screen-printing rig, twenty t-shirts and a neighbourhood court. The idea was simple: basketball clothing that lasts, with nobody else's logos and no endless production runs.",
          ),
          p(
            "Hoy son cinco colecciones al año, producidas en series cortas. Cuando una referencia se agota, sólo vuelve si el tejido y el precio siguen teniendo sentido.",
            "Hoxe son cinco coleccións ao ano, producidas en series curtas. Cando unha referencia se esgota, só volve se o tecido e o prezo seguen tendo sentido.",
            "Today it is five collections a year, produced in short runs. When a line sells out it only comes back if the fabric and the price still make sense.",
          ),
        ],
      },
    ],
  },
  {
    slug: "fabricacion",
    slugs: { gl: "fabricacion", en: "how-we-make-it" },
    topic: "brand",
    title: { es: "Cómo lo fabricamos", gl: "Como o fabricamos", en: "How we make it" },
    summary: {
      es: "Del patrón a la caja.",
      gl: "Do patrón á caixa.",
      en: "From pattern to box.",
    },
    sections: [
      {
        blocks: [
          items(
            [
              "Diseño y patronaje: taller propio en Galicia.",
              "Corte y confección: talleres familiares en el norte de Portugal, auditados anualmente.",
              "Serigrafía y bordado: en casa, a mano, en tiradas de 50 a 300 unidades.",
              "Empaquetado: cartón reciclado sin plástico y etiquetas de papel FSC.",
            ],
            [
              "Deseño e patronaxe: taller propio en Galicia.",
              "Corte e confección: talleres familiares no norte de Portugal, auditados anualmente.",
              "Serigrafía e bordado: na casa, a man, en tiradas de 50 a 300 unidades.",
              "Empaquetado: cartón reciclado sen plástico e etiquetas de papel FSC.",
            ],
            [
              "Design and pattern cutting: our own workshop in Galicia.",
              "Cutting and sewing: family workshops in northern Portugal, audited yearly.",
              "Screen printing and embroidery: in-house, by hand, in runs of 50 to 300.",
              "Packaging: recycled cardboard, no plastic, FSC paper labels.",
            ],
          ),
          p(
            "Producir cerca alarga los plazos y encarece la prenda, pero permite corregir un patrón en días y no en meses.",
            "Producir preto alonga os prazos e encarece a peza, pero permite corrixir un patrón en días e non en meses.",
            "Producing close to home costs more and takes longer, but it means a pattern can be fixed in days instead of months.",
          ),
        ],
      },
    ],
  },
  {
    slug: "sostenibilidad",
    slugs: { gl: "sustentabilidade", en: "sustainability" },
    topic: "brand",
    title: { es: "Sostenibilidad", gl: "Sustentabilidade", en: "Sustainability" },
    summary: {
      es: "Lo que hacemos y lo que aún no.",
      gl: "O que facemos e o que aínda non.",
      en: "What we do, and what we do not yet.",
    },
    sections: [
      {
        blocks: [
          items(
            [
              "Algodón de cultivo orgánico certificado en el 80 % de la línea de punto.",
              "Series cortas para no generar stock muerto.",
              "Envíos agrupados y embalaje sin plástico.",
              "Reparación gratuita de costuras durante el primer año.",
            ],
            [
              "Algodón de cultivo orgánico certificado no 80 % da liña de punto.",
              "Series curtas para non xerar stock morto.",
              "Envíos agrupados e embalaxe sen plástico.",
              "Reparación gratuíta de costuras durante o primeiro ano.",
            ],
            [
              "Certified organic cotton across 80% of the jersey line.",
              "Short runs, so we do not create dead stock.",
              "Consolidated shipments and plastic-free packaging.",
              "Free seam repairs during the first year.",
            ],
          ),
          p(
            "Lo que todavía no hemos resuelto: los tejidos técnicos de Training Lab siguen siendo poliéster virgen y el transporte a Canarias es aéreo. Lo contaremos cuando cambie.",
            "O que aínda non resolvemos: os tecidos técnicos de Training Lab seguen sendo poliéster virxe e o transporte a Canarias é aéreo. Contarémolo cando cambie.",
            "What we have not solved yet: the Training Lab technical fabrics are still virgin polyester, and shipping to the Canaries goes by air. We will say so when that changes.",
          ),
        ],
      },
    ],
  },
  {
    slug: "colaboraciones",
    slugs: { gl: "colaboracions", en: "collaborations" },
    topic: "brand",
    title: { es: "Colaboraciones", gl: "Colaboracións", en: "Collaborations" },
    summary: {
      es: "Clubes, artistas y equipos.",
      gl: "Clubes, artistas e equipos.",
      en: "Clubs, artists and teams.",
    },
    sections: [
      {
        blocks: [
          p(
            "Producimos equipaciones para clubes de base y colaboraciones puntuales con artistas. El mínimo por diseño es de 25 unidades y el plazo, de 4 a 6 semanas.",
            "Producimos equipacións para clubes de base e colaboracións puntuais con artistas. O mínimo por deseño é de 25 unidades e o prazo, de 4 a 6 semanas.",
            "We produce kits for grassroots clubs and occasional artist collaborations. The minimum is 25 units per design, with a 4–6 week lead time.",
          ),
        ],
      },
    ],
  },
  {
    slug: "empleo",
    slugs: { gl: "emprego", en: "jobs" },
    topic: "brand",
    title: { es: "Trabaja con nosotros", gl: "Traballa con nós", en: "Work with us" },
    summary: {
      es: "Cómo entrar en el equipo.",
      gl: "Como entrar no equipo.",
      en: "How to join the team.",
    },
    sections: [
      {
        blocks: [
          p(
            "Somos un equipo pequeño y abrimos pocas plazas al año, casi siempre en taller y atención al cliente. Escribe a empleo@guilleoutes.com contando qué te gustaría hacer; no hace falta carta de motivación.",
            "Somos un equipo pequeno e abrimos poucas prazas ao ano, case sempre en taller e atención á clientela. Escribe a emprego@guilleoutes.com contando que che gustaría facer; non fai falta carta de motivación.",
            "We are a small team and open few positions a year, mostly in the workshop and customer support. Email jobs@guilleoutes.com telling us what you would like to do — no cover letter needed.",
          ),
        ],
      },
    ],
  },
];

/* ------------------------------------------------------------ legal docs */

const TEMPLATE_NOTICE = p(
  "Redactado como base de trabajo conforme al RGPD, la LOPDGDD y la LSSI-CE. Antes de abrir la tienda al público debe revisarlo un abogado y completarse con los datos de la empresa marcados entre corchetes.",
  "Redactado como base de traballo conforme ao RGPD, a LOPDGDD e a LSSI-CE. Antes de abrir a tenda ao público debe revisalo un avogado e completarse cos datos da empresa marcados entre corchetes.",
  "Drafted as a working basis under the GDPR, the Spanish LOPDGDD and the LSSI-CE. Before the shop opens it must be reviewed by a lawyer and completed with the company details marked in brackets.",
);

const LEGAL: RawDoc[] = [
  {
    slug: "aviso-legal",
    slugs: { gl: "aviso-legal", en: "legal-notice" },
    topic: "legal",
    title: { es: "Aviso legal", gl: "Aviso legal", en: "Legal notice" },
    summary: {
      es: "Titularidad del sitio y condiciones de uso.",
      gl: "Titularidade do sitio e condicións de uso.",
      en: "Site ownership and terms of use.",
    },
    sections: [
      {
        heading: {
          es: "Datos del titular",
          gl: "Datos do titular",
          en: "Owner details",
        },
        blocks: [
          TEMPLATE_NOTICE,
          p(
            "En cumplimiento del artículo 10 de la Ley 34/2002 de servicios de la sociedad de la información y de comercio electrónico (LSSI-CE), se hacen constar los siguientes datos:",
            "En cumprimento do artigo 10 da Lei 34/2002 de servizos da sociedade da información e de comercio electrónico (LSSI-CE), fanse constar os seguintes datos:",
            "As required by article 10 of Spanish Law 34/2002 on information society services and electronic commerce (LSSI-CE), the following details are provided:",
          ),
          items(
            [
              "Titular: [razón social]",
              "NIF / CIF: [identificación fiscal]",
              "Domicilio social: [dirección completa]",
              "Correo electrónico: hola@guilleoutes.com",
              "Registro Mercantil: [tomo, folio, hoja e inscripción]",
              "Actividad: comercio al por menor de prendas de vestir y artículos deportivos",
            ],
            [
              "Titular: [razón social]",
              "NIF / CIF: [identificación fiscal]",
              "Domicilio social: [enderezo completo]",
              "Correo electrónico: ola@guilleoutes.com",
              "Rexistro Mercantil: [tomo, folio, folla e inscrición]",
              "Actividade: comercio ao por menor de pezas de vestir e artigos deportivos",
            ],
            [
              "Owner: [legal name]",
              "Tax ID: [tax identification]",
              "Registered address: [full address]",
              "Email: hello@guilleoutes.com",
              "Companies Register: [volume, page, sheet and entry]",
              "Activity: retail of clothing and sporting goods",
            ],
          ),
        ],
      },
      {
        heading: {
          es: "Propiedad intelectual",
          gl: "Propiedade intelectual",
          en: "Intellectual property",
        },
        blocks: [
          p(
            "Los diseños, textos, fotografías, ilustraciones, la marca y el código de este sitio son propiedad del titular o se usan con licencia. No pueden reproducirse, distribuirse ni transformarse sin autorización escrita, salvo los usos permitidos por la ley.",
            "Os deseños, textos, fotografías, ilustracións, a marca e o código deste sitio son propiedade do titular ou úsanse con licenza. Non poden reproducirse, distribuírse nin transformarse sen autorización escrita, salvo os usos permitidos pola lei.",
            "The designs, text, photographs, illustrations, trade mark and code on this site belong to the owner or are used under licence. They may not be reproduced, distributed or altered without written permission, except where the law allows.",
          ),
        ],
      },
      {
        heading: {
          es: "Responsabilidad y enlaces",
          gl: "Responsabilidade e ligazóns",
          en: "Liability and links",
        },
        blocks: [
          p(
            "Procuramos que la información del sitio sea exacta y esté actualizada, pero no garantizamos que esté libre de errores. Los enlaces a sitios de terceros se ofrecen sólo como referencia y no implican que asumamos responsabilidad sobre sus contenidos.",
            "Procuramos que a información do sitio sexa exacta e estea actualizada, pero non garantimos que estea libre de erros. As ligazóns a sitios de terceiros ofrécense só como referencia e non implican que asumamos responsabilidade sobre os seus contidos.",
            "We aim to keep the information on this site accurate and current, but we do not warrant that it is free of errors. Links to third-party sites are provided for reference only and do not imply any responsibility on our part for their content.",
          ),
        ],
      },
      {
        heading: {
          es: "Legislación aplicable",
          gl: "Lexislación aplicable",
          en: "Governing law",
        },
        blocks: [
          p(
            "Esta relación se rige por la legislación española. Para cualquier controversia serán competentes los juzgados del domicilio del consumidor.",
            "Esta relación réxese pola lexislación española. Para calquera controversia serán competentes os xulgados do domicilio da persoa consumidora.",
            "This relationship is governed by Spanish law. Any dispute falls to the courts of the consumer's place of residence.",
          ),
        ],
      },
    ],
  },
  {
    slug: "privacidad",
    slugs: { gl: "privacidade", en: "privacy" },
    topic: "legal",
    title: {
      es: "Política de privacidad",
      gl: "Política de privacidade",
      en: "Privacy policy",
    },
    summary: {
      es: "Qué datos tratamos, por qué, cuánto tiempo y qué derechos tienes.",
      gl: "Que datos tratamos, por que, canto tempo e que dereitos tes.",
      en: "What data we process, why, for how long, and your rights.",
    },
    sections: [
      {
        heading: {
          es: "Responsable del tratamiento",
          gl: "Responsable do tratamento",
          en: "Data controller",
        },
        blocks: [
          TEMPLATE_NOTICE,
          items(
            [
              "Responsable: [razón social] — NIF [identificación fiscal]",
              "Dirección: [dirección completa]",
              "Correo de privacidad: privacidad@guilleoutes.com",
              "Delegado de protección de datos: [nombre y contacto, si procede]",
            ],
            [
              "Responsable: [razón social] — NIF [identificación fiscal]",
              "Enderezo: [enderezo completo]",
              "Correo de privacidade: privacidade@guilleoutes.com",
              "Delegado de protección de datos: [nome e contacto, se procede]",
            ],
            [
              "Controller: [legal name] — Tax ID [tax identification]",
              "Address: [full address]",
              "Privacy contact: privacy@guilleoutes.com",
              "Data protection officer: [name and contact, if appointed]",
            ],
          ),
        ],
      },
      {
        heading: {
          es: "Qué datos tratamos y con qué base legal",
          gl: "Que datos tratamos e con que base legal",
          en: "What we process and on what legal basis",
        },
        blocks: [
          {
            type: "table",
            table: {
              head: {
                es: ["Finalidad", "Datos", "Base jurídica", "Conservación"],
                gl: ["Finalidade", "Datos", "Base xurídica", "Conservación"],
                en: ["Purpose", "Data", "Legal basis", "Retention"],
              },
              rows: {
                es: [
                  [
                    "Gestionar tu cuenta",
                    "Nombre, correo, contraseña cifrada",
                    "Ejecución del contrato (art. 6.1.b)",
                    "Mientras la cuenta esté activa",
                  ],
                  [
                    "Tramitar pedidos y devoluciones",
                    "Dirección, teléfono, historial de compra",
                    "Ejecución del contrato (art. 6.1.b)",
                    "5 años (garantías y reclamaciones)",
                  ],
                  [
                    "Cobrar el pedido",
                    "Importe y referencia; la tarjeta la trata el banco",
                    "Ejecución del contrato (art. 6.1.b)",
                    "Según normativa de pagos",
                  ],
                  [
                    "Facturación y contabilidad",
                    "Datos fiscales de la operación",
                    "Obligación legal (art. 6.1.c)",
                    "6 años (Código de Comercio)",
                  ],
                  [
                    "Enviarte novedades",
                    "Nombre y correo",
                    "Consentimiento (art. 6.1.a)",
                    "Hasta que te des de baja",
                  ],
                  [
                    "Medir el uso del sitio",
                    "Datos de navegación agregados",
                    "Consentimiento (cookies)",
                    "13 meses",
                  ],
                ],
                gl: [
                  [
                    "Xestionar a túa conta",
                    "Nome, correo, contrasinal cifrado",
                    "Execución do contrato (art. 6.1.b)",
                    "Mentres a conta estea activa",
                  ],
                  [
                    "Tramitar pedidos e devolucións",
                    "Enderezo, teléfono, historial de compra",
                    "Execución do contrato (art. 6.1.b)",
                    "5 anos (garantías e reclamacións)",
                  ],
                  [
                    "Cobrar o pedido",
                    "Importe e referencia; a tarxeta trátaa o banco",
                    "Execución do contrato (art. 6.1.b)",
                    "Segundo normativa de pagamentos",
                  ],
                  [
                    "Facturación e contabilidade",
                    "Datos fiscais da operación",
                    "Obriga legal (art. 6.1.c)",
                    "6 anos (Código de Comercio)",
                  ],
                  [
                    "Enviarche novidades",
                    "Nome e correo",
                    "Consentimento (art. 6.1.a)",
                    "Ata que te dés de baixa",
                  ],
                  [
                    "Medir o uso do sitio",
                    "Datos de navegación agregados",
                    "Consentimento (cookies)",
                    "13 meses",
                  ],
                ],
                en: [
                  [
                    "Running your account",
                    "Name, email, hashed password",
                    "Performance of a contract (art. 6(1)(b))",
                    "While the account is active",
                  ],
                  [
                    "Orders and returns",
                    "Address, phone, purchase history",
                    "Performance of a contract (art. 6(1)(b))",
                    "5 years (warranty and claims)",
                  ],
                  [
                    "Taking payment",
                    "Amount and reference; the card is handled by the bank",
                    "Performance of a contract (art. 6(1)(b))",
                    "As payment rules require",
                  ],
                  [
                    "Invoicing and accounting",
                    "Tax details of the transaction",
                    "Legal obligation (art. 6(1)(c))",
                    "6 years (Spanish Commercial Code)",
                  ],
                  [
                    "Sending you news",
                    "Name and email",
                    "Consent (art. 6(1)(a))",
                    "Until you unsubscribe",
                  ],
                  [
                    "Measuring site usage",
                    "Aggregated browsing data",
                    "Consent (cookies)",
                    "13 months",
                  ],
                ],
              },
            },
          },
          p(
            "Nunca tratamos datos de categoría especial y no tomamos decisiones automatizadas que te afecten significativamente. Tampoco elaboramos perfiles para venderlos.",
            "Nunca tratamos datos de categoría especial e non tomamos decisións automatizadas que te afecten significativamente. Tampouco elaboramos perfís para vendelos.",
            "We never process special-category data, and we make no automated decisions that significantly affect you. We do not build profiles to sell.",
          ),
        ],
      },
      {
        heading: {
          es: "Quién más ve tus datos",
          gl: "Quen máis ve os teus datos",
          en: "Who else sees your data",
        },
        blocks: [
          items(
            [
              "La entidad bancaria que procesa el pago (Redsys y tu banco). Nosotros no vemos ni guardamos el número de tarjeta.",
              "La empresa de transporte, para entregarte el pedido.",
              "El proveedor de alojamiento y de correo, como encargados del tratamiento, con contrato del artículo 28 del RGPD.",
              "La Administración, cuando una norma nos obliga.",
            ],
            [
              "A entidade bancaria que procesa o pagamento (Redsys e o teu banco). Nós non vemos nin gardamos o número de tarxeta.",
              "A empresa de transporte, para entregarche o pedido.",
              "O provedor de aloxamento e de correo, como encargados do tratamento, con contrato do artigo 28 do RGPD.",
              "A Administración, cando unha norma nos obriga.",
            ],
            [
              "The bank that processes the payment (Redsys and your bank). We never see or store your card number.",
              "The courier, to deliver your order.",
              "Our hosting and email providers, as processors, under an article 28 GDPR agreement.",
              "Public authorities, where the law requires it.",
            ],
          ),
          p(
            "No realizamos transferencias internacionales de datos fuera del Espacio Económico Europeo. Si en el futuro fuese necesario, se hará con las garantías del capítulo V del RGPD y se indicará aquí.",
            "Non realizamos transferencias internacionais de datos fóra do Espazo Económico Europeo. Se no futuro fose necesario, farase coas garantías do capítulo V do RGPD e indicarase aquí.",
            "We do not transfer data outside the European Economic Area. Should that ever become necessary, it will be done under the safeguards in chapter V of the GDPR and stated here.",
          ),
        ],
      },
      {
        heading: { es: "Tus derechos", gl: "Os teus dereitos", en: "Your rights" },
        blocks: [
          items(
            [
              "Acceso: saber qué datos tenemos sobre ti.",
              "Rectificación: corregir lo que esté mal.",
              "Supresión: pedir que los borremos.",
              "Oposición y limitación del tratamiento.",
              "Portabilidad: recibirlos en un formato reutilizable.",
              "Retirar el consentimiento en cualquier momento, sin que eso afecte a lo ya hecho.",
            ],
            [
              "Acceso: saber que datos temos sobre ti.",
              "Rectificación: corrixir o que estea mal.",
              "Supresión: pedir que os borremos.",
              "Oposición e limitación do tratamento.",
              "Portabilidade: recibilos nun formato reutilizable.",
              "Retirar o consentimento en calquera momento, sen que iso afecte ao xa feito.",
            ],
            [
              "Access: find out what we hold about you.",
              "Rectification: correct anything wrong.",
              "Erasure: ask us to delete it.",
              "Objection and restriction of processing.",
              "Portability: receive it in a reusable format.",
              "Withdraw consent at any time, without affecting what was lawful before.",
            ],
          ),
          p(
            "Escribe a privacidad@guilleoutes.com indicando qué derecho ejerces. Respondemos en el plazo máximo de un mes. Puedes retirar el consentimiento de marketing tú mismo desde «Mi cuenta». Si no estás conforme con nuestra respuesta, puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).",
            "Escribe a privacidade@guilleoutes.com indicando que dereito exerces. Respondemos no prazo máximo dun mes. Podes retirar o consentimento de marketing ti mesmo desde «A miña conta». Se non estás conforme coa nosa resposta, podes reclamar ante a Axencia Española de Protección de Datos (www.aepd.es).",
            "Email privacy@guilleoutes.com saying which right you are exercising. We reply within one month. You can withdraw marketing consent yourself from “My account”. If you are unhappy with our answer, you may complain to the Spanish Data Protection Agency (www.aepd.es).",
          ),
        ],
      },
      {
        heading: { es: "Seguridad", gl: "Seguridade", en: "Security" },
        blocks: [
          p(
            "Las contraseñas se guardan cifradas y nadie del equipo puede leerlas. La conexión va siempre por HTTPS. El acceso a la base de datos está restringido por usuario, de forma que nadie puede ver los datos de otra persona. Las credenciales de la pasarela de pago se almacenan cifradas.",
            "Os contrasinais gárdanse cifrados e ninguén do equipo pode lelos. A conexión vai sempre por HTTPS. O acceso á base de datos está restrinxido por usuario, de xeito que ninguén pode ver os datos doutra persoa. As credenciais da pasarela de pagamento almacénanse cifradas.",
            "Passwords are stored hashed and nobody on the team can read them. Connections always use HTTPS. Database access is restricted per user, so nobody can see another person's data. Payment gateway credentials are stored encrypted.",
          ),
        ],
      },
    ],
  },
  {
    slug: "cookies",
    slugs: { gl: "cookies", en: "cookies" },
    topic: "legal",
    title: { es: "Política de cookies", gl: "Política de cookies", en: "Cookie policy" },
    summary: {
      es: "Qué cookies usamos y cómo gestionarlas.",
      gl: "Que cookies usamos e como xestionalas.",
      en: "Which cookies we use and how to manage them.",
    },
    sections: [
      {
        blocks: [
          TEMPLATE_NOTICE,
          p(
            "Una cookie es un pequeño archivo que el sitio guarda en tu navegador. Usamos las mínimas necesarias para que la tienda funcione y, si lo aceptas, alguna más para entender cómo se usa.",
            "Unha cookie é un pequeno arquivo que o sitio garda no teu navegador. Usamos as mínimas necesarias para que a tenda funcione e, se o aceptas, algunha máis para entender como se usa.",
            "A cookie is a small file the site stores in your browser. We use the minimum needed for the shop to work and, if you accept, a few more to understand how it is used.",
          ),
          {
            type: "table",
            table: {
              head: {
                es: ["Cookie", "Tipo", "Finalidad", "Duración"],
                gl: ["Cookie", "Tipo", "Finalidade", "Duración"],
                en: ["Cookie", "Type", "Purpose", "Duration"],
              },
              rows: {
                es: [
                  ["sb-*-auth-token", "Técnica", "Mantener tu sesión iniciada", "Sesión / 1 año"],
                  ["go_locale", "Preferencia", "Recordar el idioma elegido", "1 año"],
                  ["go-cart-v2", "Técnica (almacenamiento local)", "Guardar tu cesta", "Hasta que la vacíes"],
                  ["Analítica", "Analítica", "Medir el uso de forma agregada", "13 meses"],
                ],
                gl: [
                  ["sb-*-auth-token", "Técnica", "Manter a túa sesión iniciada", "Sesión / 1 ano"],
                  ["go_locale", "Preferencia", "Lembrar o idioma escollido", "1 ano"],
                  ["go-cart-v2", "Técnica (almacenamento local)", "Gardar o teu carro", "Ata que o baleires"],
                  ["Analítica", "Analítica", "Medir o uso de forma agregada", "13 meses"],
                ],
                en: [
                  ["sb-*-auth-token", "Strictly necessary", "Keep you signed in", "Session / 1 year"],
                  ["go_locale", "Preference", "Remember your language", "1 year"],
                  ["go-cart-v2", "Strictly necessary (local storage)", "Hold your basket", "Until you empty it"],
                  ["Analytics", "Analytics", "Measure usage in aggregate", "13 months"],
                ],
              },
            },
          },
          p(
            "Las cookies técnicas no requieren consentimiento porque sin ellas la tienda no funciona. Las analíticas sólo se instalan si las aceptas, y puedes revocar el consentimiento en cualquier momento desde la configuración de tu navegador o escribiéndonos.",
            "As cookies técnicas non requiren consentimento porque sen elas a tenda non funciona. As analíticas só se instalan se as aceptas, e podes revogar o consentimento en calquera momento desde a configuración do teu navegador ou escribíndonos.",
            "Strictly necessary cookies need no consent, because without them the shop does not work. Analytics cookies are only set if you accept them, and you can withdraw consent at any time from your browser settings or by emailing us.",
          ),
          p(
            "Pendiente: el banner de consentimiento previo todavía no está implementado. Hasta que lo esté, no se cargan cookies analíticas ni de marketing.",
            "Pendente: o banner de consentimento previo aínda non está implementado. Ata que o estea, non se cargan cookies analíticas nin de marketing.",
            "Outstanding: the prior-consent banner is not built yet. Until it is, no analytics or marketing cookies are loaded at all.",
          ),
        ],
      },
    ],
  },
  {
    slug: "condiciones",
    slugs: { gl: "condicions", en: "terms" },
    topic: "legal",
    title: {
      es: "Condiciones de venta",
      gl: "Condicións de venda",
      en: "Terms of sale",
    },
    summary: {
      es: "Contratación, precios, entrega, desistimiento y garantías.",
      gl: "Contratación, prezos, entrega, desistimento e garantías.",
      en: "Ordering, prices, delivery, withdrawal and warranties.",
    },
    sections: [
      {
        heading: { es: "El contrato", gl: "O contrato", en: "The contract" },
        blocks: [
          TEMPLATE_NOTICE,
          items(
            [
              "Para comprar hay que ser mayor de 18 años y tener una cuenta.",
              "Los precios se muestran en euros con el IVA incluido; los gastos de envío se indican antes de pagar.",
              "El contrato queda perfeccionado cuando te enviamos la confirmación del pedido por correo electrónico.",
              "Si un artículo aparece con un precio manifiestamente erróneo, te avisaremos antes de cobrar y podrás anular el pedido.",
            ],
            [
              "Para comprar hai que ser maior de 18 anos e ter unha conta.",
              "Os prezos móstranse en euros co IVE incluído; os gastos de envío indícanse antes de pagar.",
              "O contrato queda perfeccionado cando che enviamos a confirmación do pedido por correo electrónico.",
              "Se un artigo aparece cun prezo manifestamente erróneo, avisarémoste antes de cobrar e poderás anular o pedido.",
            ],
            [
              "You must be 18 or over and have an account to buy.",
              "Prices are shown in euros including VAT; shipping is shown before you pay.",
              "The contract is formed when we send you the order confirmation by email.",
              "If an item is listed at an obviously wrong price we will tell you before charging, and you may cancel.",
            ],
          ),
        ],
      },
      {
        heading: { es: "Pago", gl: "Pagamento", en: "Payment" },
        blocks: [
          p(
            "El cobro se realiza a través de la pasarela segura de nuestra entidad bancaria (Redsys). Los datos de la tarjeta se introducen en el entorno del banco: no pasan por nuestros servidores ni se almacenan en ningún momento. El cargo se produce al confirmar la operación.",
            "O cobro realízase a través da pasarela segura da nosa entidade bancaria (Redsys). Os datos da tarxeta introdúcense no contorno do banco: non pasan polos nosos servidores nin se almacenan en ningún momento. O cargo prodúcese ao confirmar a operación.",
            "Payment is taken through our bank's secure gateway (Redsys). Card details are entered inside the bank's environment: they never pass through our servers and are never stored. The charge is made when the transaction is confirmed.",
          ),
        ],
      },
      {
        heading: { es: "Entrega", gl: "Entrega", en: "Delivery" },
        blocks: [
          p(
            "Los plazos y costes figuran en la página de envíos y se confirman antes de pagar. Si no pudiéramos entregar en 30 días desde la confirmación, podrás resolver el contrato y te devolveremos el importe íntegro. El riesgo de pérdida pasa a ti cuando recibes el paquete.",
            "Os prazos e custos figuran na páxina de envíos e confírmanse antes de pagar. Se non puideramos entregar en 30 días desde a confirmación, poderás resolver o contrato e devolverémosche o importe íntegro. O risco de perda pasa a ti cando recibes o paquete.",
            "Times and costs are listed on the shipping page and confirmed before you pay. If we cannot deliver within 30 days of confirmation you may cancel and we refund in full. Risk of loss passes to you on delivery.",
          ),
        ],
      },
      {
        heading: {
          es: "Derecho de desistimiento",
          gl: "Dereito de desistimento",
          en: "Right of withdrawal",
        },
        blocks: [
          p(
            "Tienes 14 días naturales por ley para desistir sin dar explicaciones; nosotros ampliamos el plazo a 30 días. Cuenta desde que recibes el pedido. Basta con comunicárnoslo desde «Mis pedidos» o por correo, o usar el formulario de desistimiento oficial. Devolvemos el importe, incluidos los gastos de envío estándar, en un plazo máximo de 14 días desde que recibimos la devolución.",
            "Tes 14 días naturais por lei para desistir sen dar explicacións; nós ampliamos o prazo a 30 días. Conta desde que recibes o pedido. Abonda con comunicárnolo desde «Os meus pedidos» ou por correo, ou usar o formulario de desistimento oficial. Devolvemos o importe, incluídos os gastos de envío estándar, nun prazo máximo de 14 días desde que recibimos a devolución.",
            "You have a statutory 14 calendar days to withdraw without giving a reason; we extend it to 30. It runs from delivery. Just tell us from “My orders” or by email, or use the official withdrawal form. We refund the amount, including standard delivery, within 14 days of receiving the return.",
          ),
          items(
            [
              "Excepciones legales al desistimiento: artículos personalizados con nombre o dorsal, y prendas usadas, lavadas o sin etiqueta.",
              "Las tarjetas regalo no son reembolsables en efectivo.",
              "El coste de devolverlo lo asumimos nosotros dentro de la península.",
            ],
            [
              "Excepcións legais ao desistimento: artigos personalizados con nome ou dorsal, e pezas usadas, lavadas ou sen etiqueta.",
              "As tarxetas agasallo non son reembolsables en efectivo.",
              "O custo de devolvelo asumímolo nós dentro da península.",
            ],
            [
              "Statutory exceptions: items personalised with a name or number, and garments that have been worn, washed or had the tag removed.",
              "Gift cards are not exchangeable for cash.",
              "We cover the cost of returning items within mainland Spain.",
            ],
          ),
        ],
      },
      {
        heading: {
          es: "Garantía legal",
          gl: "Garantía legal",
          en: "Statutory guarantee",
        },
        blocks: [
          p(
            "Respondemos de las faltas de conformidad durante 3 años desde la entrega, conforme al Real Decreto Legislativo 1/2007. Si un artículo sale defectuoso, lo reparamos o lo sustituimos sin coste; si no es posible, te devolvemos el importe. Esta garantía es independiente del derecho de desistimiento.",
            "Respondemos das faltas de conformidade durante 3 anos desde a entrega, conforme ao Real Decreto Lexislativo 1/2007. Se un artigo sae defectuoso, reparámolo ou substituímolo sen custo; se non é posible, devolvémosche o importe. Esta garantía é independente do dereito de desistimento.",
            "We are liable for lack of conformity for 3 years from delivery, under Spanish Royal Legislative Decree 1/2007. If an item is faulty we repair or replace it free of charge; if that is not possible, we refund it. This is separate from the right of withdrawal.",
          ),
        ],
      },
      {
        heading: {
          es: "Reclamaciones y resolución de conflictos",
          gl: "Reclamacións e resolución de conflitos",
          en: "Complaints and dispute resolution",
        },
        blocks: [
          p(
            "Escríbenos a pedidos@guilleoutes.com y contestamos en 24 horas laborables. Si no llegamos a un acuerdo, puedes acudir a la plataforma europea de resolución de litigios en línea (ec.europa.eu/consumers/odr) o a la junta arbitral de consumo de tu comunidad. Las series numeradas no admiten reposición ni reserva.",
            "Escríbenos a pedidos@guilleoutes.com e contestamos en 24 horas laborables. Se non chegamos a un acordo, podes acudir á plataforma europea de resolución de litixios en liña (ec.europa.eu/consumers/odr) ou á xunta arbitral de consumo da túa comunidade. As series numeradas non admiten reposición nin reserva.",
            "Email orders@guilleoutes.com and we reply within 24 working hours. If we cannot agree, you may use the European online dispute resolution platform (ec.europa.eu/consumers/odr) or your regional consumer arbitration board. Numbered series cannot be restocked or reserved.",
          ),
        ],
      },
    ],
  },
];

/* ---------------------------------------------------------------- access */

export function helpDocs(locale: Locale): Doc[] {
  return HELP.map((doc) => resolveDoc(doc, locale));
}

export function legalDocs(locale: Locale): Doc[] {
  return LEGAL.map((doc) => resolveDoc(doc, locale));
}

/** Matches a slug written in any language, so shared links keep working. */
function findIn(docs: RawDoc[], slug: string): RawDoc | undefined {
  return docs.find(
    (doc) => doc.slug === slug || Object.values(docSlugs(doc)).includes(slug),
  );
}

export function findHelpDoc(slug: string, locale: Locale): Doc | undefined {
  const raw = findIn(HELP, slug);
  return raw ? resolveDoc(raw, locale) : undefined;
}

export function findLegalDoc(slug: string, locale: Locale): Doc | undefined {
  const raw = findIn(LEGAL, slug);
  return raw ? resolveDoc(raw, locale) : undefined;
}

/** Every locale's slug, for generateStaticParams. */
export const HELP_SLUGS = [...new Set(HELP.flatMap((doc) => Object.values(docSlugs(doc))))];
export const LEGAL_SLUGS = [...new Set(LEGAL.flatMap((doc) => Object.values(docSlugs(doc))))];

/* ------------------------------------------------------- slug helpers */

/**
 * Canonical id → this locale's slug, for building links.
 *
 * Pure and dependency-free, so client components can use it too. Falls back to
 * the id, which the routes also accept, so a typo degrades to a redirect rather
 * than a 404.
 */
export function helpSlug(id: string, locale: Locale): string {
  const doc = HELP.find((candidate) => candidate.slug === id);
  return doc ? docSlugs(doc)[locale] : id;
}

export function legalSlug(id: string, locale: Locale): string {
  const doc = LEGAL.find((candidate) => candidate.slug === id);
  return doc ? docSlugs(doc)[locale] : id;
}
