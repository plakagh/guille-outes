import type { SVGProps } from "react";

/**
 * House icon set. Every glyph is drawn on a 24×24 grid with a 1.6 stroke so
 * they optically match at the small sizes the chrome uses.
 */
type IconProps = SVGProps<SVGSVGElement>;

function Stroke({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.4 15.4 4.1 4.1" />
    </Stroke>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <circle cx="12" cy="8" r="3.75" />
      <path d="M4.5 20c1.2-3.7 4-5.6 7.5-5.6s6.3 1.9 7.5 5.6" />
    </Stroke>
  );
}

export function HeartIcon({ filled, ...props }: IconProps & { filled?: boolean }) {
  return (
    <Stroke fill={filled ? "currentColor" : "none"} {...props}>
      <path d="M12 20s-7.5-4.4-7.5-9.4A4.1 4.1 0 0 1 12 8.2a4.1 4.1 0 0 1 7.5 2.4c0 5-7.5 9.4-7.5 9.4Z" />
    </Stroke>
  );
}

export function BagIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M5 7.5h14l-1 12H6l-1-12Z" />
      <path d="M9 7.5V6a3 3 0 0 1 6 0v1.5" />
    </Stroke>
  );
}

export function ChevronDown(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="m6 9.5 6 5.5 6-5.5" />
    </Stroke>
  );
}

export function ChevronLeft(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M14.5 5.5 8 12l6.5 6.5" />
    </Stroke>
  );
}

export function ChevronRight(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M9.5 5.5 16 12l-6.5 6.5" />
    </Stroke>
  );
}

export function ArrowRight(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M4.5 12h15" />
      <path d="m13.5 6 6 6-6 6" />
    </Stroke>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Stroke>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M3.5 7h17M3.5 12h17M3.5 17h17" />
    </Stroke>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M12 5.5v13M5.5 12h13" />
    </Stroke>
  );
}

export function MinusIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M5.5 12h13" />
    </Stroke>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="m4.5 12.5 5 5 10-11" />
    </Stroke>
  );
}

export function TruckIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M2.5 6.5h11v9h-11z" />
      <path d="M13.5 10h4l3 3v2.5h-7z" />
      <circle cx="6.5" cy="18" r="1.75" />
      <circle cx="16.5" cy="18" r="1.75" />
    </Stroke>
  );
}

export function ReturnIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M4.5 9.5h11a4.5 4.5 0 0 1 0 9H9" />
      <path d="m8 5.5-3.5 4L8 13.5" />
    </Stroke>
  );
}

export function FrameIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      {/* Moulding, then the mount aperture inside it. */}
      <path d="M4 4h16v16H4z" />
      <path d="M7.5 7.5h9v9h-9z" />
    </Stroke>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M12 3.5l7 2.5v5.5c0 4.2-2.8 7.2-7 8.5-4.2-1.3-7-4.3-7-8.5V6l7-2.5Z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </Stroke>
  );
}

export function StoreIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M3.5 9.5 5.5 5h13l2 4.5" />
      <path d="M4.5 9.5h15V19h-15z" />
      <path d="M10 19v-5h4v5" />
    </Stroke>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5c2.4 2.4 3.6 5.3 3.6 8.5S14.4 18.1 12 20.5c-2.4-2.4-3.6-5.3-3.6-8.5S9.6 5.9 12 3.5Z" />
    </Stroke>
  );
}

export function FilterIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M3.5 7h17M6.5 12h11M10 17h4" />
    </Stroke>
  );
}

export function StarIcon({ fillLevel = 1, ...props }: IconProps & { fillLevel?: number }) {
  // fillLevel 0…1 drives a clip so half-stars render without a second glyph.
  const id = `star-clip-${Math.round(fillLevel * 100)}`;
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <defs>
        <clipPath id={id}>
          <rect x="0" y="0" width={24 * fillLevel} height="24" />
        </clipPath>
      </defs>
      <path
        d="M12 3.2l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.5l6.1-.7L12 3.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <path
        d="M12 3.2l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.5l6.1-.7L12 3.2Z"
        fill="currentColor"
        clipPath={`url(#${id})`}
      />
    </svg>
  );
}

/* ---------------------------------------------------------------- social */

export function InstagramIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <rect x="4" y="4" width="16" height="16" rx="4.5" />
      <circle cx="12" cy="12" r="3.6" />
      <circle cx="16.6" cy="7.4" r="0.9" fill="currentColor" stroke="none" />
    </Stroke>
  );
}

export function XIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M4 3.5h4.4l4 5.6 4.8-5.6h2.6l-6.1 7.1 6.7 9.9h-4.4l-4.3-6.1-5.2 6.1H4l6.5-7.6L4 3.5Zm2.7 1.6 9.1 13.2h1.6L8.3 5.1H6.7Z" />
    </svg>
  );
}

export function TiktokIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M13.4 3h2.4c.3 1.9 1.5 3.3 3.4 3.6v2.5c-1.3 0-2.5-.4-3.5-1.1v5.9a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v2.6a3 3 0 1 0 2.2 2.9V3Z" />
    </svg>
  );
}

export function YoutubeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M21.2 8.1a3 3 0 0 0-2.1-2.1C17.5 5.6 12 5.6 12 5.6s-5.5 0-7.1.4A3 3 0 0 0 2.8 8.1C2.4 9.7 2.4 12 2.4 12s0 2.3.4 3.9a3 3 0 0 0 2.1 2.1c1.6.4 7.1.4 7.1.4s5.5 0 7.1-.4a3 3 0 0 0 2.1-2.1c.4-1.6.4-3.9.4-3.9s0-2.3-.4-3.9ZM10.2 15.2V8.8l5.4 3.2-5.4 3.2Z" />
    </svg>
  );
}

export function FacebookIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M13.3 21v-7.6h2.6l.4-3h-3V8.5c0-.9.3-1.5 1.6-1.5h1.5V4.1A21 21 0 0 0 14.2 4c-2.3 0-3.9 1.4-3.9 4v2.4H7.7v3h2.6V21h3Z" />
    </svg>
  );
}

/* -------------------------------------------------------------- payments */

/**
 * Payment marks are drawn in-house: a neutral card plate plus the scheme name
 * set in our own type. No third-party logo artwork is used.
 */
export function PaymentMark({ label, tone = "#1c1c1c" }: { label: string; tone?: string }) {
  return (
    <span
      className="inline-flex h-6 min-w-10 items-center justify-center rounded-[3px] border border-white/25 bg-white px-1.5"
      title={label}
    >
      <span
        className="font-display text-[0.6875rem] font-bold uppercase leading-none tracking-tight"
        style={{ color: tone }}
      >
        {label}
      </span>
    </span>
  );
}
