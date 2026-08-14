"use client";

import Link from "next/link";
import { useWishlist } from "@/components/account/wishlist-provider";
import { HeartIcon } from "@/components/icons";

/** Header heart, with the saved-item count for signed-in customers. */
export function WishlistLink({ href, label }: { href: string; label: string }) {
  const { count, signedIn } = useWishlist();

  return (
    <Link
      href={href}
      aria-label={count > 0 ? `${label} (${count})` : label}
      className="relative grid size-10 place-items-center text-white/85 transition hover:text-white"
    >
      <HeartIcon className="size-[1.35rem]" filled={signedIn && count > 0} />
      {/*
        White on black, not the black-on-white it was: the counter used to sit on
        a white masthead and is now on a black one, where #1A1A1A on #000 is a
        badge you cannot see. It stays neutral rather than going red — the cart
        counter next to it is the one number in here worth the CTA colour.
      */}
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-white px-1 font-sans text-[0.6875rem] font-bold leading-5 text-ink">
          {count}
        </span>
      )}
    </Link>
  );
}
