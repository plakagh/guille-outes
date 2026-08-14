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

export function CameraIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      {/* Body with the raised viewfinder bump, and the lens. */}
      <path d="M3.5 8.5h3.2l1.4-2.2h7.8l1.4 2.2h3.2V19h-17V8.5Z" />
      <circle cx="12" cy="13.2" r="3.4" />
    </Stroke>
  );
}

/** Filled triangle: at 20 px an outlined play arrow reads as a stray chevron. */
export function PlayIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M8.5 5.6 19 12 8.5 18.4V5.6Z" fill="currentColor" />
    </Stroke>
  );
}

/** The camera's shutter: a ring around a filled disc, so it reads as "take it". */
export function ShutterIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="6" fill="currentColor" stroke="none" />
    </Stroke>
  );
}

export function ShareIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M12 15.5V4m0 0L8.4 7.6M12 4l3.6 3.6" />
      <path d="M5.5 12.5V19a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-6.5" />
    </Stroke>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M12 4v11.5m0 0L8.4 12M12 15.5 15.6 12" />
      <path d="M5.5 18.5h13" />
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

/* ------------------------------------------------ the paint studio toolbar */

export function BrushIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M18.5 4.2a2.4 2.4 0 0 1 1.3 4l-7 6.6-3.3-3.3 6.7-6.9a2.4 2.4 0 0 1 2.3-.4Z" />
      <path d="M9.5 11.5c-2 .4-3.3 1.8-3.7 3.6-.2 1-.7 1.7-1.6 2.2 1.2 1.4 3 2 4.7 1.5 1.9-.5 3-2 3.1-4Z" />
    </Stroke>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M16.6 3.8 20.2 7.4 8.9 18.7l-4.6 1 1-4.6z" />
      <path d="m14.3 6.1 3.6 3.6" />
    </Stroke>
  );
}

export function CrayonIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M9.4 3.6h5.2l1.1 4v10.9a1.5 1.5 0 0 1-1.5 1.5h-4.4a1.5 1.5 0 0 1-1.5-1.5V7.6z" />
      <path d="M8.3 7.6h7.4" />
    </Stroke>
  );
}

export function SprayIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M8.5 8.5h6V20h-6z" />
      <path d="M10.5 8.5V5.5h4" />
      <path d="M18 5h.01M20 8.5h.01M17.5 11.5h.01M20.5 12.5h.01" />
    </Stroke>
  );
}

export function EraserIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="m13.5 4.5 6 6-8 8h-4l-3-3z" />
      <path d="m8.5 9.5 6 6" />
      <path d="M11.5 18.5h8.5" />
    </Stroke>
  );
}

export function BucketIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M9 3.5 19 13.5l-6.5 6.5a1.4 1.4 0 0 1-2 0L4.6 14a1.4 1.4 0 0 1 0-2z" />
      <path d="m7 6 2.4 2.4" />
      <path d="M21 16.5c0 1-.7 1.8-1.6 1.8s-1.6-.8-1.6-1.8 1.6-2.8 1.6-2.8 1.6 1.8 1.6 2.8Z" />
    </Stroke>
  );
}

export function UndoIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M4.5 9.5h9a5 5 0 0 1 0 10H8" />
      <path d="M8 5 4.5 9.5 8 14" />
    </Stroke>
  );
}

export function RedoIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M19.5 9.5h-9a5 5 0 0 0 0 10H16" />
      <path d="M16 5l3.5 4.5L16 14" />
    </Stroke>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M4.5 6.5h15" />
      <path d="M9.5 6.5V4.8h5v1.7" />
      <path d="M6.5 6.5 7.4 20h9.2l.9-13.5" />
      <path d="M10.5 10v6M13.5 10v6" />
    </Stroke>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M2.8 12S6.5 5.8 12 5.8 21.2 12 21.2 12 17.5 18.2 12 18.2 2.8 12 2.8 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </Stroke>
  );
}

export function EyeOffIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M9.9 6.1A8.6 8.6 0 0 1 12 5.8c5.5 0 9.2 6.2 9.2 6.2a17 17 0 0 1-2.8 3.5" />
      <path d="M6.3 8A17.4 17.4 0 0 0 2.8 12S6.5 18.2 12 18.2c1.4 0 2.6-.4 3.7-1" />
      <path d="M4.5 4.5 19.5 19.5" />
    </Stroke>
  );
}

/** Four corners pushing out: "give this the whole screen". */
export function ExpandIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M9.5 4.5h-5v5" />
      <path d="M14.5 4.5h5v5" />
      <path d="M14.5 19.5h5v-5" />
      <path d="M9.5 19.5h-5v-5" />
    </Stroke>
  );
}

/** The same corners pulling back in. */
export function CollapseIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M4.5 9.5h5v-5" />
      <path d="M19.5 9.5h-5v-5" />
      <path d="M19.5 14.5h-5v5" />
      <path d="M4.5 14.5h5v5" />
    </Stroke>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M12 19.5V8m0 0L8.4 11.6M12 8l3.6 3.6" />
      <path d="M5.5 5.5h13" />
    </Stroke>
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

/*
  The shop is on Instagram and nowhere else, so the X, TikTok, YouTube and
  Facebook marks that used to sit here have gone with the footer links that were
  their only caller. They are one `git show` away if an account ever opens.
*/

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
