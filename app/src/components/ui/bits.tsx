import Link from "next/link";
import { StarIcon } from "@/components/icons";
import { cn, discountPercent, formatPrice } from "@/lib/utils";

/* ------------------------------------------------------------------ badges */

type BadgeTone = "sale" | "new" | "limited" | "soldout" | "neutral";

/*
  Four badges, three colours, and gold is not one of them.

  `limited` was solid gold, which put a fourth hue into a system whose whole
  claim is black / white / red — and #D9A419 is 2.26:1 on white, so the label sat
  on it illegibly besides. It is now the strong-outline badge: `soldout` already
  owns the subtle ring, so a heavy black rule is free and reads as "unusual" the
  way the gold was meant to.

  Only `sale` is red, and white caps on #C8102E are 5.88:1 — fine at 11px, the
  spec's own warning about small white text on red notwithstanding (its numbers
  for that pair are crossed; see `--color-flame-bright` in globals.css).
*/
const BADGE_TONES: Record<BadgeTone, string> = {
  sale: "bg-flame text-white",
  new: "bg-ink text-white",
  limited: "bg-white text-ink ring-2 ring-inset ring-ink",
  soldout: "bg-white text-ink ring-1 ring-inset ring-line",
  neutral: "bg-shell text-ink",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("eyebrow inline-flex h-6 items-center px-2", BADGE_TONES[tone], className)}>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------- price */

export function Price({
  price,
  compareAt,
  size = "md",
  className,
  fromLabel,
}: {
  price: number;
  compareAt?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  /**
   * Rendered before the figure when the product costs more in a larger size, so
   * a listing showing 40 € for a print whose large is 80 € says "desde". The
   * label is passed in rather than looked up, because this component is shared
   * by server-rendered listings that have no i18n hook.
   */
  fromLabel?: string;
}) {
  const reduced = compareAt !== undefined && compareAt > price;
  const scale = {
    sm: "text-[0.875rem]",
    md: "text-[0.9375rem]",
    lg: "text-2xl",
  }[size];

  return (
    <p className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-1 font-semibold", scale, className)}>
      {fromLabel && <span className="font-normal text-mute">{fromLabel}</span>}
      <span className={reduced ? "text-flame" : "text-ink"}>{formatPrice(price)}</span>
      {reduced && (
        <>
          <span className="font-normal text-mute line-through">{formatPrice(compareAt)}</span>
          <span className="eyebrow text-flame">{discountPercent(price, compareAt)} %</span>
        </>
      )}
    </p>
  );
}

/* ------------------------------------------------------------------- stars */

export function Stars({
  rating,
  reviews,
  className,
  showCount = true,
  label = "/ 5",
}: {
  rating: number;
  reviews?: number;
  className?: string;
  showCount?: boolean;
  /** Localized "out of 5" phrasing for screen readers. */
  label?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span className="flex text-gold" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <StarIcon key={i} className="h-3.5 w-3.5" fillLevel={Math.min(1, Math.max(0, rating - i))} />
        ))}
      </span>
      <span className="sr-only">{`${rating.toFixed(1)} ${label}`}</span>
      {showCount && reviews !== undefined && (
        <span className="text-[0.75rem] text-mute">({reviews})</span>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- swatch dot */

export function Swatch({
  base,
  trim,
  className,
}: {
  base: string;
  trim: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "block size-4 rounded-full ring-1 ring-inset ring-black/15",
        className,
      )}
      style={{ background: `linear-gradient(135deg, ${base} 0 62%, ${trim} 62% 100%)` }}
    />
  );
}

/* ------------------------------------------------------------- breadcrumbs */

export function Breadcrumbs({
  trail,
  className,
  label = "Breadcrumb",
}: {
  trail: { label: string; href?: string }[];
  className?: string;
  label?: string;
}) {
  return (
    <nav aria-label={label} className={cn("text-[0.75rem] text-mute", className)}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {trail.map((crumb, i) => (
          <li key={`${crumb.label}-${i}`} className="flex items-center gap-1.5">
            {crumb.href ? (
              <Link href={crumb.href} className="hover:text-ink hover:underline">
                {crumb.label}
              </Link>
            ) : (
              <span className="text-ink">{crumb.label}</span>
            )}
            {i < trail.length - 1 && <span aria-hidden="true">/</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/* ----------------------------------------------------------- section title */

export function SectionHead({
  title,
  href,
  linkLabel = "Ver todo",
  eyebrow,
  className,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  eyebrow?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex items-end justify-between gap-6", className)}>
      <div>
        {/*
          The eyebrow is grey, not red.

          It was red on every band on the site, which broke the rule that matters
          most here — at most one red thing visible per block. A product shelf
          already spends its red on what red is for: the sale badges and the
          reduced prices in the cards below. A red label sitting above them is
          decoration, and it was competing with them for the same signal.
        */}
        {eyebrow && <p className="eyebrow mb-2 text-ink-soft">{eyebrow}</p>}
        <h2 className="section-title">{title}</h2>
      </div>
      {href && (
        // Hover fills to black rather than turning red — this is §5.4's outline
        // hover, borrowed by the one link that is shaped like an outline button.
        <Link
          href={href}
          className="eyebrow shrink-0 border-b-2 border-ink px-1 pb-1 transition-colors hover:bg-ink hover:text-white"
        >
          {linkLabel}
        </Link>
      )}
    </div>
  );
}
