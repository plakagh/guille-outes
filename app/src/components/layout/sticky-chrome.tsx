"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Past this many pixels from the top the chrome is allowed to condense. Below
 * it the reader is still at the head of the page, where the announce bar and
 * the masthead are what they were written to be, and a header that flinched at
 * a two-pixel wheel tick would only look nervous.
 */
const CONDENSE_AFTER = 120;

/**
 * A wheel tick or a trackpad glide never reports a single clean direction, and
 * neither does the rubber band at either end of the document. A reading has to
 * beat this much to count as a gesture rather than as noise.
 */
const DIRECTION_SLOP = 4;

/**
 * The site chrome, pinned to the top of the page, with the upper two bands
 * folding away as the reader goes down and unfolding again on the way up.
 *
 * The whole header is one sticky block, and hiding is a transform on it rather
 * than a change of height: the announce bar and the masthead slide up out of
 * view and the blue nav row lands at y=0, which is where it stays for the rest
 * of the page. Because nothing in the flow resizes, the page underneath cannot
 * jump — and the scroll position cannot move as a side effect of hiding, which
 * is what would otherwise read back as a scroll upwards and unfold the chrome
 * again on the next frame.
 *
 * What is folded away depends on how wide the screen is, and in every case it
 * is everything *above* the row that has to survive:
 *
 * - `lg` and up: the announce bar and the masthead go, and the blue nav row
 *   lands at y=0.
 * - below `md`: the announce bar and the *search row* go — search sits on a row
 *   of its own down here — and the masthead lands at y=0. The masthead is the
 *   whole of the navigation on a phone, so it is the one band that stays; the
 *   search row is the one worth a third of the screen while you are reading.
 * - in between: only the announce bar, since search is back inside the masthead
 *   and there is no separate row to fold.
 *
 * The masthead is pushed back down by the height of the row that folded (see
 * `data-condensed` in `site-header.tsx`), which is what lets one transform on
 * the header hide a band that is *not* at the top of it.
 */
export function StickyChrome({ children }: { children: ReactNode }) {
  const [condensed, setCondensed] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;
    let frame: number | null = null;

    // Scroll fires far more often than the screen repaints; one read per frame
    // is all the header can act on, and it keeps the handler off the scrolling
    // path.
    const read = () => {
      frame = null;
      // Overscroll reports negative offsets on macOS, and the bounce back from
      // one would otherwise register as a gesture of its own.
      const y = Math.max(0, window.scrollY);
      const previous = lastY.current;

      if (y <= CONDENSE_AFTER) {
        lastY.current = y;
        setCondensed(false);
        return;
      }

      if (Math.abs(y - previous) < DIRECTION_SLOP) return;
      lastY.current = y;
      setCondensed(y > previous);
    };

    const onScroll = () => {
      if (frame === null) frame = window.requestAnimationFrame(read);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header
      // Read by the masthead inside, which slides back down by whatever folded
      // above it. A data attribute rather than a prop: everything in here is a
      // server component, and this is the one bit of state it needs.
      data-condensed={condensed ? "" : undefined}
      className={cn(
        "group sticky top-0 z-50",
        "transition-transform duration-300 ease-[var(--ease-out-quint)] motion-reduce:transition-none",
        condensed &&
          "translate-y-[calc((var(--spacing-promo)+var(--spacing-search))*-1)] md:translate-y-[calc(var(--spacing-promo)*-1)] lg:translate-y-[calc((var(--spacing-promo)+var(--spacing-masthead))*-1)]",
      )}
      // Tabbing into a band that has folded away would move focus to something
      // nobody can see; the same keystroke brings it back first.
      onFocusCapture={() => setCondensed(false)}
    >
      {children}
    </header>
  );
}
