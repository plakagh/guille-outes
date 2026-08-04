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
      className="relative grid size-10 place-items-center transition hover:text-flame"
    >
      <BagIcon className="size-[1.4rem]" />
      {ready && count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-flame px-1 font-sans text-[0.6875rem] font-bold leading-5 text-white">
          {count}
        </span>
      )}
    </button>
  );
}
