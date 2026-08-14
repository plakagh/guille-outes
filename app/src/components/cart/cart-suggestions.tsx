"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProductArt, type ArtOrientation } from "@/components/brand/product-art";
import { useCart } from "@/components/cart/cart-context";
import { useI18n } from "@/components/i18n/provider";
import { FramedArt } from "@/components/product/framed-art";
import { Price } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { suggestForCart } from "@/lib/cart/suggest-actions";
import type { CartSuggestion, SuggestionChoice } from "@/lib/cart/suggestions";
import { frameAspect, frameLabel, frameOrientation, ONE_SIZE } from "@/lib/catalog";
import { cn } from "@/lib/utils";

/**
 * "Completa tu pedido".
 *
 * Someone who has just put a cuadro in the basket is shown camisetas, and the
 * other way round — the rule and the reasoning behind it live in `crossSell`,
 * which is where the shop's own data decides what goes next to what.
 *
 * The shelf is fetched rather than rendered on the server, because the basket
 * only exists in the browser: the drawer is mounted in the layout and knows
 * nothing about the catalogue. So the same choices the checkout posts are sent
 * to `suggestForCart`, which sends back tiles — no prices, names or photographs
 * come from this side.
 *
 * Two things this has to say at a glance, because it sits directly under the
 * lines of a real order and was being read as part of it: that none of this is
 * in the basket yet, which is the heading and the sentence under it; and that it
 * takes one button to put it there, which is the button. What that button adds
 * is decided on the server — a cuadro goes in framed in its default format, the
 * one the thumbnail draws, and only a piece with several sizes left in stock
 * asks which one before adding.
 */
export function CartSuggestions({
  limit = 3,
  layout = "list",
  className,
}: {
  limit?: number;
  /** `list` for the drawer's narrow column, `grid` for the cart page. */
  layout?: "list" | "grid";
  className?: string;
}) {
  const { t, locale } = useI18n();
  const { linesJson, lines } = useCart();
  const [items, setItems] = useState<CartSuggestion[]>([]);

  const empty = lines.length === 0;

  useEffect(() => {
    // An empty basket is nothing to suggest from, and it is not a state this
    // renders in anyway — both callers show their own empty view instead.
    if (empty) return;

    let cancelled = false;
    suggestForCart({ lines: linesJson, locale, limit })
      .then((next) => {
        if (!cancelled) setItems(next);
      })
      // A shelf is not worth an error message. The previous picks stay on
      // screen rather than blinking out because one round trip failed.
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [linesJson, locale, limit, empty]);

  if (empty || items.length === 0) return null;

  return (
    <section
      className={cn(
        // Its own surface, and in the drawer a shaded one: this sits directly
        // below the lines of the order and must not read as one more of them.
        // On the page a single rule above says as much: a box drawn in ink on
        // all four sides shouted louder than the order it hangs under.
        layout === "list" ? "border-t-4 border-ink bg-shell px-5 py-5" : "border-t border-ink pt-6",
        className,
      )}
    >
      <h2 className={cn(layout === "list" ? "text-[1.0625rem]" : "text-xl")}>
        {t.cart.completeOrder}
      </h2>
      <p className="mt-1 text-[0.75rem] leading-snug text-mute">{t.cart.completeOrderHint}</p>

      <ul
        className={cn(
          "mt-4",
          layout === "list"
            ? // Rules between the tiles and one above the first, but none under
              // the last: it would only draw a second line a few pixels above
              // the one the total already brings.
              "divide-y divide-line-soft border-t border-line-soft"
            : "grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-4",
        )}
      >
        {items.map((item) => (
          <SuggestionTile key={item.id} item={item} layout={layout} />
        ))}
      </ul>
    </section>
  );
}

/**
 * One tile: the piece, what it costs, and the button that buys it.
 *
 * The picture and the name are still a link to the product page — there is more
 * to read there, and someone who wants the large format or another colour goes
 * looking for it. The button is beside the link rather than inside it, because
 * one click here should end with the thing in the basket and not on another page.
 */
function SuggestionTile({ item, layout }: { item: CartSuggestion; layout: "list" | "grid" }) {
  const { t, href } = useI18n();
  const { add, close } = useCart();
  /*
    Only reached by a piece with several sizes left: the button turns into its
    own sizes rather than opening anything, so the shelf never guesses a talla.
  */
  const [choosing, setChoosing] = useState(false);

  /*
    What one click adds, when one click is enough: the single format still in
    stock, or — for a cuadro — its default format in the frame the thumbnail
    draws, which is the piece as the product page opens on it. Null when there is
    a talla to pick first, and when the colour on show has sold out entirely.
  */
  const direct =
    item.choices.length === 1 || item.frameFinish !== undefined ? (item.choices[0] ?? null) : null;

  /*
    What the button would add, when it adds without asking: the format, and the
    frame it goes in — the same two things the basket line says about it once it
    is in there.
  */
  const meta = direct
    ? [
        direct.size === ONE_SIZE ? null : direct.size,
        item.frameFinish ? frameLabel(item.frameFinish, t.pdp) : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const addChoice = (choice: SuggestionChoice) => {
    add({
      slug: item.slug,
      productId: item.id,
      ref: item.ref,
      name: item.name,
      size: choice.size,
      qty: 1,
      // The catalogue's figure, as shown a line above. `placeOrder` re-prices
      // from the database before charging, exactly as it does for every line.
      price: choice.price,
      frameFinish: item.frameFinish,
      // The frame the tile drew, so the basket line draws the same one.
      frame: item.frame ? { mount: item.frame.mount, print: item.frame.print } : undefined,
      imageUrl: item.imageUrl ?? undefined,
      shape: item.shape,
      print: item.print,
      colorway: item.colorway,
    });
    setChoosing(false);
  };

  const link = (
    <Link
      href={href("product", item.slug)}
      onClick={close}
      className={cn(
        "group",
        layout === "list" ? "flex min-w-0 flex-1 items-center gap-3" : "flex flex-1 flex-col",
      )}
    >
      {layout === "list" ? (
        <div className="size-16 shrink-0 bg-shell">
          <SuggestionShot item={item} />
        </div>
      ) : (
        <div className="aspect-[3/4] shrink-0 overflow-hidden bg-shell">
          <div className="h-full w-full transition-transform duration-500 ease-[var(--ease-out-quint)] group-hover:scale-[1.04]">
            <SuggestionShot item={item} />
          </div>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className={cn("eyebrow text-[0.625rem] text-mute", layout === "grid" && "mt-2")}>
          {item.section}
        </p>
        <p className="mt-0.5 truncate text-[0.875rem] font-semibold leading-snug group-hover:underline">
          {item.name}
        </p>
        {/* In the row on the page the line is held open even when there is
            nothing to put in it: a camiseta with no format to name sat beside
            cuadros that had one, and its price and its button rode a line
            higher than theirs. */}
        {(meta || layout === "grid") && (
          <p className="mt-0.5 truncate text-[0.6875rem] text-mute">{meta || "\u00a0"}</p>
        )}
        <Price
          price={item.price}
          compareAt={item.compareAt}
          size="sm"
          fromLabel={item.from ? t.common.from : undefined}
          className="mt-1"
        />
      </div>
    </Link>
  );

  return (
    // A tile on the page is as tall as the tallest of its row, and hangs its
    // parts off that: picture at the top, button at the foot. Four of them read
    // as one shelf that way, rather than as four cards of their own heights.
    <li className={cn(layout === "list" ? "py-3" : "flex h-full flex-col")}>
      <div
        className={cn(layout === "list" ? "flex items-center gap-3" : "flex flex-1 flex-col gap-3")}
      >
        {link}

        {/* Sold out in every size is no button at all — the link stands, and the
            product page is where a shopper finds out about the other colours. */}
        {item.choices.length > 0 && !choosing && (
          <Button
            variant="outline"
            size="sm"
            block={layout === "grid"}
            aria-label={`${t.cart.addSuggestion} · ${item.name}`}
            onClick={() => (direct ? addChoice(direct) : setChoosing(true))}
            // The gap above is the row's minimum; `mt-auto` takes whatever else
            // is going, which is what lands every button of a row on one line.
            className={cn(layout === "list" ? "shrink-0" : "mt-auto")}
          >
            {t.cart.addSuggestion}
          </Button>
        )}
      </div>

      {choosing && (
        <div className={cn(layout === "list" ? "mt-2" : "mt-3")}>
          <p className="text-[0.6875rem] text-mute">{t.cart.chooseSize}</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {item.choices.map((choice) => (
              <li key={choice.size}>
                <button
                  type="button"
                  onClick={() => addChoice(choice)}
                  className="border border-line px-2.5 py-1 text-[0.75rem] font-semibold hover:border-ink hover:bg-ink hover:text-white"
                >
                  {choice.size}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

/** The thumbnail: framed for a cuadro, the bare product for everything else. */
function SuggestionShot({ item }: { item: CartSuggestion }) {
  if (!item.frame) return <SuggestionFace item={item} orientation="portrait" />;

  return (
    <FramedArt finish={item.frame.finish} mount={item.frame.mount} className="h-full w-full">
      <div style={{ aspectRatio: frameAspect(item.frame.print) }}>
        <SuggestionFace item={item} orientation={frameOrientation(item.frame.print)} bare />
      </div>
    </FramedArt>
  );
}

/**
 * The photograph if there is one, the drawn artwork otherwise — the same choice
 * `ProductShot` makes on a listing card, and for the same reasons: a scan keeps
 * its own proportions, but behind glass it fills the aperture the mount cuts.
 */
function SuggestionFace({
  item,
  orientation,
  bare = false,
}: {
  item: CartSuggestion;
  orientation: ArtOrientation;
  bare?: boolean;
}) {
  if (!item.imageUrl) {
    return (
      <ProductArt
        shape={item.shape}
        colorway={item.colorway}
        print={item.print}
        bare={bare}
        orientation={orientation}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.imageUrl}
      alt={item.name}
      loading="lazy"
      decoding="async"
      className={cn("h-full w-full", bare ? "object-cover" : "object-contain")}
    />
  );
}
