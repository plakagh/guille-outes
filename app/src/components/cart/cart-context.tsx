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
import {
  DEFAULT_SHIPPING,
  freeShippingProgress,
  shippingCost,
  type ShippingSettings,
} from "@/lib/shipping";

const STORAGE_KEY = "go-cart-v2";

/**
 * A cart line stores a snapshot of what the shopper saw, because the catalogue
 * lives in the database and the cart is client-side. The snapshot is for display
 * only: quantities and prices must be re-validated server-side when the order is
 * actually placed, so a tampered localStorage cannot change what gets charged.
 */
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

/* ================================================================ context */

type CartValue = {
  lines: CartLine[];
  count: number;
  subtotal: number;
  shipping: number;
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
};

const CartContext = createContext<CartValue | null>(null);

const lineKey = (line: Pick<StoredLine, "slug" | "size" | "colorway">) =>
  `${line.slug}|${line.size}|${line.colorway.id}`;

export function CartProvider({
  children,
  shippingSettings = DEFAULT_SHIPPING,
}: {
  children: ReactNode;
  shippingSettings?: ShippingSettings;
}) {
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

  const clear = useCallback(() => commit(EMPTY), []);

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

    return {
      lines,
      count,
      subtotal,
      shipping,
      total: subtotal + shipping,
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
    };
  }, [stored, ready, isOpen, add, setQty, remove, clear, shippingSettings]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartValue {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside <CartProvider>");
  return value;
}
