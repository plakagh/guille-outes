"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useOptimistic,
  useTransition,
  type ReactNode,
} from "react";
import { toggleWishlist } from "@/lib/account/actions";
import type { Locale } from "@/lib/i18n/config";
import { href } from "@/lib/i18n/routes";

type WishlistValue = {
  signedIn: boolean;
  ids: string[];
  count: number;
  has: (productId: string) => boolean;
  /** Signed out, this sends the visitor to sign in and comes back here after. */
  toggle: (productId: string) => void;
  pending: boolean;
};

const WishlistContext = createContext<WishlistValue | null>(null);

type Action = { id: string; wanted: boolean };

/**
 * Shares the signed-in customer's wishlist with every product card on the page.
 *
 * The server passes the current ids; `useOptimistic` shows the new state
 * immediately and re-syncs from the server after the action resolves, so no
 * effect has to mirror props into state.
 */
export function WishlistProvider({
  locale,
  signedIn,
  initialIds,
  children,
}: {
  locale: Locale;
  signedIn: boolean;
  initialIds: string[];
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const [ids, applyOptimistic] = useOptimistic<string[], Action>(
    initialIds,
    (state, { id, wanted }) =>
      wanted ? [...state, id] : state.filter((current) => current !== id),
  );

  const has = useCallback((productId: string) => ids.includes(productId), [ids]);

  const toggle = useCallback(
    (productId: string) => {
      if (!signedIn) {
        router.push(`${href(locale, "login")}?next=${encodeURIComponent(pathname)}`);
        return;
      }

      const wanted = !ids.includes(productId);

      startTransition(async () => {
        applyOptimistic({ id: productId, wanted });
        const form = new FormData();
        form.set("product_id", productId);
        form.set("wanted", String(wanted));
        await toggleWishlist(form);
      });
    },
    [signedIn, ids, applyOptimistic, router, pathname, locale, startTransition],
  );

  const value = useMemo<WishlistValue>(
    () => ({ signedIn, ids, count: ids.length, has, toggle, pending }),
    [signedIn, ids, has, toggle, pending],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistValue {
  const value = useContext(WishlistContext);
  if (!value) throw new Error("useWishlist must be used inside <WishlistProvider>");
  return value;
}
