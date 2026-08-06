import {
  BRUSH_SPEC,
  CANVAS_SIZE,
  hexToRgb,
  mulberry32,
  strokeWidth,
  type Drawing,
  type FillOp,
  type Op,
  type StrokeOp,
} from "@/lib/gallery/paint";

/**
 * Turning a `Drawing` into pixels.
 *
 * Split out from `paint.ts` so the model stays testable in Node: everything here
 * needs a real `CanvasRenderingContext2D`.
 */

/* =============================================================== strokes */

/**
 * Paints one stroke, resumably.
 *
 * The returned function draws whatever has been added to `op.points` since the
 * last call, which is what lets the same code serve both jobs: called once per
 * pointer event it draws live, and called once at the end it replays the whole
 * stroke. Only one implementation of what a crayon looks like, therefore no way
 * for the live drawing and the redraw after an undo to disagree.
 *
 * The generator is created once and kept in the closure for exactly that reason.
 * Fast-forwarding it to a segment index would mean knowing how many numbers each
 * previous segment consumed — a rule that would silently break the day a brush
 * changed how much grain it scatters.
 */
export function strokePainter(op: StrokeOp, paper: string) {
  const spec = BRUSH_SPEC[op.brush];
  const random = mulberry32(op.seed);
  const color = op.brush === "eraser" ? paper : op.color;
  let painted = 0;

  /** Scatter for the textured brushes: crayon grain, spray mist. */
  const scatter = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number) => {
    const radius = width * spec.spread + op.size * spec.spread * 0.5;
    for (let i = 0; i < spec.grain; i += 1) {
      // Rejection-free polar scatter. The square root is what keeps the density
      // even instead of clumping everything at the centre.
      const angle = random() * Math.PI * 2;
      const distance = Math.sqrt(random()) * radius;
      const dot = Math.max(0.6, width * 0.18 + op.size * 0.03);
      ctx.beginPath();
      ctx.arc(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance, dot, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  return (ctx: CanvasRenderingContext2D) => {
    const points = op.points;
    if (points.length === 0) return;

    ctx.save();
    ctx.globalAlpha = spec.alpha;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    /*
      The first point always gets a mark of its own.

      A tap that never moved is still a dot, and children make a great many of
      them — without this the loop below has no segment to draw and the tap
      leaves nothing behind. It is deliberately *not* conditional on the stroke
      having only one point: live, the stroke starts as a single point and gets
      its dot before any segment arrives, so a replay that skipped the dot would
      draw the same stroke slightly differently from the way it was drawn. The
      whole reason this painter is resumable is that those two cannot disagree.
    */
    if (painted === 0) {
      const point = points[0];
      const width = strokeWidth(op.size, op.brush, point.p);
      if (spec.width > 0) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, width / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      scatter(ctx, point.x, point.y, width);
      painted = 1;
    }

    for (let i = Math.max(1, painted); i < points.length; i += 1) {
      const from = points[i - 1];
      const to = points[i];
      const width = strokeWidth(op.size, op.brush, (from.p + to.p) / 2);

      if (spec.width > 0) {
        ctx.lineWidth = width;
        ctx.beginPath();
        // Quadratic through the midpoints, with the shared sample as the control
        // point: the cheapest way to get a curve that stays smooth across joins
        // instead of showing every sample as a corner.
        if (i === 1) {
          ctx.moveTo(from.x, from.y);
        } else {
          const previous = points[i - 2];
          ctx.moveTo((previous.x + from.x) / 2, (previous.y + from.y) / 2);
        }
        ctx.quadraticCurveTo(from.x, from.y, (from.x + to.x) / 2, (from.y + to.y) / 2);
        ctx.stroke();
      }

      if (spec.grain > 0) scatter(ctx, to.x, to.y, width);
    }

    painted = points.length;
    ctx.restore();
  };
}

/* ================================================================== fill */

/** How far a pixel may be from the clicked colour and still be flooded. */
const FILL_TOLERANCE = 32;

/**
 * The paint bucket.
 *
 * Scanline flood fill over one `ImageData` pass. A queue of spans rather than a
 * queue of pixels: on a 1500² canvas the naive four-way version pushes millions
 * of entries and stalls the tablet for seconds, while this fills a typical
 * region in a few milliseconds.
 *
 * The tolerance is not optional. Every brush here draws anti-aliased edges, so a
 * region is never one flat colour right up to its outline; an exact-match fill
 * would stop a pixel short everywhere and leave a halo around everything a child
 * fills in.
 */
export function floodFill(
  ctx: CanvasRenderingContext2D,
  op: FillOp,
  size = CANVAS_SIZE,
): void {
  const x0 = Math.round(op.x);
  const y0 = Math.round(op.y);
  if (x0 < 0 || y0 < 0 || x0 >= size || y0 >= size) return;

  const image = ctx.getImageData(0, 0, size, size);
  const data = image.data;
  const start = (y0 * size + x0) * 4;

  const target = [data[start], data[start + 1], data[start + 2], data[start + 3]] as const;
  const [fr, fg, fb] = hexToRgb(op.color);

  // Clicking a region that is already the fill colour would otherwise walk the
  // whole area to change nothing.
  if (
    Math.abs(target[0] - fr) <= 1 &&
    Math.abs(target[1] - fg) <= 1 &&
    Math.abs(target[2] - fb) <= 1 &&
    target[3] === 255
  ) {
    return;
  }

  const matches = (index: number): boolean =>
    Math.abs(data[index] - target[0]) <= FILL_TOLERANCE &&
    Math.abs(data[index + 1] - target[1]) <= FILL_TOLERANCE &&
    Math.abs(data[index + 2] - target[2]) <= FILL_TOLERANCE &&
    Math.abs(data[index + 3] - target[3]) <= FILL_TOLERANCE;

  const paint = (index: number) => {
    data[index] = fr;
    data[index + 1] = fg;
    data[index + 2] = fb;
    data[index + 3] = 255;
  };

  const stack: number[] = [x0, y0];

  while (stack.length > 0) {
    const y = stack.pop() as number;
    let x = stack.pop() as number;

    let index = (y * size + x) * 4;
    if (!matches(index)) continue;

    // Walk left to the edge of the span, then fill rightwards, checking the row
    // above and below as we go and pushing only the first pixel of each new run.
    while (x > 0 && matches(index - 4)) {
      x -= 1;
      index -= 4;
    }

    let spanAbove = false;
    let spanBelow = false;

    while (x < size && matches(index)) {
      paint(index);

      if (y > 0) {
        const above = matches(index - size * 4);
        if (above && !spanAbove) {
          stack.push(x, y - 1);
          spanAbove = true;
        } else if (!above) {
          spanAbove = false;
        }
      }

      if (y < size - 1) {
        const below = matches(index + size * 4);
        if (below && !spanBelow) {
          stack.push(x, y + 1);
          spanBelow = true;
        } else if (!below) {
          spanBelow = false;
        }
      }

      x += 1;
      index += 4;
    }
  }

  ctx.putImageData(image, 0, 0);
}

/* ================================================================ replay */

export function applyOp(
  ctx: CanvasRenderingContext2D,
  op: Op,
  paper: string,
  size = CANVAS_SIZE,
): void {
  if (op.kind === "fill") {
    floodFill(ctx, op, size);
    return;
  }
  strokePainter(op, paper)(ctx);
}

/**
 * Repaints the whole drawing from scratch: the paper, then every op in order.
 *
 * This is what undo, redo and restoring a draft all call. It is O(ops) and runs
 * only on those actions — never during a stroke, which is why the painter above
 * is resumable.
 */
export function renderDrawing(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  size = CANVAS_SIZE,
): void {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = drawing.paper;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  for (const op of drawing.ops) applyOp(ctx, op, drawing.paper, size);
}

/**
 * The finished drawing, as a PNG file ready to upload.
 *
 * PNG rather than JPEG because a drawing is flat colour and hard edges, which is
 * everything JPEG is bad at — and the file is smaller here too. The canvas is
 * opaque (the eraser paints paper, it does not cut holes), so there is no
 * transparency to preserve and nothing to flatten.
 */
export function canvasToPng(canvas: HTMLCanvasElement, filename: string): Promise<File | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob ? new File([blob], filename, { type: "image/png" }) : null);
    }, "image/png");
  });
}
