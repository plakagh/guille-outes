"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import {
  BrushIcon,
  BucketIcon,
  CollapseIcon,
  CrayonIcon,
  EraserIcon,
  ExpandIcon,
  PencilIcon,
  RedoIcon,
  SprayIcon,
  TrashIcon,
  UndoIcon,
} from "@/components/icons";
import { PublishDialog } from "@/components/gallery/publish-dialog";
import { Button } from "@/components/ui/button";
import { CloseIcon } from "@/components/icons";
import {
  BRUSH_SIZES,
  CANVAS_SIZE,
  DEFAULT_COLOR,
  DEFAULT_PAPER,
  PAINT_COLORS,
  PAINT_COLUMNS,
  PAPERS,
  decodeDrawing,
  encodeDrawing,
  isLight,
  newSeed,
  shouldSample,
  EMPTY_DRAWING,
  type BrushId,
  type Drawing,
  type Op,
  type Point,
  type StrokeOp,
} from "@/lib/gallery/paint";
import { applyOp, canvasToPng, renderDrawing, strokePainter } from "@/lib/gallery/paint-render";
import { cn } from "@/lib/utils";

/**
 * El taller — the painting tool.
 *
 * Built for a tablet held flat on a table at a fair, by someone who is six and
 * has never used this before. Every decision below comes from that:
 *
 *  * **No account to paint.** The drawing lives in this browser until somebody
 *    presses publish, and only then does it need a grown-up.
 *  * **Undo is the most important button on the toolbar**, so it is large, it is
 *    where a right hand lands, and it is never disabled-looking-but-there.
 *  * **The canvas cannot be scrolled by accident.** `touch-action: none` and
 *    pointer capture mean a palm dragging across the screen draws or does
 *    nothing — it never scrolls the page out from under the drawing.
 *  * **A stylus wins over a palm.** Once a pen has been seen, touches are
 *    ignored: children rest their whole hand on the glass, and without this the
 *    drawing gains a fat smear beside every line.
 *
 * The drawing itself is a list of operations, not a bitmap — see `paint.ts` for
 * why that is what makes undo, the textured brushes and the draft all work.
 */

const DRAFT_KEY = "go-artwork-draft-v1";
const HISTORY_LIMIT = 80;

type Tool = BrushId | "fill";

const TOOLS: { id: Tool; Icon: typeof BrushIcon }[] = [
  { id: "marker", Icon: BrushIcon },
  { id: "pencil", Icon: PencilIcon },
  { id: "crayon", Icon: CrayonIcon },
  { id: "spray", Icon: SprayIcon },
  { id: "fill", Icon: BucketIcon },
  { id: "eraser", Icon: EraserIcon },
];

export function PaintStudio({
  signedIn,
  returnTo,
  privacyHref,
}: {
  signedIn: boolean;
  returnTo: string;
  privacyHref: string;
}) {
  const { t, href } = useI18n();
  const router = useRouter();
  const s = t.gallery.studio;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  /**
   * Undo and redo work on **snapshots of the whole drawing**, not on single
   * operations. A snapshot is one small object holding a paper colour and an
   * array of references — a few kilobytes even for a long drawing — and it buys
   * two things:
   *
   *  * "Empezar de nuevo" is an ordinary undoable step rather than a destructive
   *    button needing a confirmation dialog a six-year-old will dismiss;
   *  * the paper comes back with the strokes. Undoing a fresh start onto a white
   *    sheet, and getting the drawing back on the wrong colour paper, is the kind
   *    of thing that makes a child stop trusting the undo button.
   */
  const drawingRef = useRef<Drawing>(EMPTY_DRAWING);
  const pastRef = useRef<Drawing[]>([]);
  const futureRef = useRef<Drawing[]>([]);

  const strokeRef = useRef<{ op: StrokeOp; paint: (ctx: CanvasRenderingContext2D) => void } | null>(
    null,
  );
  const rectRef = useRef<DOMRect | null>(null);
  const penSeenRef = useRef(false);

  const [tool, setTool] = useState<Tool>("marker");
  const [color, setColor] = useState<string>(DEFAULT_COLOR);
  const [size, setSize] = useState<number>(BRUSH_SIZES[1]);

  /**
   * Everything the toolbar needs to render, in one piece of state.
   *
   * The drawing itself lives in refs — a stroke in progress must not re-render
   * the tree on every pointer sample, and a canvas is not something React should
   * be reconciling — so this is the thin mirror that tells the buttons whether
   * undo is available and which paper is selected. One object and one setter, so
   * a change can never land half-applied.
   */
  const [toolbar, setToolbar] = useState({
    past: 0,
    future: 0,
    ops: 0,
    paper: DEFAULT_PAPER,
  });

  const bump = useCallback(() => {
    setToolbar({
      past: pastRef.current.length,
      future: futureRef.current.length,
      ops: drawingRef.current.ops.length,
      paper: drawingRef.current.paper,
    });
  }, []);

  const [publishOpen, setPublishOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  /**
   * Full screen: the sheet, the tools, and nothing else.
   *
   * Two mechanisms, and both are needed. The **overlay** is what actually does
   * the work — a fixed layer over the page — because `requestFullscreen` on an
   * element is still not available on iPhone Safari, which is half the devices
   * this will run on. The **native fullscreen call** goes on top where it is
   * supported, because on a tablet at a fair it is the only way to get rid of
   * the browser's own address bar, and that is a third of the screen.
   *
   * So the overlay is the feature and native fullscreen is a bonus that is
   * allowed to fail.
   */
  const [maximised, setMaximised] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  /**
   * Leaving with a drawing that was never published.
   *
   * Until now the draft simply stayed, which is right for one family on one
   * phone and wrong for the device this was built for: a tablet on a stand,
   * where the next child to sit down would find somebody else's drawing on the
   * sheet. But silently deleting it is worse — it is the only copy.
   *
   * So the question gets asked, and the answer is theirs. Keeping it is still
   * offered first, because it is what a family on their own device wants.
   */
  const [leaving, setLeaving] = useState(false);
  const leaveRef = useRef<HTMLDialogElement>(null);

  const context = () => {
    if (ctxRef.current) return ctxRef.current;
    const ctx = canvasRef.current?.getContext("2d", { willReadFrequently: true }) ?? null;
    ctxRef.current = ctx;
    return ctx;
  };

  const repaint = useCallback(() => {
    const ctx = context();
    if (ctx) renderDrawing(ctx, drawingRef.current);
  }, []);

  /* ------------------------------------------------------------- the draft */

  const saveDraft = useCallback(() => {
    try {
      window.localStorage.setItem(DRAFT_KEY, encodeDrawing(drawingRef.current));
    } catch {
      // A full quota costs the round trip through the sign-in form, nothing
      // more: the drawing itself lives in this component until the tab closes.
    }
  }, []);

  const clearDraft = useCallback(() => {
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* nothing to clean up */
    }
  }, []);

  // Restore on mount, which is what makes "paint → sign in → come back" work.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let restored = false;
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      const drawing = raw ? decodeDrawing(raw) : null;
      if (drawing && drawing.ops.length > 0) {
        drawingRef.current = drawing;
        restored = true;
      }
    } catch {
      /* an unreadable draft is a blank sheet */
    }

    // Painting the canvas is what this effect is for — it is the external system
    // React does not own. The single `bump()` afterwards runs only when there was
    // a draft to restore, so the common case (a blank sheet) renders once.
    repaint();
    if (restored) bump();
  }, [repaint, bump]);

  /* -------------------------------------------------------------- history */

  const commit = useCallback(
    (next: Drawing) => {
      pastRef.current.push(drawingRef.current);
      if (pastRef.current.length > HISTORY_LIMIT) pastRef.current.shift();
      futureRef.current = [];
      drawingRef.current = next;
      bump();
      saveDraft();
    },
    [bump, saveDraft],
  );

  /** Adds one operation. The live canvas has already drawn it. */
  const commitOp = useCallback(
    (op: Op) => {
      const current = drawingRef.current;
      commit({ paper: current.paper, ops: [...current.ops, op] });
    },
    [commit],
  );

  const step = useCallback(
    (from: React.RefObject<Drawing[]>, to: React.RefObject<Drawing[]>) => {
      const next = from.current.pop();
      if (!next) return;
      to.current.push(drawingRef.current);
      drawingRef.current = next;
      repaint();
      bump();
      saveDraft();
    },
    [repaint, bump, saveDraft],
  );

  const undo = useCallback(() => step(pastRef, futureRef), [step]);
  const redo = useCallback(() => step(futureRef, pastRef), [step]);

  /* -------------------------------------------------------------- drawing */

  /** Screen coordinates → canvas coordinates, against the rect cached on down. */
  const toCanvas = (event: { clientX: number; clientY: number; pressure?: number }): Point => {
    const rect = rectRef.current ?? canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0, p: 0.5 };

    const scale = CANVAS_SIZE / rect.width;
    // A mouse reports 0 pressure while its button is down in some browsers and
    // 0.5 in others. Either way it means "no pressure sensor", not "no pressure".
    const pressure = event.pressure && event.pressure > 0 ? event.pressure : 0.5;

    return {
      x: (event.clientX - rect.left) * scale,
      y: (event.clientY - rect.top) * scale,
      p: pressure,
    };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    // Palm rejection. Once this device has shown us a stylus, a touch is a hand
    // resting on the glass and not an attempt to draw.
    if (event.pointerType === "touch" && penSeenRef.current) return;
    if (event.pointerType === "pen") penSeenRef.current = true;
    // A right-click or a two-finger tap is not a stroke.
    if (event.button !== 0) return;

    const canvas = canvasRef.current;
    const ctx = context();
    if (!canvas || !ctx) return;

    rectRef.current = canvas.getBoundingClientRect();
    canvas.setPointerCapture(event.pointerId);

    const point = toCanvas(event);

    if (tool === "fill") {
      const op: Op = { kind: "fill", x: point.x, y: point.y, color };
      applyOp(ctx, op, drawingRef.current.paper);
      commitOp(op);
      return;
    }

    const op: StrokeOp = {
      kind: "stroke",
      brush: tool,
      color,
      size,
      seed: newSeed(),
      points: [point],
    };

    strokeRef.current = { op, paint: strokePainter(op, drawingRef.current.paper) };
    strokeRef.current.paint(ctx);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const active = strokeRef.current;
    const ctx = context();
    if (!active || !ctx) return;

    /*
      A stylus fires far faster than the display refreshes, and the browser
      delivers the samples it skipped in `getCoalescedEvents`. Reading them is
      the difference between a smooth curve and a polygon on a fast diagonal —
      and it costs nothing, since the sampler below throws away everything that
      lands within two pixels of the last point anyway.
    */
    const native = event.nativeEvent;
    const samples =
      typeof native.getCoalescedEvents === "function"
        ? native.getCoalescedEvents()
        : [native];

    for (const sample of samples.length > 0 ? samples : [native]) {
      const point = toCanvas(sample);
      const last = active.op.points[active.op.points.length - 1];
      if (shouldSample(last, point)) active.op.points.push(point);
    }

    active.paint(ctx);
  };

  const endStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const active = strokeRef.current;
    strokeRef.current = null;
    rectRef.current = null;

    if (canvasRef.current?.hasPointerCapture(event.pointerId)) {
      canvasRef.current.releasePointerCapture(event.pointerId);
    }
    if (!active) return;

    commitOp(active.op);
  };

  /* ---------------------------------------------------------------- paper */

  const changePaper = (next: string) => {
    // A history step of its own, so a paper picked by accident is one tap of undo
    // away. The repaint puts every stroke back over the new colour, and the
    // eraser starts rubbing out to it immediately.
    commit({ paper: next, ops: drawingRef.current.ops });
    repaint();
  };

  const startOver = () => {
    commit(EMPTY_DRAWING);
    repaint();
  };

  /* ---------------------------------------------------------- full screen */

  const toggleMaximised = () => {
    const next = !maximised;
    setMaximised(next);

    // Failure here is not an error path: the overlay has already been applied
    // by the state change above, and a browser that refuses (or does not know)
    // the Fullscreen API simply keeps its own chrome.
    const root = rootRef.current;
    if (next) {
      void root?.requestFullscreen?.().catch(() => undefined);
    } else if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => undefined);
    }
  };

  /*
    Leaving native fullscreen has three doors — our button, the Escape key, and
    whatever gesture the browser offers — and only the first one runs our code.
    Listening to `fullscreenchange` is what stops the overlay being left behind
    covering the page after the other two.
  */
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setMaximised(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Escape leaves the overlay when there is no native fullscreen to leave. Not
  // while the publish dialog is open: there, Escape belongs to the dialog, and
  // closing both at once would throw the child back out of the studio.
  useEffect(() => {
    if (!maximised || publishOpen) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || document.fullscreenElement) return;
      setMaximised(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [maximised, publishOpen]);

  // The page behind the overlay must not scroll under a stray finger.
  useEffect(() => {
    if (!maximised) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [maximised]);

  /* ----------------------------------------------------------- finishing */

  const leave = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => undefined);
    }
    setMaximised(false);
    router.push(href("gallery"));
  }, [router, href]);

  /** Nothing drawn, nothing to ask about. */
  const requestLeave = () => {
    if (toolbar.ops === 0) {
      leave();
      return;
    }
    setLeaving(true);
  };

  const keepAndLeave = () => {
    saveDraft();
    setLeaving(false);
    leave();
  };

  const discardAndLeave = () => {
    clearDraft();
    setLeaving(false);
    leave();
  };

  const publishInstead = () => {
    setLeaving(false);
    void openPublish();
  };

  useEffect(() => {
    const dialog = leaveRef.current;
    if (!dialog) return;
    if (leaving && !dialog.open) dialog.showModal();
    if (!leaving && dialog.open) dialog.close();
  }, [leaving]);

  /*
    Closing the tab is closing too, and it is the one exit we cannot put three
    buttons on: the platform only allows the browser's own "leave site?" prompt,
    with its own wording. Worth having anyway — it is the difference between
    losing a drawing to a stray gesture and being asked first.
  */
  useEffect(() => {
    if (toolbar.ops === 0) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [toolbar.ops]);

  /* -------------------------------------------------------------- publish */

  const openPublish = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const file = await canvasToPng(canvas, "dibujo.png");
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return file ? URL.createObjectURL(file) : null;
    });
    setPublishOpen(true);
  };

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const canUndo = toolbar.past > 0;
  const canRedo = toolbar.future > 0;
  const isBlank = toolbar.ops === 0;
  const paper = toolbar.paper;

  return (
    /*
      One tree for both modes, and that is load-bearing rather than tidiness: a
      `<canvas>` holds its bitmap in the element itself, so rendering a different
      tree for full screen would unmount it and take the drawing with it. Only the
      classes change. (Resizing the CSS box is safe on its own — the backing store
      is fixed at CANVAS_SIZE and does not care how big it is drawn.)

      In full screen the split follows the way the device is *held*, not how wide
      it is: landscape puts the tools down the side, portrait along the bottom
      where a thumb reaches. `lg:` would get that wrong on a tablet stood upright.
    */
    <div
      ref={rootRef}
      className={cn(
        maximised
          ? "fixed inset-0 z-50 flex bg-white portrait:flex-col landscape:flex-row"
          : "grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8",
      )}
    >
      {/* ------------------------------------------------------ the sheet */}
      <div className={cn(maximised ? "flex min-h-0 min-w-0 flex-1 flex-col gap-2 p-2" : "min-w-0")}>
        {/*
          The centring box. Full screen, the sheet takes the largest square that
          fits: `h-full` with a 1:1 ratio sizes it off the height, and `max-w-full`
          claws it back when the width is the tighter of the two.
        */}
        <div className={cn(maximised && "grid min-h-0 flex-1 place-items-center")}>
          <div
            className={cn(
              "aspect-square border border-line bg-white",
              maximised
                ? "h-full max-h-full max-w-full"
                : "mx-auto w-full max-w-[46rem] shadow-[0_1px_0_rgba(0,0,0,0.06)]",
            )}
          >
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              role="img"
              aria-label={s.canvasLabel}
              // `touch-action: none` is what stops a drag becoming a page scroll.
              // Without it the first stroke a child draws scrolls the drawing off
              // the screen, and there is no way to recover that with a finger.
              className="block size-full cursor-crosshair touch-none"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endStroke}
              onPointerCancel={endStroke}
            />
          </div>
        </div>

        <div
          className={cn(
            "flex flex-wrap items-center gap-2",
            maximised ? "shrink-0" : "mx-auto mt-3 max-w-[46rem]",
          )}
        >
          <ToolButton onClick={undo} disabled={!canUndo} label={s.undo}>
            <UndoIcon className="size-5" />
          </ToolButton>
          <ToolButton onClick={redo} disabled={!canRedo} label={s.redo}>
            <RedoIcon className="size-5" />
          </ToolButton>
          <ToolButton onClick={startOver} disabled={isBlank} label={s.startOver}>
            <TrashIcon className="size-5" />
          </ToolButton>

          {/* The hint is the first thing to go: full screen, every row of pixels
              it takes is a row the sheet does not get. */}
          {!maximised && <p className="text-[0.75rem] text-mute">{s.undoHint}</p>}

          <div className="ml-auto">
            <ToolButton
              onClick={toggleMaximised}
              label={maximised ? s.exitMaximise : s.maximise}
            >
              {maximised ? (
                <CollapseIcon className="size-5" />
              ) : (
                <ExpandIcon className="size-5" />
              )}
            </ToolButton>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- the toolbar */}
      <div
        className={cn(
          maximised
            ? "shrink-0 space-y-5 overflow-y-auto border-line p-3 landscape:w-[19rem] landscape:border-l portrait:max-h-[45vh] portrait:border-t"
            : "space-y-6 lg:sticky lg:top-4 lg:self-start",
        )}
      >
        <Fieldset legend={s.tool}>
          <ul className="grid grid-cols-6 gap-2 lg:grid-cols-3">
            {TOOLS.map(({ id, Icon }) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => setTool(id)}
                  aria-pressed={tool === id}
                  title={s.tools[id]}
                  className={cn(
                    "flex aspect-square w-full flex-col items-center justify-center gap-1 border-2 text-[0.6875rem] font-semibold uppercase transition-colors",
                    tool === id
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-white hover:border-ink",
                  )}
                >
                  <Icon className="size-6" />
                  <span className="hidden lg:block">{s.tools[id]}</span>
                </button>
              </li>
            ))}
          </ul>
        </Fieldset>

        <Fieldset legend={s.thickness}>
          <ul className="flex items-center gap-2">
            {BRUSH_SIZES.map((value) => (
              <li key={value} className="flex-1">
                <button
                  type="button"
                  onClick={() => setSize(value)}
                  aria-pressed={size === value}
                  aria-label={`${s.thickness} ${value}`}
                  className={cn(
                    "flex h-12 w-full items-center justify-center border-2 transition-colors",
                    size === value ? "border-ink bg-shell" : "border-line bg-white hover:border-ink",
                  )}
                >
                  <span
                    className="block rounded-full bg-ink"
                    style={{
                      // Shown at a third of its canvas size: the sheet is 1500 px
                      // wide and the swatch is not, so the raw number would make
                      // the fattest brush fill the button.
                      width: `${Math.max(4, value / 3)}px`,
                      height: `${Math.max(4, value / 3)}px`,
                    }}
                  />
                </button>
              </li>
            ))}
          </ul>
        </Fieldset>

        <Fieldset legend={s.colour}>
          {/*
            The classic palette: columns are hues, rows are shades. See
            `PAINT_COLORS` for why that ordering is the whole point.

            The swatches sit flush against each other rather than in a gapped
            grid — that is what makes it read as one palette instead of forty-odd
            separate buttons, and it gives every colour a slightly larger target
            on a tablet into the bargain.
          */}
          <ul
            className="grid overflow-hidden border border-line"
            style={{ gridTemplateColumns: `repeat(${PAINT_COLUMNS}, minmax(0, 1fr))` }}
          >
            {PAINT_COLORS.map((value) => {
              const chosen = color === value;
              return (
                <li key={value} className="relative">
                  <button
                    type="button"
                    onClick={() => setColor(value)}
                    aria-pressed={chosen}
                    aria-label={value}
                    style={{ backgroundColor: value }}
                    className="block aspect-square w-full"
                  >
                    {/*
                      The marker is drawn *inside* the swatch, in whichever of
                      black or white shows up on it. A ring around the outside
                      would be covered by the neighbouring swatches, since they
                      touch — and on a pale yellow a white tick is invisible.
                    */}
                    {chosen && (
                      <span
                        aria-hidden="true"
                        className={cn(
                          "absolute inset-[15%] border-2",
                          isLight(value) ? "border-ink" : "border-white",
                        )}
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {/*
            The browser's own picker for everything the palette does not have,
            with the colour in hand shown beside it — a palette this size needs
            somewhere to answer "which one am I actually painting with?" without
            hunting for the marked square.
          */}
          <div className="mt-3 flex items-center gap-3">
            <span
              aria-hidden="true"
              style={{ backgroundColor: color }}
              className="size-8 shrink-0 border border-line"
            />
            <label className="flex items-center gap-2 text-[0.8125rem]">
              <input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="size-8 cursor-pointer border border-line bg-white p-0.5"
              />
              {s.customColour}
            </label>
          </div>
        </Fieldset>

        <Fieldset legend={s.paper}>
          <ul className="flex gap-2">
            {PAPERS.map((value) => (
              <li key={value} className="flex-1">
                <button
                  type="button"
                  onClick={() => changePaper(value)}
                  aria-pressed={paper === value}
                  aria-label={value}
                  style={{ backgroundColor: value }}
                  className={cn(
                    "h-10 w-full border",
                    paper === value ? "border-ink ring-2 ring-ink" : "border-line",
                  )}
                />
              </li>
            ))}
          </ul>
        </Fieldset>

        <div className="space-y-3 border-t border-line pt-5">
          <Button type="button" size="lg" block onClick={openPublish} disabled={isBlank}>
            {s.publish}
          </Button>
          <p className="text-[0.75rem] leading-relaxed text-mute">
            {signedIn ? s.publishHint : s.publishHintSignedOut}
          </p>
          {/* Finishing is a separate act from publishing, and it is the one that
              asks what to do with a drawing nobody published. */}
          <Button type="button" variant="ghost" block onClick={requestLeave}>
            {s.leave}
          </Button>
        </div>
      </div>

      <PublishDialog
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        origin="painted"
        previewUrl={preview}
        signedIn={signedIn}
        returnTo={returnTo}
        privacyHref={privacyHref}
        makeFile={async () => {
          const canvas = canvasRef.current;
          if (!canvas) return null;
          const file = await canvasToPng(canvas, "dibujo.png");
          return file ? { file, width: CANVAS_SIZE, height: CANVAS_SIZE } : null;
        }}
        // The draft has done its job once the drawing is on its way to the
        // server. Clearing it here is what stops the next child at the stand
        // finding the previous one's drawing on the sheet. The canvas itself is
        // untouched, so a failed publish loses nothing that is on screen.
        onSubmitted={clearDraft}
      />

      {/*
        Three doors, and the wording says what each one costs. "Keep" is first
        because it is what a family on their own device wants; "delete" carries
        its warning on the label rather than behind a second confirmation, since
        the person reading it is the one who drew the thing.
      */}
      <dialog
        ref={leaveRef}
        onClose={() => setLeaving(false)}
        onClick={(event) => {
          if (event.target === leaveRef.current) setLeaving(false);
        }}
        aria-labelledby="studio-leave-title"
        className="w-[min(30rem,calc(100vw-1.5rem))] bg-white p-0 text-ink backdrop:bg-black/60"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 id="studio-leave-title" className="text-xl">
              {s.pendingTitle}
            </h2>
            <p className="mt-1 text-[0.875rem] text-mute">{s.pendingBlurb}</p>
          </div>
          <button
            type="button"
            onClick={() => setLeaving(false)}
            aria-label={t.common.close}
            className="-m-2 p-2 text-mute hover:text-ink"
          >
            <CloseIcon className="size-5" />
          </button>
        </div>

        <div className="divide-y divide-line">
          <LeaveChoice
            label={s.pendingKeep}
            hint={s.pendingKeepHint}
            onClick={keepAndLeave}
          />
          <LeaveChoice
            label={s.pendingPublish}
            hint={s.pendingPublishHint}
            onClick={publishInstead}
          />
          <LeaveChoice
            label={s.pendingDelete}
            hint={s.pendingDeleteHint}
            onClick={discardAndLeave}
            danger
          />
        </div>
      </dialog>
    </div>
  );
}

/** One of the three answers to "what do we do with this drawing?". */
function LeaveChoice({
  label,
  hint,
  onClick,
  danger,
}: {
  label: string;
  hint: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full px-5 py-4 text-left transition-colors hover:bg-shell"
    >
      <span
        className={cn(
          "block font-display text-[0.9375rem] font-bold uppercase",
          danger && "text-flame",
        )}
      >
        {label}
      </span>
      <span className="mt-0.5 block text-[0.8125rem] leading-relaxed text-mute">{hint}</span>
    </button>
  );
}

/* ---------------------------------------------------------------- pieces */

function Fieldset({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="eyebrow mb-2 text-mute">{legend}</h2>
      {children}
    </section>
  );
}

function ToolButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="flex size-12 items-center justify-center border-2 border-line bg-white transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-line"
    >
      {children}
    </button>
  );
}
