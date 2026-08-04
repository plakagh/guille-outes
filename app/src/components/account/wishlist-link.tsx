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
      className="relative grid size-10 place-items-center transition hover:text-flame"
    >
      <HeartIcon className="size-[1.35rem]" filled={signedIn && count > 0} />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-ink px-1 font-sans text-[0.6875rem] font-bold leading-5 text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
