import type { ArtPrint, ArtShape, Colorway } from "@/components/brand/product-art";
import { photosFor } from "@/components/product/product-shot";
import {
  colorway as colorwayFor,
  compareSizes,
  frameSizeFor,
  onSale,
  priceRange,
  stockFor,
  unitPriceFor,
  type FrameChoice,
  type FrameFinish,
  type FrameShot,
  type Product,
} from "@/lib/catalog";
import type { Locale } from "@/lib/i18n/config";
import { mediaUrl } from "@/lib/supabase/env";

/** One format the shelf can put in the basket, priced as it will be charged. */
export type SuggestionChoice = {
  size: string;
  /** Cents for one unit, frame included when the piece is added framed. */
  price: number;
};

/**
 * One suggested product, reduced to what a tile draws — and to what its "añadir"
 * button can put in the basket without asking a second question.
 *
 * Not a `Product`: the cart lives in the browser, so this crosses the wire every
 * time the basket changes, and a catalogue row carries variants, stock levels,
 * size guides and framing options that a 4 rem thumbnail has no use for. What it
 * does carry is `choices`: the formats actually in stock in the colour the tile
 * shows, so the button adds something buyable rather than the first size in the
 * catalogue. Every price here is still the catalogue's own and still for display
 * — `placeOrder` re-prices the line from the database before anyone is charged.
 */
export type CartSuggestion = {
  id: string;
  slug: string;
  /** The shop's own reference, as a cart line carries it. */
  ref: string;
  name: string;
  /** The section it comes from — the reason it is being suggested at all. */
  section: string;
  /** What the tile shows: the default choice, or the cheapest of several. */
  price: number;
  /** True when a larger format costs more, so the figure reads "desde 40 €". */
  from: boolean;
  compareAt?: number;
  /**
   * The formats in stock, cheapest-looking first — the order the size buttons
   * use on the product page. Empty when the colour shown is sold out in every
   * size, and then the tile is a link with no button.
   */
  choices: SuggestionChoice[];
  /**
   * The frame the shelf adds a cuadro with: the first finish it offers, which is
   * the one the thumbnail draws. Absent for anything not sold framed, which is
   * how the line reaches the basket without a frame field at all.
   */
  frameFinish?: FrameChoice;
  /** The photograph, when the product has one. */
  imageUrl: string | null;
  /** Enough to draw the vector artwork for a product nobody has photographed. */
  shape: ArtShape;
  print: ArtPrint;
  colorway: Colorway;
  /**
   * Set for a cuadro, which hangs in a frame here exactly as it does in a
   * listing — and goes on hanging in it once the button puts it in the basket,
   * which is why the measurements travel rather than a finished aspect string.
   */
  frame: (FrameShot & { finish: FrameFinish }) | null;
};

/** A catalogue row as the shelf wants it. `section` is the category's own name. */
export function toSuggestion(product: Product, section: string, locale: Locale): CartSuggestion {
  // One colour, and it is the first — the same one a listing card opens on, so
  // the shelf and the product page show the shopper the same thing.
  const colorway = product.colorways[0] ?? colorwayFor("negro", locale);
  const photo = photosFor(product, colorway.id)[0];

  const frame = product.framePreview;
  /*
    A cuadro goes into the basket framed, in the first finish it offers, because
    that is the piece as the thumbnail draws it and as the product page opens on
    it. Null for everything else, and a camiseta has no frame to pay for.
  */
  const frameFinish: FrameChoice | null = frame ? (frame.finishes[0] ?? "none") : null;

  /*
    Only what can be bought in the colour on show. Stock is per size × colour, so
    a shelf that offered the catalogue's first size would sometimes offer the one
    size that ran out — and the price carries the frame, because that is what the
    line will cost.
  */
  const choices: SuggestionChoice[] = [...product.sizes]
    .sort(compareSizes)
    .filter((candidate) => stockFor(product, candidate, colorway.id) > 0)
    .map((candidate) => ({ size: candidate, price: unitPriceFor(product, candidate, frameFinish) }));

  /*
    The figure on the tile is the figure the button charges. A piece with one
    format left, and a cuadro — which is added in its default format without
    asking — show that format's price outright; a camiseta still to be sized
    shows the cheapest as a "desde". With nothing in stock there is no button, so
    the catalogue's own range stands in.
  */
  const prices = choices.map((choice) => choice.price);
  const range = priceRange(product);
  const from = prices.length ? Math.min(...prices) : range.from;
  const to = prices.length ? Math.max(...prices) : range.to;
  const fixed = choices.length === 1 || frameFinish !== null;

  // The format the tile hangs: the one it would add, so the picture and the
  // button agree even when the smallest has sold out.
  const size = frame ? frameSizeFor(frame, choices[0]?.size ?? null) : null;

  return {
    id: product.id,
    slug: product.slug,
    ref: product.ref,
    name: product.name,
    section,
    price: fixed ? (choices[0]?.price ?? from) : from,
    from: !fixed && to > from,
    choices,
    frameFinish: frameFinish ?? undefined,
    compareAt: onSale(product) ? product.compareAt : undefined,
    imageUrl: photo ? mediaUrl(photo.path) : null,
    shape: product.shape,
    print: product.print,
    colorway,
    frame: frame && size ? { finish: frame.finishes[0], mount: frame.mount, print: size } : null,
  };
}
