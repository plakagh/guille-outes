/**
 * The paint studio's data model — everything except the pixels.
 *
 * A drawing is stored as the **list of things that were done to it**, not as a
 * bitmap, and every operation is deterministic. That one decision pays for
 * itself three times over:
 *
 *  * **Undo is free and exact.** Undo drops the last op and replays the rest.
 *    No stack of full-canvas snapshots (a 1500² canvas is 9 MB of `ImageData`
 *    each, and twenty of those is a tablet running out of memory mid-drawing).
 *  * **A half-finished drawing survives the trip to the sign-up page**, because
 *    a few hundred ops encode to kilobytes of JSON while a PNG data URL does
 *    not reliably fit in `localStorage`. Painting needs no account; publishing
 *    does, and the round trip must not cost the child their drawing.
 *  * **The textured brushes stay textured after an undo.** Crayon and spray
 *    scatter their marks randomly, so replaying them needs the *same* random
 *    numbers — hence a seed per stroke and a generator we control rather than
 *    `Math.random()`.
 *
 * No DOM here on purpose: this file is unit tested. The canvas lives in
 * `paint-render.ts`.
 */

/* ================================================================ brushes */

export const BRUSHES = ["marker", "pencil", "crayon", "spray", "eraser"] as const;
export type BrushId = (typeof BRUSHES)[number];

export function isBrush(value: string): value is BrushId {
  return (BRUSHES as readonly string[]).includes(value);
}

/**
 * How each brush behaves, in one table.
 *
 * `width` scales the chosen thickness, `alpha` is how much one pass covers, and
 * `grain` is how many scattered marks a textured brush adds per segment — zero
 * for the brushes that draw a clean line.
 */
export const BRUSH_SPEC: Record<
  BrushId,
  { width: number; alpha: number; grain: number; spread: number }
> = {
  // A felt-tip: opaque, even, the same width wherever you press.
  marker: { width: 1, alpha: 1, grain: 0, spread: 0 },
  // A pencil is thin and builds up: going over the same place twice is darker,
  // which is what makes shading work at all.
  pencil: { width: 0.32, alpha: 0.45, grain: 0, spread: 0 },
  // Wax catches on the paper. The grain marks are what stop it looking like a
  // fat marker.
  crayon: { width: 0.9, alpha: 0.75, grain: 5, spread: 0.42 },
  // Spray paints nothing along the line itself, only the scatter around it.
  spray: { width: 0, alpha: 0.16, grain: 26, spread: 1.6 },
  // The eraser is a marker loaded with the colour of the paper. Modelling it as
  // `destination-out` would leave real holes, and a hole is not what a child
  // means by rubbing something out — they mean "put the paper back".
  eraser: { width: 1.15, alpha: 1, grain: 0, spread: 0 },
};

/** Thicknesses in canvas pixels, at `CANVAS_SIZE`. */
export const BRUSH_SIZES = [7, 16, 34, 64] as const;

/** The canvas is square: it tiles the gallery grid evenly, and it prints. */
export const CANVAS_SIZE = 1500;

/* ================================================================ palette */

/**
 * A painting palette, not the shop's garment palette.
 *
 * `COLORWAYS` in `catalog.ts` exists to tint drawings of clothes and is full of
 * greys and navies; a child reaching for red wants red.
 *
 * Laid out the way every paint palette has been laid out for thirty years, and
 * that convention is the point rather than a lack of imagination: **the columns
 * are hues and the rows are shades**, so finding "a darker green" means looking
 * one row down from the green you already found, not hunting through an
 * unsorted grid. The first version of this was twenty-four colours in no
 * particular order, which is fine for choosing *a* colour and useless for
 * choosing *the* colour.
 *
 * Twelve hues around the wheel × three shades (light, full, dark), then a row of
 * neutrals. That last row earns its place: it carries black and white, the greys,
 * and the browns and skin tones. Children draw tree trunks, hair and their own
 * faces, and a rainbow with no brown in it cannot do any of the three.
 *
 * `PAINT_COLUMNS` is what the grid is built from, so the layout and this table
 * cannot drift apart.
 */
export const PAINT_COLUMNS = 12;

export const PAINT_COLORS = [
  // Light
  "#ff8f96", "#ffb384", "#ffd08a", "#ffeb9e", "#dcefa0", "#a8e6a8",
  "#8fdcc8", "#9fe4ea", "#a3bdf5", "#c0b3f2", "#d7b3f0", "#ffc2d8",
  // Full
  "#e2001a", "#f2600c", "#ffa800", "#ffd400", "#b5d600", "#3fbf3f",
  "#009e73", "#00b8c4", "#1d4ed8", "#5b3fd6", "#9b51e0", "#ff5fa2",
  // Dark
  "#8c0010", "#a33c00", "#a86b00", "#a68a00", "#6b8000", "#1e6b1e",
  "#005f45", "#006a72", "#0f2d80", "#34248c", "#5c2a8c", "#a32e63",
  // Neutrals, browns and skin tones
  "#141414", "#3a3a3a", "#6b6b6b", "#9a9a9a", "#c8c8c8", "#ffffff",
  "#4a2a12", "#8b5a2b", "#c9924f", "#e0b183", "#f2d9c0", "#ffe7cf",
] as const;

export const PAPERS = ["#ffffff", "#fdf6e3", "#eaf4ff", "#f6e9f6", "#141414"] as const;

export const DEFAULT_COLOR = "#141414";
export const DEFAULT_PAPER = "#ffffff";

/* ============================================================ operations */

/** Canvas-space coordinates and stylus pressure in 0…1. */
export type Point = { x: number; y: number; p: number };

export type StrokeOp = {
  kind: "stroke";
  brush: BrushId;
  /** Ignored for the eraser, which always paints the paper colour. */
  color: string;
  /** Thickness in canvas pixels, before the brush's own `width` factor. */
  size: number;
  seed: number;
  points: Point[];
};

export type FillOp = {
  kind: "fill";
  x: number;
  y: number;
  color: string;
};

export type Op = StrokeOp | FillOp;

export type Drawing = {
  paper: string;
  ops: Op[];
};

export const EMPTY_DRAWING: Drawing = { paper: DEFAULT_PAPER, ops: [] };

export function isBlank(drawing: Drawing): boolean {
  return drawing.ops.length === 0;
}

/* ============================================================== sampling */

/**
 * Whether a new pointer sample is far enough from the last to be worth keeping.
 *
 * A stylus reports upwards of 120 points a second; at that rate a slow line
 * stores hundreds of samples a centimetre apart by less than a pixel, none of
 * which change what is drawn and all of which have to fit in `localStorage`
 * later. Two pixels is below what anyone can see and cuts the point count by an
 * order of magnitude on slow, careful strokes — which is exactly how children
 * draw.
 */
export const MIN_SAMPLE_DISTANCE = 2;

export function shouldSample(last: Point | undefined, next: Point): boolean {
  if (!last) return true;
  return Math.hypot(next.x - last.x, next.y - last.y) >= MIN_SAMPLE_DISTANCE;
}

/**
 * Stroke width at a point.
 *
 * A mouse and a finger report a constant 0.5 pressure, so the formula has to
 * degrade to "just use the chosen size" for them rather than making every
 * mouse-drawn line permanently half-width. Hence the 0.55 floor: at p = 0.5 the
 * multiplier is 0.9, close enough to nominal, and a stylus still gets the full
 * range either side of it.
 */
export function strokeWidth(size: number, brush: BrushId, pressure: number): number {
  const spec = BRUSH_SPEC[brush];
  const clamped = Math.min(1, Math.max(0, pressure));
  return Math.max(0.5, size * spec.width * (0.55 + 0.7 * clamped));
}

/* ================================================================ random */

/**
 * mulberry32 — a 32-bit PRNG in four lines.
 *
 * Seeded and reproducible, which is the whole point: the same stroke replayed
 * after an undo has to scatter its crayon grain in the same places, or the
 * drawing would visibly change every time something was undone. Nothing here is
 * security-sensitive, so a small fast generator is the right tool.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newSeed(): number {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0];
}

/* =========================================================== persistence */

/**
 * Compact JSON for `localStorage`.
 *
 * Points go out as a flat `[x, y, p, x, y, p, …]` array with the coordinates
 * rounded to whole canvas pixels and the pressure to two decimals. Against the
 * obvious `[{x, y, p}, …]` that is roughly a quarter of the bytes — the keys
 * alone outweigh the numbers — and a whole pixel on a 1500-pixel canvas is
 * below anything a redraw can show.
 *
 * The draft this produces exists for one short window: the walk from "publicar"
 * to the sign-up form and back. It is not a save file, and `decodeDrawing`
 * treats every field as hostile because a value in `localStorage` is a value the
 * page cannot vouch for.
 */
type EncodedStroke = [kind: 0, brush: string, color: string, size: number, seed: number, flat: number[]];
type EncodedFill = [kind: 1, color: string, x: number, y: number];
type EncodedOp = EncodedStroke | EncodedFill;
type EncodedDrawing = { v: 1; paper: string; ops: EncodedOp[] };

export function encodeDrawing(drawing: Drawing): string {
  const ops: EncodedOp[] = drawing.ops.map((op) =>
    op.kind === "fill"
      ? [1, op.color, Math.round(op.x), Math.round(op.y)]
      : [
          0,
          op.brush,
          op.color,
          op.size,
          op.seed,
          op.points.flatMap((point) => [
            Math.round(point.x),
            Math.round(point.y),
            Math.round(point.p * 100) / 100,
          ]),
        ],
  );

  return JSON.stringify({ v: 1, paper: drawing.paper, ops } satisfies EncodedDrawing);
}

const HEX = /^#[0-9a-f]{6}$/i;

function safeColor(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX.test(value) ? value : fallback;
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function decodeDrawing(raw: string): Drawing | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const candidate = parsed as Partial<EncodedDrawing>;
  if (candidate.v !== 1 || !Array.isArray(candidate.ops)) return null;

  const ops: Op[] = [];

  for (const entry of candidate.ops) {
    if (!Array.isArray(entry)) continue;

    if (entry[0] === 1) {
      const [, color, x, y] = entry as EncodedFill;
      const px = finite(x);
      const py = finite(y);
      if (px === null || py === null) continue;
      ops.push({ kind: "fill", x: px, y: py, color: safeColor(color, DEFAULT_COLOR) });
      continue;
    }

    if (entry[0] !== 0) continue;
    const [, brush, color, size, seed, flat] = entry as EncodedStroke;
    if (typeof brush !== "string" || !isBrush(brush)) continue;
    if (!Array.isArray(flat)) continue;

    const points: Point[] = [];
    for (let i = 0; i + 2 < flat.length; i += 3) {
      const x = finite(flat[i]);
      const y = finite(flat[i + 1]);
      const p = finite(flat[i + 2]);
      if (x === null || y === null) continue;
      points.push({ x, y, p: p === null ? 0.5 : Math.min(1, Math.max(0, p)) });
    }
    if (points.length === 0) continue;

    ops.push({
      kind: "stroke",
      brush,
      color: safeColor(color, DEFAULT_COLOR),
      size: finite(size) ?? BRUSH_SIZES[1],
      seed: finite(seed) ?? 1,
      points,
    });
  }

  return { paper: safeColor(candidate.paper, DEFAULT_PAPER), ops };
}

/* ================================================================ colour */

/** `#rrggbb` → `[r, g, b]`. Used by the fill tool, which works in bytes. */
export function hexToRgb(hex: string): [number, number, number] {
  const value = HEX.test(hex) ? hex : DEFAULT_COLOR;
  return [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
  ];
}

/**
 * Whether black or white type is legible on a colour.
 *
 * Rec. 601 luma, which is good enough to decide whether the tick on a selected
 * swatch should be dark or light — the one place this is used.
 */
export function isLight(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}
