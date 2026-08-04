"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { ChevronLeft, ChevronRight } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * Horizontal snap scroller with overlaid arrows — the pattern every product
 * shelf on the reference site uses. Scrolling is native (so trackpads, touch
 * and keyboard all work); the arrows just page by ~90 % of the viewport.
 */
export function Rail({
  children,
  className,
  itemClassName,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  /** Applied to the generated track, e.g. gap and item widths. */
  itemClassName?: string;
  label: string;
}) {
  const { t } = useI18n();
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const sync = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft >= max - 2);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, [sync]);

  const page = (direction: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: "smooth" });
  };

  return (
    <div className={cn("group/rail relative", className)}>
      <div
        ref={trackRef}
        onScroll={sync}
        className={cn("rail gap-3 pb-1 sm:gap-4", itemClassName)}
        role="group"
        aria-label={label}
      >
        {children}
      </div>

      <RailArrow side="left" label={t.common.previous} hidden={atStart} onClick={() => page(-1)} />
      <RailArrow side="right" label={t.common.next} hidden={atEnd} onClick={() => page(1)} />
    </div>
  );
}

function RailArrow({
  side,
  label,
  hidden,
  onClick,
}: {
  side: "left" | "right";
  label: string;
  hidden: boolean;
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      tabIndex={hidden ? -1 : 0}
      className={cn(
        "absolute top-1/2 z-10 hidden size-11 -translate-y-1/2 place-items-center bg-white text-ink shadow-[0_2px_14px_rgba(0,0,0,0.18)] transition duration-200 hover:bg-ink hover:text-white md:grid",
        side === "left" ? "-left-2" : "-right-2",
        hidden && "pointer-events-none opacity-0",
      )}
    >
      <Icon className="size-5" />
    </button>
  );
}
