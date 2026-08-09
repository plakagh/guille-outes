import { FRAME_PAINT } from "@/components/product/framed-art";
import type { FrameFinish } from "@/lib/catalog";

/**
 * The framed piece, repainted into a `<canvas>`.
 *
 * The wall view hangs the picture with CSS; a photograph of that wall has to be
 * composed in a canvas, and a canvas cannot read a gradient off a DOM node. So
 * the moulding, the mount and the bevel are drawn a second time here — from
 * {@link FRAME_PAINT}, the same table the CSS paints from, so the two cannot
 * drift apart into a preview that does not match its own photograph.
 *
 * The artwork itself is not redrawn: it is the live node — a photograph, or the
 * drawing serialised and rasterised — so whatever the shopper is looking at is
 * what lands in the file.
 */
export async function drawFramedArt(
  ctx: CanvasRenderingContext2D,
  {
    art: artNode,
    finish,
    mount,
    mouldingPct,
    x,
    y,
    width,
    height,
    unit = 1,
  }: {
    /**
     * The live artwork, taken off the page rather than re-drawn: a photograph is
     * already a bitmap and is drawn straight in, a drawing is serialised first.
     */
    art: SVGSVGElement | HTMLImageElement;
    finish: FrameFinish;
    /** Mount width, as a percentage of what the moulding leaves. */
    mount: number;
    /** Moulding width, as a percentage of the frame. */
    mouldingPct: number;
    /** The moulding's box, in canvas pixels. */
    x: number;
    y: number;
    width: number;
    height: number;
    /** Canvas pixels per CSS pixel, for hairlines and grain. */
    unit?: number;
  },
): Promise<void> {
  const style = FRAME_PAINT[finish] ?? FRAME_PAINT.black;

  // The same nesting as the DOM: each padding is a share of the box it sits in.
  const moulding = (mouldingPct / 100) * width;
  const mountBox = {
    x: x + moulding,
    y: y + moulding,
    width: width - 2 * moulding,
    height: height - 2 * moulding,
  };
  const board = (mount / 100) * mountBox.width;
  const art = {
    x: mountBox.x + board,
    y: mountBox.y + board,
    width: mountBox.width - 2 * board,
    height: mountBox.height - 2 * board,
  };

  /* --------------------------------------------- the frame hangs on a wall */
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 28 * unit;
  ctx.shadowOffsetY = 14 * unit;
  ctx.fillStyle = "#000";
  ctx.fillRect(x, y, width, height);
  ctx.restore();

  /* ------------------------------------------------------------- moulding */
  const face = ctx.createLinearGradient(x, y, x + width, y + height);
  for (const [at, color] of style.stops) face.addColorStop(at / 100, color);
  ctx.fillStyle = face;
  ctx.fillRect(x, y, width, height);

  if (style.grain) {
    // 2 on, 7 off — the repeating gradient's period, without its 2° tilt, which
    // is not legible at any size this gets printed at.
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
    ctx.fillStyle = style.grain[0];
    for (let at = 0; at < width; at += 9 * unit) {
      ctx.fillRect(x + at, y, 2 * unit, height);
    }
    ctx.restore();
  }

  // The two edges that make it read as an object: a dark line inside, a light
  // one outside, and a highlight down the top-left where the light would fall.
  ctx.save();
  ctx.lineWidth = unit;
  ctx.strokeStyle = style.inner;
  ctx.strokeRect(x + unit / 2, y + unit / 2, width - unit, height - unit);
  ctx.strokeStyle = style.outer;
  ctx.strokeRect(x - unit / 2, y - unit / 2, width + unit, height + unit);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(x, y, width, 2 * unit);
  ctx.fillRect(x, y, 2 * unit, height);
  ctx.restore();

  /* ----------------------------------------------------------- the mount */
  const mountFace = ctx.createLinearGradient(
    mountBox.x,
    mountBox.y,
    mountBox.x + mountBox.width * 0.34,
    mountBox.y + mountBox.height,
  );
  mountFace.addColorStop(0, "#fdfdfc");
  mountFace.addColorStop(1, "#f4f2ee");
  ctx.fillStyle = mountFace;
  ctx.fillRect(mountBox.x, mountBox.y, mountBox.width, mountBox.height);

  /* ------------------------------------------------ the bevel and the art */
  // Three rings outside the aperture, drawn outermost first: the faint outer
  // edge, the white cut, then the dark line the paper sits behind.
  ring(ctx, art, 4 * unit, "rgba(0,0,0,0.07)");
  ring(ctx, art, 3 * unit, "#ffffff");
  ring(ctx, art, unit, "rgba(0,0,0,0.18)");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(art.x, art.y, art.width, art.height);

  const raster = await rasterize(artNode, art.width, art.height);
  if (raster) {
    // `cover` and clipped, matching the CSS on the page: the aperture is a cut
    // in a board, so the artwork fills it and the overhang is trimmed at the
    // bevel. A drawing is serialised at the aperture's exact size and neither
    // scales nor spills; a photograph has its own proportions, and leaving the
    // difference as a white band would read as a printing fault.
    const box = coverBox(art, raster.image);
    ctx.save();
    ctx.beginPath();
    ctx.rect(art.x, art.y, art.width, art.height);
    ctx.clip();
    ctx.drawImage(raster.image, box.x, box.y, box.width, box.height);
    ctx.restore();
    raster.release();
  }

  /* ---------------------------------------------------------------- glass */
  const glass = ctx.createLinearGradient(art.x, art.y, art.x + art.width, art.y + art.height * 0.5);
  glass.addColorStop(0, "rgba(255,255,255,0.28)");
  glass.addColorStop(0.32, "rgba(255,255,255,0.06)");
  glass.addColorStop(0.52, "rgba(255,255,255,0)");
  ctx.fillStyle = glass;
  ctx.fillRect(art.x, art.y, art.width, art.height);
}

type Box = { x: number; y: number; width: number; height: number };

/** The smallest centred box covering `outer` with the image's own aspect ratio. */
function coverBox(outer: Box, image: HTMLImageElement): Box {
  const w = image.naturalWidth;
  const h = image.naturalHeight;
  if (!w || !h) return outer;

  const scale = Math.max(outer.width / w, outer.height / h);
  const width = w * scale;
  const height = h * scale;
  return {
    x: outer.x + (outer.width - width) / 2,
    y: outer.y + (outer.height - height) / 2,
    width,
    height,
  };
}

/** A solid band of `spread` around a box — a box-shadow spread, filled. */
function ring(ctx: CanvasRenderingContext2D, box: Box, spread: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(
    box.x - spread,
    box.y - spread,
    box.width + 2 * spread,
    box.height + 2 * spread,
  );
}

/**
 * The live artwork as a bitmap.
 *
 * Taking the node off the page rather than re-rendering it means the print, the
 * colourway and any future change come along for free.
 *
 * A photograph needs none of this — it is already a bitmap, so it is handed back
 * as-is. It does have to be CORS-clean: the bucket is a different origin from
 * the site, and drawing a tainted image would make `toBlob` throw and lose the
 * whole photograph rather than just the artwork.
 */
async function rasterize(
  node: SVGSVGElement | HTMLImageElement,
  width: number,
  height: number,
): Promise<{ image: HTMLImageElement; release: () => void } | null> {
  if (node instanceof HTMLImageElement) {
    if (!node.complete) {
      try {
        await node.decode();
      } catch {
        return null;
      }
    }
    return { image: node, release: () => {} };
  }

  const clone = node.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(Math.max(1, Math.round(width))));
  clone.setAttribute("height", String(Math.max(1, Math.round(height))));
  // Tailwind classes mean nothing outside the document, and a stray `class`
  // attribute on a detached SVG is just noise in the serialised markup.
  clone.removeAttribute("class");

  const markup = new XMLSerializer()
    .serializeToString(clone)
    // Custom properties do not resolve in a detached document, and an unresolved
    // `var()` in a font-family silently drops the text.
    .replace(/var\(--font-display\)/g, "system-ui, sans-serif");

  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }));
  const image = new Image();
  image.src = url;

  try {
    await image.decode();
    return { image, release: () => URL.revokeObjectURL(url) };
  } catch {
    // A frame without its artwork is still a recognisable photograph; a failed
    // capture is not. Give up on the drawing rather than on the picture.
    URL.revokeObjectURL(url);
    return null;
  }
}
