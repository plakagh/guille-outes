import { cn } from "@/lib/utils";

/**
 * Guille Outes wordmark.
 *
 * Drawn as SVG text rather than an image so it stays crisp at any size and
 * inherits `currentColor`. `textLength` pins each word's advance width, which
 * means the mark keeps its exact proportions even before the display font
 * finishes loading — no reflow, no fallback-metric wobble.
 *
 * The viewBox hugs the ink. Antonio is a tall face: 2048 units per em with a
 * cap height of 1760 (0.86 em), and the round G/O overshoot it to 1782, so at
 * `fontSize` 92 the caps reach 80.1 units above the baseline and the curves dip
 * ~1 below it. Baseline at 82 in an 84-unit box leaves that ink a hair of
 * margin top and bottom — an SVG clips at its viewport, so a baseline set by
 * eye rather than by these metrics shaves the tops off the round letters.
 */
export function Logo({
  className,
  title = "Guille Outes",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 420 84"
      role="img"
      aria-label={title}
      className={cn("block w-auto", className)}
      fill="currentColor"
    >
      <text
        x="0"
        y="82"
        textLength="224"
        lengthAdjust="spacingAndGlyphs"
        fontFamily="var(--font-display)"
        fontSize="92"
        fontWeight={700}
      >
        GUILLE
      </text>
      <text
        x="238"
        y="82"
        textLength="182"
        lengthAdjust="spacingAndGlyphs"
        fontFamily="var(--font-display)"
        fontSize="92"
        fontWeight={500}
      >
        Outes
      </text>
    </svg>
  );
}

/**
 * Square monogram for favicons, avatars and the mobile masthead.
 * `inverted` swaps to a knocked-out mark on a filled plate.
 *
 * Same cap-height arithmetic as {@link Logo}: at `fontSize` 56 the GO stands
 * 49.3 units tall, so a baseline at 56 centres it in the 64-unit plate instead
 * of pinning it against the top edge.
 */
export function Monogram({
  className,
  inverted = false,
}: {
  className?: string;
  inverted?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="Guille Outes"
      className={cn("block", className)}
    >
      {inverted && <rect width="64" height="64" fill="currentColor" />}
      <text
        x="32"
        y="56"
        textAnchor="middle"
        textLength="46"
        lengthAdjust="spacingAndGlyphs"
        fontFamily="var(--font-display)"
        fontSize="56"
        fontWeight={700}
        fill={inverted ? "#fff" : "currentColor"}
      >
        GO
      </text>
    </svg>
  );
}
