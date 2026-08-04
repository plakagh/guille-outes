import { cn } from "@/lib/utils";

/**
 * Product imagery is generated in-house as flat vector garments so the store
 * ships with zero third-party photography. Each shape takes a colorway
 * (base / trim) and an optional chest print, which is enough to make a colour
 * swatch on a PDP visibly change the product.
 */
export type ArtShape =
  | "tee"
  | "hoodie"
  | "jersey"
  | "jacket"
  | "shorts"
  | "cap"
  | "beanie"
  | "tote"
  | "ball"
  | "bottle"
  | "poster";

export type ArtPrint = "wordmark" | "monogram" | "number" | "none";

export type Colorway = {
  /** Human label shown in the swatch tooltip / filter list. */
  name: string;
  /** URL-safe id used in query params. */
  id: string;
  base: string;
  trim: string;
  /** Ink used for the chest print; defaults to the trim colour. */
  print?: string;
};

type Props = {
  shape: ArtShape;
  colorway: Colorway;
  /** Chest print: the wordmark, the monogram, a number, or nothing. */
  print?: ArtPrint;
  /** Number rendered when `print` is "number". */
  number?: number;
  /**
   * Just the artwork: no sheet, no ground shadow, cropped to the image.
   *
   * The normal rendering is a product *photograph substitute* — a poster lying on
   * a surface, with its own white paper and a shadow under it. Inside a picture
   * frame that reads as a frame around a photo of a poster, with two white mounts
   * and a stray shadow behind the glass. Framing needs the art alone.
   */
  bare?: boolean;
  /**
   * Which way up a cuadro hangs. Ignored by every other shape — a t-shirt has
   * one orientation and that is that.
   */
  orientation?: ArtOrientation;
  className?: string;
};

const VIEWBOX = "0 0 400 480";

/** A cuadro hangs either way up. Only the poster shape has an orientation. */
export type ArtOrientation = "portrait" | "landscape";

/**
 * The printed sheet, per orientation: the white paper the composition sits on,
 * and the crop used when the piece is drawn `bare` for framing.
 *
 * Both sheets end at the same y so the ground shadow under the "poster on a
 * surface" view lands just below the paper either way up, without the shadow
 * having to know which way the piece is turned.
 */
const POSTER_SHEET: Record<ArtOrientation, { x: number; y: number; w: number; h: number }> = {
  portrait: { x: 94, y: 96, w: 212, h: 296 },
  landscape: { x: 52, y: 180, w: 296, h: 212 },
};

/** The `bare` crop: exactly the sheet, so the mount lands on the printed edge. */
export function bareViewBox(orientation: ArtOrientation): string {
  const sheet = POSTER_SHEET[orientation];
  return `${sheet.x} ${sheet.y} ${sheet.w} ${sheet.h}`;
}

export function ProductArt({
  shape,
  colorway,
  print = "wordmark",
  number = 23,
  bare = false,
  orientation = "portrait",
  className,
}: Props) {
  const ink = colorway.print ?? colorway.trim;
  const cropped = bare && shape === "poster";
  const sheet = POSTER_SHEET[orientation];

  return (
    <svg
      viewBox={cropped ? bareViewBox(orientation) : VIEWBOX}
      className={cn("h-full w-full", className)}
      aria-hidden="true"
      shapeRendering="geometricPrecision"
    >
      {/* Soft ground shadow anchors the garment on the card — but not behind glass. */}
      {!bare && (
        <ellipse
          cx="200"
          cy="446"
          // A little wider than the paper it sits under, either way up.
          rx={shape === "poster" ? sheet.w / 2 + 26 : 132}
          ry="14"
          fill="#000"
          opacity="0.06"
        />
      )}
      <Garment shape={shape} colorway={colorway} bare={bare} orientation={orientation} />
      <ChestPrint shape={shape} kind={print} ink={ink} number={number} />
    </svg>
  );
}

/* ------------------------------------------------------------------ shapes */

function Garment({
  shape,
  colorway,
  bare = false,
  orientation = "portrait",
}: {
  shape: ArtShape;
  colorway: Colorway;
  bare?: boolean;
  orientation?: ArtOrientation;
}) {
  const { base, trim } = colorway;
  const shade = "rgba(0,0,0,0.10)";

  switch (shape) {
    case "tee":
      return (
        <g>
          <path
            d="M152 92 L112 104 L46 152 L84 214 L116 190 L110 412 Q200 430 290 412 L284 190 L316 214 L354 152 L288 104 L248 92 Q200 130 152 92 Z"
            fill={base}
          />
          {/* sleeve break + hem shading */}
          <path d="M116 190 L110 412 Q140 419 158 420 L162 196 Z" fill={shade} />
          <path
            d="M146 88 Q200 134 254 88"
            fill="none"
            stroke={trim}
            strokeWidth="14"
            strokeLinecap="round"
          />
          <path d="M84 214 L116 190" fill="none" stroke={shade} strokeWidth="6" />
          <path d="M316 214 L284 190" fill="none" stroke={shade} strokeWidth="6" />
        </g>
      );

    case "hoodie":
      return (
        <g>
          <path
            d="M150 100 L104 114 L52 172 L92 240 L122 212 L116 420 Q200 438 284 420 L278 212 L308 240 L348 172 L296 114 L250 100 Q200 142 150 100 Z"
            fill={base}
          />
          {/* hood */}
          <path d="M148 104 C150 44 250 44 252 104 Q200 146 148 104 Z" fill={trim} />
          <path d="M162 98 C168 62 232 62 238 98 Q200 128 162 98 Z" fill={shade} />
          {/* kangaroo pocket */}
          <path
            d="M136 316 H264 V368 Q200 380 136 368 Z"
            fill="none"
            stroke={shade}
            strokeWidth="7"
          />
          {/* drawstrings */}
          <path d="M186 126 L182 196" stroke={trim} strokeWidth="7" strokeLinecap="round" />
          <path d="M214 126 L219 202" stroke={trim} strokeWidth="7" strokeLinecap="round" />
          <path d="M122 212 L116 420 Q146 428 164 429 L168 218 Z" fill={shade} opacity="0.55" />
          {/* ribbed cuffs */}
          <path d="M92 240 L52 172" stroke={shade} strokeWidth="0" />
          <path d="M70 200 L110 258" stroke={trim} strokeWidth="16" strokeLinecap="round" />
          <path d="M330 200 L290 258" stroke={trim} strokeWidth="16" strokeLinecap="round" />
        </g>
      );

    case "jersey":
      return (
        <g>
          <path
            d="M144 84 L120 96 C102 132 106 168 124 194 L118 420 Q200 438 282 420 L276 194 C294 168 298 132 280 96 L256 84 Q200 152 144 84 Z"
            fill={base}
          />
          {/* deep V neck rib */}
          <path
            d="M140 80 Q200 156 260 80"
            fill="none"
            stroke={trim}
            strokeWidth="13"
            strokeLinecap="round"
          />
          {/* armhole ribs */}
          <path
            d="M122 92 C104 130 108 166 126 192"
            fill="none"
            stroke={trim}
            strokeWidth="11"
          />
          <path
            d="M278 92 C296 130 292 166 274 192"
            fill="none"
            stroke={trim}
            strokeWidth="11"
          />
          {/* side stripe */}
          <path d="M124 210 L118 414 L136 416 L142 210 Z" fill={trim} opacity="0.85" />
          <path d="M276 210 L282 414 L264 416 L258 210 Z" fill={trim} opacity="0.85" />
        </g>
      );

    case "jacket":
      return (
        <g>
          <path
            d="M154 92 L104 108 L54 168 L86 246 L120 220 L114 416 Q200 432 286 416 L280 220 L314 246 L346 168 L296 108 L246 92 Q200 128 154 92 Z"
            fill={base}
          />
          {/* stand collar */}
          <path d="M152 90 Q200 126 248 90 L242 62 Q200 84 158 62 Z" fill={trim} />
          {/* centre zip */}
          <path d="M200 112 L200 424" stroke={trim} strokeWidth="8" />
          <path d="M200 112 L200 424" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
          <path d="M114 416 L120 220 L162 214 L158 422 Z" fill={shade} opacity="0.5" />
          {/* raglan seams */}
          <path d="M156 96 L124 214" fill="none" stroke={shade} strokeWidth="5" />
          <path d="M244 96 L276 214" fill="none" stroke={shade} strokeWidth="5" />
        </g>
      );

    case "shorts":
      return (
        <g>
          <path d="M112 150 L124 388 H190 L200 262 L210 388 H276 L288 150 Z" fill={base} />
          {/* waistband */}
          <path d="M108 110 H292 V152 H108 Z" fill={trim} />
          <path d="M108 138 H292" stroke="rgba(255,255,255,0.35)" strokeWidth="4" />
          {/* inseam + leg shading */}
          <path d="M200 262 L190 388" stroke={shade} strokeWidth="6" />
          <path d="M124 388 L112 150 L152 150 L160 386 Z" fill={shade} opacity="0.45" />
          {/* side taping */}
          <path d="M116 160 L127 384" stroke={trim} strokeWidth="9" />
          <path d="M284 160 L273 384" stroke={trim} strokeWidth="9" />
        </g>
      );

    case "cap":
      return (
        <g>
          {/* crown */}
          <path d="M104 272 a96 104 0 0 1 192 0 Z" fill={base} />
          {/* panel seams */}
          <path d="M200 168 L200 272" stroke={shade} strokeWidth="5" />
          <path d="M148 186 C160 224 164 250 164 272" fill="none" stroke={shade} strokeWidth="5" />
          <path d="M252 186 C240 224 236 250 236 272" fill="none" stroke={shade} strokeWidth="5" />
          {/* brim */}
          <path
            d="M104 268 C62 274 38 300 40 320 L214 320 C270 318 296 292 296 268 Z"
            fill={trim}
          />
          <path
            d="M104 268 C62 274 38 300 40 320"
            fill="none"
            stroke="rgba(0,0,0,0.12)"
            strokeWidth="5"
          />
          {/* squatchee */}
          <circle cx="200" cy="172" r="9" fill={trim} />
          {/* sweatband edge */}
          <path d="M104 268 H296" stroke="rgba(0,0,0,0.14)" strokeWidth="5" />
        </g>
      );

    case "beanie":
      return (
        <g>
          <path d="M110 320 C110 196 290 196 290 320 Z" fill={base} />
          <path d="M104 314 H296 V372 Q200 386 104 372 Z" fill={trim} />
          {/* rib texture */}
          {[130, 158, 186, 214, 242, 270].map((x) => (
            <path key={x} d={`M${x} 318 V376`} stroke="rgba(0,0,0,0.10)" strokeWidth="4" />
          ))}
          <circle cx="200" cy="182" r="26" fill={trim} />
        </g>
      );

    case "tote":
      return (
        <g>
          <path d="M112 176 H288 L296 400 Q200 414 104 400 Z" fill={base} />
          <path d="M112 176 H160 L166 404 Q134 402 104 400 Z" fill={shade} opacity="0.4" />
          {/* handles */}
          <path
            d="M152 178 C152 116 200 106 200 106 C200 106 248 116 248 178"
            fill="none"
            stroke={trim}
            strokeWidth="14"
            strokeLinecap="round"
          />
          <path d="M112 208 H292" stroke={trim} strokeWidth="8" />
        </g>
      );

    case "ball":
      return (
        <g>
          <circle cx="200" cy="248" r="132" fill={base} />
          <path
            d="M200 116 C168 176 168 320 200 380"
            fill="none"
            stroke={trim}
            strokeWidth="7"
          />
          <path
            d="M200 116 C232 176 232 320 200 380"
            fill="none"
            stroke={trim}
            strokeWidth="7"
          />
          <path d="M68 248 H332" stroke={trim} strokeWidth="7" />
          <path
            d="M92 172 C140 208 260 208 308 172"
            fill="none"
            stroke={trim}
            strokeWidth="7"
          />
          <path
            d="M92 324 C140 288 260 288 308 324"
            fill="none"
            stroke={trim}
            strokeWidth="7"
          />
          <circle cx="200" cy="248" r="132" fill="url(#ballShade)" />
          <defs>
            <radialGradient id="ballShade" cx="0.32" cy="0.28" r="0.85">
              <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
              <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
              <stop offset="1" stopColor="#000" stopOpacity="0.16" />
            </radialGradient>
          </defs>
        </g>
      );

    case "bottle":
      return (
        <g>
          <path
            d="M164 172 H236 V196 C260 210 268 232 268 262 V386 A22 22 0 0 1 246 408 H154 A22 22 0 0 1 132 386 V262 C132 232 140 210 164 196 Z"
            fill={base}
          />
          <path d="M132 262 V386 A22 22 0 0 0 154 408 H176 V262 Z" fill={shade} opacity="0.45" />
          <path d="M158 108 H242 V176 H158 Z" fill={trim} />
          <path d="M158 146 H242" stroke="rgba(255,255,255,0.3)" strokeWidth="5" />
          <path d="M132 300 H268" stroke="rgba(0,0,0,0.10)" strokeWidth="6" />
        </g>
      );

    case "poster":
      return <Poster colorway={colorway} bare={bare} orientation={orientation} />;
  }
}

/**
 * A poster, either way up.
 *
 * The composition is derived from the sheet rather than drawn twice: a block of
 * colour, a range of peaks along its foot, and two caption bars. Turning the
 * piece sideways changes how wide the paper is, and every coordinate follows
 * from that — so a landscape cuadro cannot drift out of step with a portrait one,
 * which is what a second hand-tuned path would guarantee eventually.
 */
function Poster({
  colorway,
  bare,
  orientation,
}: {
  colorway: Colorway;
  bare?: boolean;
  orientation: ArtOrientation;
}) {
  const { base, trim } = colorway;
  const sheet = POSTER_SHEET[orientation];

  // The margin of paper around the printed image, and the caption strip that
  // always takes the same bite out of the bottom whichever way up it hangs.
  const margin = 20;
  const caption = 76;

  const left = sheet.x + margin;
  const width = sheet.w - 2 * margin;
  const top = sheet.y + margin;
  const bottom = sheet.y + sheet.h - caption;
  const height = bottom - top;

  // Peaks: a horizon in the lower third, two summits and a valley between them,
  // all as fractions of the image so they keep their proportion when it widens.
  const horizon = round(bottom - 0.38 * height);
  const at = (fraction: number) => round(left + fraction * width);
  const up = (fraction: number) => round(horizon - fraction * height);

  const range = [
    `M${left} ${horizon}`,
    `L${at(0.3)} ${up(0.32)}`,
    `L${at(0.535)} ${up(0.08)}`,
    `L${at(0.767)} ${up(0.25)}`,
    `L${left + width} ${horizon}`,
    `V${bottom}`,
    `H${left}`,
    "Z",
  ].join(" ");

  return (
    <g>
      {/* The sheet and its edge belong to the "poster on a surface" view; in a
          frame the mount is the white and the bevel is the edge. */}
      {!bare && (
        <>
          <rect x={sheet.x} y={sheet.y} width={sheet.w} height={sheet.h} fill="#fff" />
          <rect
            x={sheet.x}
            y={sheet.y}
            width={sheet.w}
            height={sheet.h}
            fill="none"
            stroke="rgba(0,0,0,0.14)"
            strokeWidth="4"
          />
        </>
      )}
      <rect x={left} y={top} width={width} height={height} fill={base} />
      <path d={range} fill={trim} />
      {/* Title and credit line, in the caption strip. */}
      <rect x={left} y={bottom + 22} width={round(width * 0.686)} height="14" fill={base} />
      <rect
        x={left}
        y={bottom + 44}
        width={round(width * 0.442)}
        height="10"
        fill="rgba(0,0,0,0.2)"
      />
    </g>
  );
}

/**
 * Whole coordinates only. Fractional ones would land the artwork off the pixel
 * grid at thumbnail size, and rounding is also what makes the derived portrait
 * geometry come out identical to the hand-tuned path it replaced.
 */
function round(value: number): number {
  return Math.round(value);
}

/* ------------------------------------------------------------------- print */

/** Where the chest print sits, per shape. */
const PRINT_ANCHOR: Record<ArtShape, { x: number; y: number; w: number } | null> = {
  tee: { x: 200, y: 250, w: 118 },
  hoodie: { x: 200, y: 250, w: 112 },
  jersey: { x: 200, y: 268, w: 108 },
  jacket: null,
  shorts: { x: 156, y: 210, w: 56 },
  cap: { x: 200, y: 246, w: 104 },
  beanie: { x: 200, y: 352, w: 84 },
  tote: { x: 200, y: 300, w: 132 },
  ball: { x: 200, y: 258, w: 96 },
  bottle: { x: 200, y: 300, w: 78 },
  poster: null,
};

function ChestPrint({
  shape,
  kind,
  ink,
  number,
}: {
  shape: ArtShape;
  kind: NonNullable<Props["print"]>;
  ink: string;
  number: number;
}) {
  const anchor = PRINT_ANCHOR[shape];
  if (kind === "none" || !anchor) return null;

  if (kind === "number") {
    return (
      <text
        x={anchor.x}
        y={anchor.y + 26}
        textAnchor="middle"
        fontFamily="var(--font-display)"
        fontSize="96"
        fontWeight={700}
        fill={ink}
      >
        {number}
      </text>
    );
  }

  if (kind === "monogram") {
    return (
      <text
        x={anchor.x}
        y={anchor.y + 14}
        textAnchor="middle"
        textLength={anchor.w * 0.55}
        lengthAdjust="spacingAndGlyphs"
        fontFamily="var(--font-display)"
        fontSize="52"
        fontWeight={700}
        fill={ink}
      >
        GO
      </text>
    );
  }

  return (
    <g fill={ink}>
      <text
        x={anchor.x}
        y={anchor.y}
        textAnchor="middle"
        textLength={anchor.w}
        lengthAdjust="spacingAndGlyphs"
        fontFamily="var(--font-display)"
        fontSize="30"
        fontWeight={700}
      >
        GUILLE
      </text>
      <text
        x={anchor.x}
        y={anchor.y + 24}
        textAnchor="middle"
        textLength={anchor.w * 0.78}
        lengthAdjust="spacingAndGlyphs"
        fontFamily="var(--font-display)"
        fontSize="24"
        fontWeight={500}
      >
        Outes
      </text>
    </g>
  );
}
