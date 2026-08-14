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

export type FinishStyle = {
  /**
   * The moulding face, as diagonal gradient stops (percent, colour).
   *
   * Kept as data rather than as a finished CSS string because the camera view
   * has to repaint the very same moulding into a `<canvas>` when it composes the
   * photograph, and a canvas cannot read a CSS gradient. One table, two painters.
   */
  stops: [number, string][];
  /** Wood only: the fine darker streaks laid over the gradient, on and off. */
  grain?: [string, string];
  /** Outer highlight and inner shadow: the two edges that make it look solid. */
  outer: string;
  inner: string;
};

/*
  The frame's geometry lives in `@/lib/catalog` — see the note there.

  It used to be declared in this file, which is `"use client"`. `framedAspect` is
  pure arithmetic, but the boundary does not care: importing it from a server
  component yields a reference to a client export, and calling it throws
  "Attempted to call framedAspect() from the server". The homepage was doing that
  through `CategoryTiles`, so `/` returned a 500 while the listing pages — which
  reach the same tile from inside a client component — were fine.

  Not re-exported from here either, tempting as that is to spare the callers a
  changed import: a `"use client"` module re-exporting something makes it a client
  export again, so the server-side call fails exactly as before. Callers that need
  the arithmetic import it from `@/lib/catalog`; this module only paints.
*/
import { MOULDING_PCT, WALL_PCT } from "@/lib/catalog";

export const FRAME_PAINT: Record<FrameFinish, FinishStyle> = {
  black: {
    stops: [
      [0, "#2a2a2a"],
      [45, "#131313"],
      [100, "#232323"],
    ],
    outer: "#3a3a3a",
    inner: "#050505",
  },
  white: {
    stops: [
      [0, "#ffffff"],
      [45, "#eceae6"],
      [100, "#f7f6f3"],
    ],
    outer: "#ffffff",
    inner: "#c9c6bf",
  },
  wood: {
    stops: [
      [0, "#c08a4f"],
      [40, "#9c6634"],
      [70, "#b47c45"],
      [100, "#8f5a2b"],
    ],
    grain: ["rgba(90,58,28,0.16)", "rgba(90,58,28,0)"],
    outer: "#d3a06a",
    inner: "#5d3a1a",
  },
};

/** The moulding face as CSS: the diagonal gradient, and wood's grain over it. */
export function mouldingBackground(style: FinishStyle): string {
  const face = `linear-gradient(135deg, ${style.stops
    .map(([at, color]) => `${color} ${at}%`)
    .join(", ")})`;

  if (!style.grain) return face;

  // Grain: wide warm bands crossed by fine darker streaks.
  const [on, off] = style.grain;
  return `repeating-linear-gradient(92deg, ${on} 0 2px, ${off} 2px 9px), ${face}`;
}

export function FramedArt({
  finish,
  mount,
  onWall = true,
  children,
  className,
}: {
  finish: FrameFinish;
  /** Mount width as a percentage of the frame's width. */
  mount: number;
  /**
   * Draw the painted wall behind the frame. Off when there is a real wall to
   * hang it on — the camera view supplies its own, and a grey rectangle floating
   * over someone's living room is the one thing that would break the illusion.
   */
  onWall?: boolean;
  /** The artwork to frame. */
  children: ReactNode;
  className?: string;
}) {
  const style = FRAME_PAINT[finish] ?? FRAME_PAINT.black;

  return (
    // The wall. A soft radial keeps the frame from floating on flat colour, and
    // the drop shadow underneath is what sells "hanging" rather than "printed".
    <div
      className={className}
      style={{
        background: onWall
          ? "radial-gradient(120% 100% at 50% 0%, #f3f1ee 0%, #e4e1dc 100%)"
          : undefined,
        padding: onWall ? `${WALL_PCT}%` : undefined,
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
          padding: `${MOULDING_PCT}%`,
          background: mouldingBackground(style),
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
              // The aperture is a cut in a board: whatever the artwork does not
              // share proportions with is trimmed at the bevel, never spilled
              // over the mount. An outer box-shadow is not a child, so the bevel
              // rings below survive the clip.
              overflow: "hidden",
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
export function FrameSwatch({ finish, className }: { finish: FrameFinish; className?: string }) {
  const style = FRAME_PAINT[finish] ?? FRAME_PAINT.black;

  return (
    <span
      aria-hidden="true"
      className={className ?? "block size-7"}
      style={{
        background: mouldingBackground(style),
        boxShadow: `inset 0 0 0 1px ${style.inner}`,
        border: `1px solid ${style.outer}`,
      }}
    />
  );
}
