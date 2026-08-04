"use client";

import type { ReactNode } from "react";
import type { FrameFinish } from "@/lib/catalog";

/**
 * A picture frame, drawn in CSS.
 *
 * No photographs and no image assets — the same rule the product artwork follows.
 * A frame is four bevelled edges, a mount and a sheet of glass, and all four are
 * things CSS does well:
 *
 *  - the **moulding** is a box with a light outer edge and a dark inner edge, which
 *    is what reads as depth; wood adds a repeating gradient for grain;
 *  - the **mount** (paspartú) is white padding with a hairline inner shadow, so the
 *    artwork looks recessed rather than pasted on;
 *  - the **glass** is one faint diagonal highlight. Anything stronger stops looking
 *    like glass and starts looking like a gradient.
 *
 * The mount width is a percentage of the frame's width so the whole thing scales
 * with its container — a thumbnail and a full-size view use the same component.
 */

type FinishStyle = {
  /** The moulding face. */
  background: string;
  /** Outer highlight and inner shadow: the two edges that make it look solid. */
  outer: string;
  inner: string;
};

const FINISHES: Record<FrameFinish, FinishStyle> = {
  black: {
    background: "linear-gradient(135deg, #2a2a2a 0%, #131313 45%, #232323 100%)",
    outer: "#3a3a3a",
    inner: "#050505",
  },
  white: {
    background: "linear-gradient(135deg, #ffffff 0%, #eceae6 45%, #f7f6f3 100%)",
    outer: "#ffffff",
    inner: "#c9c6bf",
  },
  wood: {
    // Grain: wide warm bands crossed by fine darker streaks.
    background: [
      "repeating-linear-gradient(92deg, rgba(90,58,28,0.16) 0 2px, rgba(90,58,28,0) 2px 9px)",
      "linear-gradient(135deg, #c08a4f 0%, #9c6634 40%, #b47c45 70%, #8f5a2b 100%)",
    ].join(", "),
    outer: "#d3a06a",
    inner: "#5d3a1a",
  },
};

export function FramedArt({
  finish,
  mount,
  children,
  className,
}: {
  finish: FrameFinish;
  /** Mount width as a percentage of the frame's width. */
  mount: number;
  /** The artwork to frame. */
  children: ReactNode;
  className?: string;
}) {
  const style = FINISHES[finish] ?? FINISHES.black;

  return (
    // The wall. A soft radial keeps the frame from floating on flat colour, and
    // the drop shadow underneath is what sells "hanging" rather than "printed".
    <div
      className={className}
      style={{
        background: "radial-gradient(120% 100% at 50% 0%, #f3f1ee 0%, #e4e1dc 100%)",
        padding: "7%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        // The finish is stated in the DOM as well as painted: it makes the
        // rendered state inspectable without reverse-engineering gradients.
        data-frame="moulding"
        data-frame-finish={finish}
        style={{
          // Moulding width, and the frame's own depth.
          padding: "3.2%",
          background: style.background,
          // Lengths only: a percentage anywhere in box-shadow makes the whole
          // declaration invalid, which silently drops every layer — including the
          // drop shadow that makes this read as an object on a wall.
          boxShadow: [
            `inset 0 0 0 1px ${style.inner}`,
            `inset 2px 2px 0 rgba(255,255,255,0.35)`,
            `0 1.2rem 2.2rem -0.8rem rgba(0,0,0,0.45)`,
            `0 0.2rem 0.5rem -0.2rem rgba(0,0,0,0.3)`,
          ].join(", "),
          border: `1px solid ${style.outer}`,
          maxWidth: "100%",
          width: "100%",
        }}
      >
        {/* The mount: white board with the bevel cut showing at its inner edge. */}
        <div
          data-frame="mount"
          style={{
            position: "relative",
            padding: `${mount}%`,
            background: "linear-gradient(160deg, #fdfdfc 0%, #f4f2ee 100%)",
            boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              position: "relative",
              // The bevel — a thin light edge around the aperture.
              boxShadow: [
                "0 0 0 1px rgba(0,0,0,0.18)",
                "0 0 0 3px #ffffff",
                "0 0 0 4px rgba(0,0,0,0.07)",
              ].join(", "),
              background: "#ffffff",
            }}
          >
            {children}

            {/* Glass. Pointer-events off so it never eats a click. */}
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                background:
                  "linear-gradient(118deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.06) 32%, rgba(255,255,255,0) 52%)",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Swatch for the finish picker, using the same paint as the frame itself. */
export function FrameSwatch({ finish }: { finish: FrameFinish }) {
  const style = FINISHES[finish] ?? FINISHES.black;

  return (
    <span
      aria-hidden="true"
      className="block size-7"
      style={{
        background: style.background,
        boxShadow: `inset 0 0 0 1px ${style.inner}`,
        border: `1px solid ${style.outer}`,
      }}
    />
  );
}
