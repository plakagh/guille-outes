"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ProductShot } from "@/components/product/product-shot";
import { useI18n } from "@/components/i18n/provider";
import {
  CameraIcon,
  CloseIcon,
  DownloadIcon,
  ShareIcon,
  ShutterIcon,
} from "@/components/icons";
import {
  FramedArt,
  FrameSwatch,
  framedWidthRatio,
  MOULDING_PCT,
} from "@/components/product/framed-art";
import { Swatch } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import type { Colorway } from "@/components/brand/product-art";
import {
  formatFrameSize,
  frameAspect,
  frameOrientation,
  frameSizeOptions,
} from "@/lib/catalog";
import type { FrameFinish, FramePreview, FrameSize, Product } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { drawFramedArt } from "@/lib/wall-photo";

/**
 * "Ve cómo queda en tu casa".
 *
 * The camera fills the screen and the piece — the same CSS frame the product page
 * draws, at the same measurements the label states — sits on top of it. Drag to
 * hang it somewhere, pinch to walk towards the wall, take a photograph.
 *
 * ## Why not WebXR
 *
 * Anchoring to a real wall needs `immersive-ar` with hit testing, which today
 * means Android Chrome and nothing else: no iOS Safari, no desktop. Half of the
 * shop's visitors would get a button that apologises. An overlay you place by
 * hand works on every device that has a camera, and for the question being asked
 * — *is a 50 × 70 too big for that space?* — it answers just as well.
 *
 * ## Why the size is honest and the distance is a guess
 *
 * The centimetres come from the format the shopper is buying — the same two
 * numbers the size button stands for — and switching format here switches what is
 * hanging on the wall. What no browser will tell us is the camera's field of view,
 * so the scale rests on one assumption — {@link ASSUMED_FOV} — and on how far the
 * shopper says they are standing. That is why the distance is a control rather
 * than a reading: the shopper corrects it by pinching until the room looks right,
 * and the piece keeps its true proportions throughout.
 *
 * Nothing is uploaded. The video never leaves the element it is painted in, and
 * the photograph is composed locally in a canvas.
 */

/** Typical horizontal field of view of a phone's main camera, in degrees. */
const ASSUMED_FOV = 65;

/** How far the shopper can claim to be standing, in centimetres. */
const MIN_DISTANCE = 60;
const MAX_DISTANCE = 700;

/** Roughly where someone stands to look at a picture in a room. */
const INITIAL_DISTANCE = 250;

/** Where the piece hangs when the camera opens: centred, a little above middle. */
const INITIAL_POSITION = { x: 0.5, y: 0.44 };

type Stage = "intro" | "starting" | "live" | "denied" | "unavailable";

type Shot = { url: string; blob: Blob };

/* ================================================================= support */

/**
 * Whether this browser could show the wall view at all.
 *
 * Answered before the call to action can be pressed rather than after: a button
 * that opens a panel explaining why it cannot work is worse than no button, and
 * on a desktop without a webcam that is every single press.
 *
 * The answer is published as `data-camera` on the document element and the button
 * is revealed by CSS — see `globals.css`. Deliberately *not* React state: the
 * check is asynchronous, so a state flag would add the button to the tree a beat
 * after the server rendered it without one, and that difference lands during
 * hydration and is reported as a mismatch. Writing an attribute re-renders
 * nothing.
 *
 * The answer cannot change during a visit, so it is resolved once and shared —
 * a grid of twenty cards must not enumerate the hardware twenty times.
 */
let supported: Promise<boolean> | null = null;

function detectSupport(): Promise<boolean> {
  if (typeof navigator === "undefined" || typeof window === "undefined") {
    return Promise.resolve(false);
  }

  // `getUserMedia` exists but throws outside a secure context, which is the state
  // of a phone opening the site over plain http on the local network.
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    return Promise.resolve(false);
  }

  if (!navigator.mediaDevices.enumerateDevices) return Promise.resolve(true);

  return navigator.mediaDevices
    .enumerateDevices()
    .then((devices) =>
      // Listing devices needs no permission: before one is granted the entries
      // carry no labels, but a `videoinput` still appears when the hardware is
      // there. An *empty* list means the browser is withholding its inventory
      // rather than that there is no camera — only a list with other kinds and
      // no video input is proof of a machine that cannot do this.
      devices.length === 0 || devices.some((device) => device.kind === "videoinput"),
    )
    .catch(() => false);
}

/**
 * Runs the probe and publishes the answer for CSS. Returns nothing on purpose:
 * anything returned would end up in a render, which is the thing to avoid.
 *
 * Safe to call from every card on the page — the promise is shared and setting
 * the same attribute twice costs nothing.
 */
export function useCameraProbe(): void {
  useEffect(() => {
    supported ??= detectSupport();
    supported.then((available) => {
      document.documentElement.dataset.camera = available ? "yes" : "no";
    });
  }, []);
}

export function WallView({
  product,
  frame,
  initialFinish,
  initialColorway,
  initialSize,
  onFinish,
  onClose,
}: {
  product: Product;
  frame: FramePreview;
  initialFinish: FrameFinish;
  initialColorway: Colorway;
  /**
   * Told when the shopper tries a different finish here, so the product page can
   * follow. The camera is where the choice is actually made — you hold the piece
   * against your own wall and pick the moulding that suits it — and it would be
   * a poor trick to have that choice not be the one that goes in the basket.
   */
  onFinish?: (finish: FrameFinish) => void;
  /**
   * The format to open on — the one the shopper has selected on the product
   * page. Null from a listing card, where nothing has been chosen yet.
   */
  initialSize?: string | null;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();

  /*
    The formats this piece is sold in, with their real measurements. Computed
    once per render off the product rather than held in state: the sizes cannot
    change while a modal is open, and the selected *name* is the only thing that
    can.
  */
  const options = frameSizeOptions(product, frame);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [stage, setStage] = useState<Stage>("intro");
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  // The camera's own resolution, which is what the cover crop is computed from.
  const [source, setSource] = useState({ width: 0, height: 0 });
  const [distance, setDistance] = useState(INITIAL_DISTANCE);
  const [position, setPosition] = useState(INITIAL_POSITION);
  const [finish, setFinish] = useState<FrameFinish>(initialFinish);
  const [colorway, setColorway] = useState<Colorway>(initialColorway);
  // Held by name, so it survives a re-render that rebuilds the options array.
  const [sizeName, setSizeName] = useState<string | null>(
    // A size that is not one of this product's own formats — impossible today,
    // but the caller is free to pass one — is ignored rather than hung at some
    // measurement nobody sells.
    initialSize && options.some((option) => option.size === initialSize)
      ? initialSize
      : options[0].size,
  );
  const [shot, setShot] = useState<Shot | null>(null);
  const [busy, setBusy] = useState(false);

  /** The format on the wall: its size is what everything below is scaled by. */
  const printSize = options.find((option) => option.size === sizeName) ?? options[0];

  /* ------------------------------------------------------------ lifecycle */

  // Rendered only while open, so the dialog opens on mount. `showModal` — not
  // `open` — is what gives us the focus trap, the inert background and Escape.
  useEffect(() => {
    dialogRef.current?.showModal();

    // iOS keeps scrolling the page behind a modal dialog; nothing else does.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // The camera is the one resource here that must not outlive the dialog: left
  // running, the recording indicator stays lit and the shopper thinks they are
  // still being filmed.
  //
  // `open` also guards the case that leaks in practice — closing the dialog while
  // the permission prompt is still up. The stream then arrives after unmount,
  // with no cleanup left to run, and the camera stays on.
  const open = useRef(true);
  useEffect(() => {
    open.current = true;
    return () => {
      open.current = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  // Revoke the previous photograph's object URL rather than the current one, so
  // taking a second shot cannot leak the first.
  useEffect(() => {
    return () => {
      if (shot) URL.revokeObjectURL(shot.url);
    };
  }, [shot]);

  const measure = useCallback(() => {
    const node = stageRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    setViewport({ width: rect.width, height: rect.height });
  }, []);

  const readSource = useCallback(
    (video: HTMLVideoElement) => {
      setSource({ width: video.videoWidth, height: video.videoHeight });
      measure();
    },
    [measure],
  );

  useEffect(() => {
    if (stage !== "live") return;
    measure();
    const observer = new ResizeObserver(measure);
    if (stageRef.current) observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, [stage, measure]);

  const start = async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStage("unavailable");
      return;
    }

    setStage("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // `ideal` rather than `exact`: a laptop has only a front camera, and a
        // front camera is still better than an error.
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      if (!open.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      setStage("live");

      // The element exists only once the stage is live, so attach on the next
      // frame rather than to a node React has not rendered yet.
      requestAnimationFrame(() => {
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.play().catch(() => {
          /* autoplay refusals are recoverable: the poster frame still shows */
        });
      });
    } catch (error) {
      if (!open.current) return;
      const name = error instanceof DOMException ? error.name : "";
      setStage(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
    }
  };

  /* ------------------------------------------------------------- geometry */

  const geometry = frameGeometry({ viewport, source, distance, printSize, mount: frame.mount });

  /* ------------------------------------------------------------- gestures */

  // Pointer id → last position, which is all a drag and a pinch need between
  // them: one pointer moves the piece, two change how far away the wall is.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ spread: number; distance: number } | null>(null);

  const onPointerDown = (event: React.PointerEvent) => {
    (event.target as Element).setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    pinch.current = null;
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const active = pointers.current;
    if (!active.has(event.pointerId)) return;

    const previous = active.get(event.pointerId)!;
    const next = { x: event.clientX, y: event.clientY };
    active.set(event.pointerId, next);

    if (active.size === 1) {
      if (viewport.width === 0 || viewport.height === 0) return;
      const dx = (next.x - previous.x) / viewport.width;
      const dy = (next.y - previous.y) / viewport.height;
      setPosition((current) => clampPosition(current.x + dx, current.y + dy));
      return;
    }

    if (active.size >= 2) {
      const [a, b] = [...active.values()];
      const spread = Math.hypot(a.x - b.x, a.y - b.y);

      // First move of the gesture: remember the span and the distance it stands
      // for, so the whole pinch is measured against one origin and does not
      // drift the way frame-to-frame ratios do.
      if (!pinch.current) {
        pinch.current = { spread, distance };
        return;
      }
      if (pinch.current.spread < 1) return;

      // Fingers apart is a step towards the wall, which is a smaller distance.
      const ratio = spread / pinch.current.spread;
      setDistance(clampDistance(pinch.current.distance / ratio));
    }
  };

  const endPointer = (event: React.PointerEvent) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const step = event.shiftKey ? 0.08 : 0.02;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };

    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      setPosition((current) => clampPosition(current.x + move[0], current.y + move[1]));
      return;
    }

    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      setDistance((current) => clampDistance(current - 20));
    }
    if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      setDistance((current) => clampDistance(current + 20));
    }
  };

  /* ---------------------------------------------------------- photography */

  const capture = async () => {
    const video = videoRef.current;
    // Either kind of artwork: a photographed product hangs as an <img>, one that
    // has never been photographed as the drawn <svg>.
    const art = artRef.current?.querySelector<SVGSVGElement | HTMLImageElement>("svg, img");
    if (!video || !art || viewport.width === 0) return;

    setBusy(true);
    try {
      const blob = await composePhoto({
        video,
        art,
        viewport,
        source,
        finish,
        mount: frame.mount,
        caption: `${t.meta.siteName} · ${product.name} · ${formatFrameSize(printSize)}`,
      });
      if (blob) setShot({ url: URL.createObjectURL(blob), blob });
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!shot) return;
    const file = new File([shot.blob], `${product.slug}.jpg`, { type: "image/jpeg" });

    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: product.name, text: t.wall.shareText });
        return;
      } catch {
        // Cancelling the share sheet throws; falling through to a download would
        // be a surprise, so treat it as "nothing to do".
        return;
      }
    }

    download(shot.url, `${product.slug}.jpg`);
  };

  const canShareFiles =
    typeof navigator !== "undefined" && typeof navigator.canShare === "function";

  /* ----------------------------------------------------------------- view */

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={onClose}
      aria-labelledby="wall-view-title"
      className="m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden bg-ink p-0 text-white backdrop:bg-black"
    >
      <div className="relative flex h-dvh w-full flex-col">
        {/* ------------------------------------------------------ the room */}
        <div ref={stageRef} className="absolute inset-0 overflow-hidden bg-ink">
          {stage === "live" && (
            <>
              <video
                ref={videoRef}
                muted
                autoPlay
                playsInline
                // `resize` as well as `loadedmetadata`: some cameras report a
                // stream before they report its size, and a size of zero would
                // silently fall back to a scale computed from the screen.
                onLoadedMetadata={(event) => readSource(event.currentTarget)}
                onResize={(event) => readSource(event.currentTarget)}
                className="h-full w-full object-cover"
              />

              {/* The piece. Pointer handling lives on the layer, not on the
                  frame: dragging from anywhere feels like moving the view, and
                  a pinch that starts off the artwork still counts. */}
              <div
                role="application"
                tabIndex={0}
                aria-label={t.wall.canvasLabel}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endPointer}
                onPointerCancel={endPointer}
                onKeyDown={onKeyDown}
                className="absolute inset-0 touch-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70"
              >
                <div
                  ref={artRef}
                  className="absolute"
                  style={{
                    width: geometry.width,
                    left: `${position.x * 100}%`,
                    top: `${position.y * 100}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <FramedArt finish={finish} mount={frame.mount} onWall={false}>
                    <div style={{ aspectRatio: frameAspect(printSize) }}>
                      <ProductShot
                        product={product}
                        colorway={colorway}
                        print={product.print}
                        bare
                        orientation={frameOrientation(printSize)}
                        // This exact node is drawn into the capture canvas, and
                        // the bucket is a different origin from the site.
                        crossOrigin="anonymous"
                      />
                    </div>
                  </FramedArt>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ------------------------------------------------------ top chrome */}
        <div className="relative z-10 flex items-start justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent p-4 pb-10">
          <div className="min-w-0">
            <h2 id="wall-view-title" className="truncate text-lg leading-tight">
              {t.wall.title}
            </h2>
            <p className="truncate text-[0.8125rem] text-white/70">
              {product.name} · {printSize.size ? `${printSize.size} · ` : ""}
              {formatFrameSize(printSize)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.common.close}
            className="grid size-10 shrink-0 place-items-center bg-white/10 backdrop-blur transition hover:bg-white/25"
          >
            <CloseIcon className="size-5" />
          </button>
        </div>

        <div className="flex-1" />

        {/* --------------------------------------------------- bottom chrome */}
        {stage === "live" && !shot && (
          <div className="relative z-10 flex flex-col gap-3 bg-gradient-to-t from-black/80 via-black/60 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10">
            <p className="text-center text-[0.75rem] text-white/70">
              {t.wall.hint}
              <span className="block text-white/45">{t.wall.disclaimer}</span>
            </p>

            {/*
              The formats, above the frame and colour controls and wider than
              them: this is the one choice here that changes the answer rather
              than the look, so a shopper comparing a 30 × 40 with a 50 × 70 on
              the same wall does not have to close the camera between the two.
            */}
            {options.length > 1 && (
              <fieldset className="flex flex-wrap items-center justify-center gap-2">
                <legend className="sr-only">{t.plp.size}</legend>
                {options.map((option) => {
                  const active = option === printSize;
                  return (
                    <button
                      key={option.size ?? "default"}
                      type="button"
                      onClick={() => setSizeName(option.size)}
                      aria-pressed={active}
                      className={cn(
                        "flex h-9 items-center gap-2 border px-3 text-[0.75rem] transition",
                        active
                          ? "border-white bg-white/15 text-white"
                          : "border-white/40 text-white/75 hover:border-white/80",
                      )}
                    >
                      {option.size && <span className="font-semibold">{option.size}</span>}
                      <span className="tabular-nums text-white/70">
                        {formatFrameSize(option)}
                      </span>
                    </button>
                  );
                })}
              </fieldset>
            )}

            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
              {frame.finishes.length > 1 && (
                <fieldset className="flex items-center gap-2">
                  <legend className="sr-only">{t.pdp.frameFinish}</legend>
                  {frame.finishes.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setFinish(option);
                        onFinish?.(option);
                      }}
                      aria-pressed={option === finish}
                      aria-label={t.pdp.frameFinishes[option]}
                      title={t.pdp.frameFinishes[option]}
                      className={cn(
                        "grid size-9 place-items-center border-2 transition",
                        option === finish ? "border-white" : "border-transparent hover:border-white/40",
                      )}
                    >
                      <FrameSwatch finish={option} className="block size-6" />
                    </button>
                  ))}
                </fieldset>
              )}

              {product.colorways.length > 1 && (
                <fieldset className="flex items-center gap-2">
                  <legend className="sr-only">{t.common.color}</legend>
                  {product.colorways.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setColorway(option)}
                      aria-pressed={option.id === colorway.id}
                      aria-label={option.name}
                      title={option.name}
                      className={cn(
                        "grid size-9 place-items-center border-2 transition",
                        option.id === colorway.id
                          ? "border-white"
                          : "border-transparent hover:border-white/40",
                      )}
                    >
                      <Swatch base={option.base} trim={option.trim} className="size-5" />
                    </button>
                  ))}
                </fieldset>
              )}
            </div>

            <label className="flex items-center gap-3 text-[0.75rem] text-white/80">
              <span className="shrink-0">{t.wall.distance}</span>
              <input
                type="range"
                min={MIN_DISTANCE}
                max={MAX_DISTANCE}
                step={10}
                value={Math.round(distance)}
                onChange={(event) => setDistance(Number(event.target.value))}
                className="h-1 min-w-0 flex-1 accent-white"
              />
              <span className="w-14 shrink-0 text-right tabular-nums">
                {formatDistance(distance, locale)}
              </span>
            </label>

            {/* The shutter is centred on the screen, not in what is left over
                after the reset link — a camera control that sits off-centre
                reads as a mistake. */}
            <div className="relative flex items-center justify-center">
              <button
                type="button"
                onClick={() => {
                  setPosition(INITIAL_POSITION);
                  setDistance(INITIAL_DISTANCE);
                }}
                className="absolute left-0 text-[0.75rem] text-white/70 underline transition hover:text-white"
              >
                {t.wall.recentre}
              </button>

              <button
                type="button"
                onClick={capture}
                disabled={busy}
                aria-label={t.wall.capture}
                className="grid size-16 place-items-center rounded-full border-4 border-white/80 text-white transition hover:border-white disabled:opacity-40"
              >
                <ShutterIcon className="size-9" />
              </button>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------- the panels */}
        {stage !== "live" && (
          <Panel>
            {stage === "intro" && (
              <>
                <CameraIcon className="mx-auto size-9 text-white/80" />
                <h3 className="mt-4 text-xl">{t.wall.introTitle}</h3>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-white/75">
                  {t.wall.introBody}
                </p>
                <p className="mt-2 text-[0.8125rem] text-white/55">{t.wall.privacy}</p>
                <Button variant="inverse" size="lg" className="mt-6" block onClick={start}>
                  <CameraIcon className="size-5" />
                  {t.wall.start}
                </Button>
              </>
            )}

            {stage === "starting" && <p className="text-[0.9375rem]">{t.wall.starting}</p>}

            {stage === "denied" && (
              <>
                <h3 className="text-xl">{t.wall.deniedTitle}</h3>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-white/75">
                  {t.wall.deniedBody}
                </p>
                <Button variant="inverse" size="lg" className="mt-6" block onClick={start}>
                  {t.wall.retry}
                </Button>
              </>
            )}

            {stage === "unavailable" && (
              <>
                <h3 className="text-xl">{t.wall.unavailableTitle}</h3>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-white/75">
                  {t.wall.unavailableBody}
                </p>
                <Button variant="inverse" size="lg" className="mt-6" block onClick={onClose}>
                  {t.common.close}
                </Button>
              </>
            )}
          </Panel>
        )}

        {/* -------------------------------------------------- the photograph */}
        {shot && (
          <div className="absolute inset-0 z-20 flex flex-col bg-ink">
            <div className="flex min-h-0 flex-1 items-center justify-center p-4">
              {/* Rendered as an <img> so a long press offers "save image", which
                  is how most people expect to keep a photo. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shot.url}
                alt={t.wall.shotAlt}
                className="max-h-full max-w-full object-contain"
              />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Button variant="inverse" onClick={share}>
                {canShareFiles ? <ShareIcon className="size-5" /> : <DownloadIcon className="size-5" />}
                {canShareFiles ? t.wall.share : t.wall.download}
              </Button>
              <button
                type="button"
                onClick={() => setShot(null)}
                className="text-[0.875rem] text-white/75 underline transition hover:text-white"
              >
                {t.wall.retake}
              </button>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}

/** The centred card the non-camera states share. */
function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-10 grid place-items-center p-6">
      <div className="w-full max-w-sm text-center">{children}</div>
    </div>
  );
}

/* ================================================================ geometry */

type Geometry = {
  /** Rendered width of the whole frame, in CSS pixels. */
  width: number;
  /** Pixels per real centimetre at the shopper's stated distance. */
  perCm: number;
};

/**
 * How large the piece has to be drawn for it to be life-size on that wall.
 *
 * The video is painted with `object-fit: cover`, so the sensor's full width is
 * usually wider than the screen. Working from the *scaled* video width rather
 * than the viewport is what keeps the scale right on a portrait phone showing a
 * landscape camera, where the crop throws away a third of the picture.
 */
function frameGeometry({
  viewport,
  source,
  distance,
  printSize,
  mount,
}: {
  viewport: { width: number; height: number };
  source: { width: number; height: number };
  distance: number;
  /** The chosen format's printed size, in centimetres. */
  printSize: FrameSize;
  /** Mount width, as a percentage — it is part of how wide the frame ends up. */
  mount: number;
}): Geometry {
  const cover =
    source.width > 0 && source.height > 0
      ? coverScale(viewport, source) * source.width
      : viewport.width;

  // Half the visible wall, twice: the width the camera takes in at that range.
  const visibleCm = 2 * distance * Math.tan((ASSUMED_FOV * Math.PI) / 360);
  const perCm = visibleCm > 0 ? cover / visibleCm : 0;

  return { perCm, width: perCm * printSize.width * framedWidthRatio(mount) };
}

/** The factor `object-fit: cover` scales the video by to fill the stage. */
function coverScale(
  viewport: { width: number; height: number },
  source: { width: number; height: number },
): number {
  return Math.max(viewport.width / source.width, viewport.height / source.height);
}

function clampPosition(x: number, y: number) {
  // A little overhang is allowed so a piece can sit against the edge of the
  // shot, but never so far that it cannot be dragged back.
  return { x: Math.min(1.1, Math.max(-0.1, x)), y: Math.min(1.1, Math.max(-0.1, y)) };
}

function clampDistance(value: number) {
  return Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, value));
}

/* ============================================================= photography */

/**
 * The camera frame and the piece, composed into one JPEG.
 *
 * Everything is drawn at the geometry already on screen, multiplied by the pixel
 * ratio: what the shopper framed is what they get, only sharper.
 */
async function composePhoto({
  video,
  art,
  viewport,
  source,
  finish,
  mount,
  caption,
}: {
  video: HTMLVideoElement;
  art: SVGSVGElement | HTMLImageElement;
  viewport: { width: number; height: number };
  source: { width: number; height: number };
  finish: FrameFinish;
  mount: number;
  caption: string;
}): Promise<Blob | null> {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width * ratio);
  canvas.height = Math.round(viewport.height * ratio);

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // The room, cropped exactly as `object-fit: cover` crops it.
  if (source.width > 0 && source.height > 0) {
    const scale = coverScale(viewport, source) * ratio;
    const width = source.width * scale;
    const height = source.height * scale;
    ctx.drawImage(video, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
  }

  // The piece, measured off the DOM rather than recomputed: whatever the shopper
  // has dragged it to is, by definition, where it belongs in the photograph.
  const rect = art.closest("[data-frame='moulding']")?.getBoundingClientRect();
  const stage = video.getBoundingClientRect();
  if (rect) {
    await drawFramedArt(ctx, {
      art,
      finish,
      mount,
      mouldingPct: MOULDING_PCT,
      x: (rect.left - stage.left) * ratio,
      y: (rect.top - stage.top) * ratio,
      width: rect.width * ratio,
      height: rect.height * ratio,
      unit: ratio,
    });
  }

  drawCaption(ctx, caption, canvas.width, canvas.height, ratio);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
}

/** A quiet line of credit along the bottom, for when the photo gets shared. */
function drawCaption(
  ctx: CanvasRenderingContext2D,
  caption: string,
  width: number,
  height: number,
  ratio: number,
) {
  ctx.save();
  ctx.font = `${Math.round(13 * ratio)}px system-ui, sans-serif`;
  ctx.textBaseline = "bottom";
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 6 * ratio;
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText(caption, 16 * ratio, height - 16 * ratio, width - 32 * ratio);
  ctx.restore();
}

function download(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
}

/* ============================================================== formatting */

function formatDistance(cm: number, locale: string): string {
  return `${new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(cm / 100)} m`;
}
