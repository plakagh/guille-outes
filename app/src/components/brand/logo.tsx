import { cn } from "@/lib/utils";

/**
 * Guille Outes wordmark.
 *
 * Drawn as SVG text rather than an image so it stays crisp at any size and
 * inherits `currentColor`. `textLength` pins each word's advance width, which
 * means the mark keeps its exact proportions even before the display font
 * finishes loading — no reflow, no fallback-metric wobble.
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
      viewBox="0 0 420 88"
      role="img"
      aria-label={title}
      className={cn("block w-auto", className)}
      fill="currentColor"
    >
      <text
        x="0"
        y="74"
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
        y="74"
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
        y="49"
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
