"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { ArtPrint, ArtShape, Colorway } from "@/components/brand/product-art";
import { useI18n } from "@/components/i18n/provider";
import {
  normalizeCode,
  totalWithDiscount,
  type AppliedDiscount,
  type DiscountRefusal,
  type DiscountResult,
} from "@/lib/discounts";
import { quoteDiscount } from "@/lib/orders/discount-actions";
import {
  DEFAULT_SHIPPING,
  freeShippingProgress,
  shippingCost,
  type ShippingMethod,
  type ShippingSettings,
} from "@/lib/shipping";

const STORAGE_KEY = "go-cart-v2";

/**
 * The applied discount code, and only the code.
 *
 * What it is worth is never persisted: the basket changes, campaigns end, and a
 * saving remembered from yesterday would be a number on screen that the server
 * refuses at the till. The string is re-checked against the live basket on every
 * mount and after every edit, so the figure the cart shows is one the server
 * agreed to a moment ago — and `placeOrder` asks again anyway.
 */
const CODE_KEY = "go-cart-code-v1";

/**
 * A cart line stores a snapshot of what the shopper saw, because the catalogue
 * lives in the database and the cart is client-side. The snapshot is for display
 * only: quantities and prices must be re-validated server-side when the order is
 * actually placed, so a tampered localStorage cannot change what gets charged.
 */
/**
 * The child's drawing printed on this line, when there is one.
 *
 * A snapshot like the rest of the line, and for the same reason: it is what the
 * drawer and the cart page draw. `placeOrder` re-reads the artwork by id and
 * refuses one that is not published, so nothing here decides what gets printed.
 */
export type CartArtwork = {
  id: string;
  slug: string;
  title: string;
  author: string;
  imageUrl: string;
};

export type CartLine = {
  key: string;
  slug: string;
  productId: string;
  ref: string;
  name: string;
  size: string;
  qty: number;
  /** Integer cents, as displayed when the item was added. */
  price: number;
  shape: ArtShape;
  print: ArtPrint;
  colorway: Colorway;
  artwork?: CartArtwork;
  lineTotal: number;
};

type StoredLine = Omit<CartLine, "key" | "lineTotal">;

export type AddToCartInput = StoredLine;

/* ========================================================== external store
 *
 * localStorage is an external system, so it is read through
 * `useSyncExternalStore` rather than mirrored into state inside an effect. That
 * keeps the server render (empty cart) and the first client render consistent
 * without a cascading re-render, and it gives cross-tab sync for free.
 */

const EMPTY: StoredLine[] = [];

let snapshot: StoredLine[] = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function isStoredLine(value: unknown): value is StoredLine {
  if (typeof value !== "object" || value === null) return false;
  const line = value as Partial<StoredLine>;

  // Absent is fine — most lines are ordinary catalogue items. Present but
  // malformed is not: a line whose artwork has no id would reach checkout with
  // nothing to look up, so the whole line is dropped rather than half-trusted.
  if (line.artwork !== undefined) {
    const artwork = line.artwork as Partial<CartArtwork> | null;
    if (
      typeof artwork !== "object" ||
      artwork === null ||
      typeof artwork.id !== "string" ||
      typeof artwork.imageUrl !== "string"
    ) {
      return false;
    }
  }

  return (
    typeof line.slug === "string" &&
    typeof line.size === "string" &&
    typeof line.name === "string" &&
    typeof line.price === "number" &&
    Number.isFinite(line.qty) &&
    typeof line.colorway === "object" &&
    line.colorway !== null &&
    typeof line.colorway.id === "string"
  );
}

function readStorage(): StoredLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    const lines = parsed.filter(isStoredLine);
    return lines.length ? lines : EMPTY;
  } catch {
    return EMPTY;
  }
}

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  // Another tab changed the cart: re-read and notify.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    snapshot = readStorage();
    emit();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): StoredLine[] {
  if (!hydrated) {
    snapshot = readStorage();
    hydrated = true;
  }
  return snapshot;
}

const getServerSnapshot = (): StoredLine[] => EMPTY;

function commit(next: StoredLine[]) {
  snapshot = next;
  hydrated = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode or a full quota: the cart still works for this page view.
  }
  emit();
}

/* ----------------------------------------------------- the code, likewise
 *
 * Its own store rather than a field on the cart's, because the two change for
 * different reasons and a code applied in one tab should follow the shopper into
 * the other exactly as the basket does.
 */

let codeSnapshot: string | null = null;
let codeHydrated = false;
const codeListeners = new Set<() => void>();

function readCode(): string | null {
  try {
    const raw = window.localStorage.getItem(CODE_KEY);
    return raw ? normalizeCode(raw) : null;
  } catch {
    return null;
  }
}

function subscribeCode(listener: () => void) {
  codeListeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== CODE_KEY) return;
    codeSnapshot = readCode();
    for (const notify of codeListeners) notify();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    codeListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getCodeSnapshot(): string | null {
  if (!codeHydrated) {
    codeSnapshot = readCode();
    codeHydrated = true;
  }
  return codeSnapshot;
}

const getCodeServerSnapshot = (): string | null => null;

function commitCode(next: string | null) {
  codeSnapshot = next;
  codeHydrated = true;
  try {
    if (next) window.localStorage.setItem(CODE_KEY, next);
    else window.localStorage.removeItem(CODE_KEY);
  } catch {
    // Private mode or a full quota: the code still applies for this page view.
  }
  for (const notify of codeListeners) notify();
}

/* ================================================================ context */

/** Everything the promo-code box needs to draw itself. */
export type CartDiscount = {
  /** What the shopper typed, upper-cased. Null when no code is applied. */
  code: string | null;
  /** The verdict, or null while it is being checked or has been refused. */
  applied: AppliedDiscount | null;
  state: "idle" | "checking" | "applied" | "refused";
  /** Why it was refused, for the sentence to show. */
  refusal: DiscountRefusal | null;
  /** The threshold, in cents, when the refusal is `min_subtotal`. */
  detail: number | null;
};

type CartValue = {
  lines: CartLine[];
  count: number;
  subtotal: number;
  shipping: number;
  /** Cents off, waived delivery included. Zero without a code. */
  discountCents: number;
  total: number;
  /**
   * The shop's live rates, read from the database on the server and handed down
   * so every price in the browser comes from the same place the order is charged
   * from. Client components must not import the numbers directly.
   */
  shippingSettings: ShippingSettings;
  /** How much more to spend for free standard delivery, and how far along. */
  freeShipping: { missing: number; percent: number; reached: boolean };
  /** False during the server render and until the store is first read. */
  ready: boolean;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  add: (input: AddToCartInput) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;

  discount: CartDiscount;
  applyCode: (raw: string) => void;
  clearCode: () => void;
  /**
   * Which delivery service to judge a free-shipping code against.
   *
   * The cart and the drawer quote the standard rate, so they leave this alone.
   * The checkout has a chooser, and a free-delivery code is worth nothing on an
   * order that already has free standard delivery but everything on an express
   * one — so it tells the provider which service is selected.
   */
  setQuoteMethod: (method: ShippingMethod) => void;
  /** The lines as the server wants them: choices only, never prices. */
  linesJson: string;
};

const CartContext = createContext<CartValue | null>(null);

/**
 * What makes two lines the same line.
 *
 * The artwork is part of it, and has to be: the same tee in the same size and
 * colour with two different children's drawings on it is two different things to
 * make. Without the id in the key the second one would silently increment the
 * quantity of the first, and one of the two drawings would never be printed.
 */
const lineKey = (line: Pick<StoredLine, "slug" | "size" | "colorway" | "artwork">) =>
  `${line.slug}|${line.size}|${line.colorway.id}|${line.artwork?.id ?? ""}`;

export function CartProvider({
  children,
  shippingSettings = DEFAULT_SHIPPING,
}: {
  children: ReactNode;
  shippingSettings?: ShippingSettings;
}) {
  const { locale } = useI18n();
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [isOpen, setIsOpen] = useState(false);

  // Lock the page behind the drawer.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  const add = useCallback<CartValue["add"]>((input) => {
    const key = lineKey(input);
    const current = getSnapshot();
    const existing = current.find((line) => lineKey(line) === key);

    commit(
      existing
        ? current.map((line) =>
            lineKey(line) === key
              ? { ...line, qty: Math.min(10, line.qty + input.qty) }
              : line,
          )
        : [...current, { ...input, qty: Math.min(10, Math.max(1, input.qty)) }],
    );

    setIsOpen(true);
  }, []);

  const setQty = useCallback<CartValue["setQty"]>((key, qty) => {
    const current = getSnapshot();
    commit(
      qty <= 0
        ? current.filter((line) => lineKey(line) !== key)
        : current.map((line) =>
            lineKey(line) === key ? { ...line, qty: Math.min(10, qty) } : line,
          ),
    );
  }, []);

  const remove = useCallback<CartValue["remove"]>((key) => {
    commit(getSnapshot().filter((line) => lineKey(line) !== key));
  }, []);

  /* ------------------------------------------------------------- the code */

  // Read through the same external-store machinery as the basket, so it
  // hydrates without an effect and syncs across tabs for free.
  const code = useSyncExternalStore(subscribeCode, getCodeSnapshot, getCodeServerSnapshot);
  const [quoteMethod, setQuoteMethod] = useState<ShippingMethod>("standard");

  const applyCode = useCallback((raw: string) => commitCode(normalizeCode(raw) || null), []);
  const clearCode = useCallback(() => commitCode(null), []);

  const clear = useCallback(() => {
    commit(EMPTY);
    commitCode(null);
  }, []);

  /** Choices only — the same payload the checkout posts. */
  const linesJson = useMemo(
    () =>
      JSON.stringify(
        stored.map((line) => ({
          slug: line.slug,
          size: line.size,
          colorwayId: line.colorway.id,
          qty: line.qty,
          artworkId: line.artwork?.id,
        })),
      ),
    [stored],
  );

  /**
   * Everything a verdict depends on, in one string.
   *
   * Adding an item can push a basket over a minimum; removing one can take it
   * back under; changing the delivery service changes what a free-shipping code
   * is worth. Rather than track which change matters, the whole verdict is asked
   * for again whenever this key moves — and the answer is *stored under the key
   * it was asked for*, so a reply that arrives after the basket has moved on is
   * ignored rather than shown.
   */
  const quoteKey = code ? `${code} ${quoteMethod} ${linesJson}` : "";

  // No entry for the current key means the answer is still in flight; an entry
  // whose `result` is null means the round trip itself failed — which is not a
  // verdict, so a code is never declared bad because the network was. The
  // checkout asks again regardless, and nobody is overcharged.
  const [quote, setQuote] = useState<{ key: string; result: DiscountResult | null } | null>(null);

  useEffect(() => {
    if (!code || stored.length === 0) return;

    let cancelled = false;

    quoteDiscount({ code, lines: linesJson, shippingMethod: quoteMethod, locale })
      .then((result) => {
        if (!cancelled) setQuote({ key: quoteKey, result });
      })
      .catch(() => {
        if (!cancelled) setQuote({ key: quoteKey, result: null });
      });

    return () => {
      cancelled = true;
    };
  }, [quoteKey, code, linesJson, quoteMethod, locale, stored.length]);

  // Derived rather than stored: "checking" is simply not yet having an answer to
  // the question currently being asked, and deriving it means no state can be
  // left describing a basket that no longer exists.
  const fresh = quote && quote.key === quoteKey ? quote : null;
  const result = fresh?.result ?? null;
  const applied: AppliedDiscount | null = result?.ok ? result.discount : null;

  const codeState: CartDiscount["state"] =
    !code || stored.length === 0
      ? "idle"
      : !fresh
        ? "checking"
        : fresh.result === null
          ? "idle"
          : fresh.result.ok
            ? "applied"
            : "refused";

  const refusal: DiscountRefusal | null = result && !result.ok ? result.reason : null;
  const detail = result && !result.ok ? (result.detail ?? null) : null;

  const value = useMemo<CartValue>(() => {
    const lines: CartLine[] = stored.map((line) => ({
      ...line,
      key: lineKey(line),
      lineTotal: line.price * line.qty,
    }));

    const subtotal = lines.reduce((total, line) => total + line.lineTotal, 0);
    const count = lines.reduce((total, line) => total + line.qty, 0);
    // An empty cart has no delivery to pay for; otherwise this is the standard
    // service, which is what the cart and the drawer quote before checkout.
    const shipping = subtotal === 0 ? 0 : shippingCost(subtotal, "standard", shippingSettings);

    // Same helper the checkout, the order page and the email use, so every
    // rendering of this basket agrees to the cent.
    const priced = totalWithDiscount({
      subtotalCents: subtotal,
      shippingCents: shipping,
      discount: applied,
    });

    return {
      lines,
      count,
      subtotal,
      shipping,
      discountCents: priced.discountCents,
      total: priced.totalCents,
      shippingSettings,
      freeShipping: freeShippingProgress(subtotal, shippingSettings),
      ready,
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      add,
      setQty,
      remove,
      clear,
      discount: { code, applied, state: codeState, refusal, detail },
      applyCode,
      clearCode,
      setQuoteMethod,
      linesJson,
    };
  }, [
    stored,
    ready,
    isOpen,
    add,
    setQty,
    remove,
    clear,
    shippingSettings,
    code,
    applied,
    codeState,
    refusal,
    detail,
    applyCode,
    clearCode,
    linesJson,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartValue {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside <CartProvider>");
  return value;
}
