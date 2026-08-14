"use client";

import { useCart } from "@/components/cart/cart-context";
import { BagIcon } from "@/components/icons";

export function CartButton({ label }: { label: string }) {
  const { count, open, ready } = useCart();

  return (
    <button
      type="button"
      onClick={open}
      aria-label={ready && count > 0 ? `${label} (${count})` : label}
      className="relative grid size-10 place-items-center text-white/85 transition hover:text-white"
    >
      <BagIcon className="size-[1.4rem]" />
      {/*
        The one red thing in the masthead, and the only pill on the site (§4).
        It survives the "red is action or discount" rule as the count of what you
        are about to buy; white on #C8102E is 5.88:1, and the fill clears 3:1
        against the black around it.
      */}
      {ready && count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-flame px-1 font-sans text-[0.6875rem] font-bold leading-5 text-white">
          {count}
        </span>
      )}
    </button>
  );
}
