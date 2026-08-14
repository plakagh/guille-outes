import { ProductArt } from "@/components/brand/product-art";
import type {
  ArtOrientation,
  ArtPrint,
  ArtShape,
  Colorway,
} from "@/components/brand/product-art";
import { FramedArt } from "@/components/product/framed-art";
import {
  framedAspect,
  frameAspect,
  frameOrientation,
  type FrameChoice,
  type FrameShot,
  type Product,
  type ProductImage,
} from "@/lib/catalog";
import { mediaUrl } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";

/**
 * The photographs of a product, for one colourway.
 *
 * An image tagged with a colourway belongs to that colour of the garment and to
 * no other, so picking a swatch swaps the photograph. Untagged images belong to
 * the product as a whole and show under every colour — which is the normal case
 * for a framed print, where there is nothing to choose.
 */
export function photosFor(product: Product, colorwayId?: string): ProductImage[] {
  const tagged = product.images.filter((image) => image.colorwayId === colorwayId);
  if (tagged.length > 0) return tagged;

  const untagged = product.images.filter((image) => !image.colorwayId);
  return untagged.length > 0 ? untagged : [];
}

/**
 * The same choice, for a basket line — which carries a snapshot of the product
 * rather than the product itself.
 *
 * A line with a child's drawing on it is always drawn, never photographed: the
 * drawing composited onto the garment is what the workshop will actually make,
 * and a stock photograph of the plain shirt would misrepresent the order.
 *
 * A cuadro bought with a frame is shown in that frame, for the same reason: the
 * finish is part of what was ordered and part of what was paid for, so a bare
 * sheet of paper in the basket shows the shopper something they did not buy.
 */
export function LineShot({
  imageUrl,
  artworkUrl,
  shape,
  colorway,
  print,
  frame,
  frameFinish,
  alt,
}: {
  imageUrl?: string;
  artworkUrl?: string;
  shape: ArtShape;
  colorway: Colorway;
  print?: ArtPrint;
  /** The frame's measurements, snapshotted on the line when it was added. */
  frame?: FrameShot;
  /** What the shopper chose. `"none"`, or absent, hangs nothing. */
  frameFinish?: FrameChoice;
  alt?: string;
}) {
  const face = { imageUrl, artworkUrl, shape, colorway, print, alt };

  if (!frame || !frameFinish || frameFinish === "none") return <LineFace {...face} />;

  /*
    A basket thumbnail is a square and a frame is not, so the frame is given the
    shape it will actually have and then sized by whichever side runs out first —
    drawn at the square's full width, a portrait piece would hang a third of
    itself outside the box.
  */
  const aspect = framedAspect(frame.print, frame.mount);

  return (
    // Flex rather than grid: an auto-sized grid row takes its height from what
    // is in it, which leaves `h-full` below with nothing definite to be a
    // percentage of — and a frame that sizes itself by width again.
    <div className="flex h-full w-full items-center justify-center">
      <div className={aspect <= 1 ? "h-full" : "w-full"} style={{ aspectRatio: aspect }}>
        {/* No painted wall behind it: the thumbnail sits on the basket's own
            shading, and a second background inside the first reads as a border. */}
        <FramedArt
          finish={frameFinish}
          mount={frame.mount}
          onWall={false}
          className="h-full w-full"
        >
          <div style={{ aspectRatio: frameAspect(frame.print) }}>
            <LineFace {...face} bare orientation={frameOrientation(frame.print)} />
          </div>
        </FramedArt>
      </div>
    </div>
  );
}

/** What the line shows, framed or not: its photograph, or the drawn artwork. */
function LineFace({
  imageUrl,
  artworkUrl,
  shape,
  colorway,
  print,
  bare = false,
  orientation,
  alt,
}: {
  imageUrl?: string;
  artworkUrl?: string;
  shape: ArtShape;
  colorway: Colorway;
  print?: ArtPrint;
  bare?: boolean;
  orientation?: ArtOrientation;
  alt?: string;
}) {
  if (artworkUrl || !imageUrl) {
    return (
      <ProductArt
        shape={shape}
        colorway={colorway}
        print={print}
        artworkUrl={artworkUrl}
        bare={bare}
        orientation={orientation}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt={alt ?? ""}
      loading="lazy"
      // Behind glass the aperture is filled, exactly as on the product page: a
      // white band between the paper and the bevel reads as a printing fault.
      className={cn("h-full w-full", bare ? "object-cover" : "object-contain")}
    />
  );
}

/**
 * What a product looks like: its photograph if it has one, otherwise the drawn
 * artwork.
 *
 * The shop was built to draw every product as vector art, which is what lets a
 * new colourway appear without a photo shoot. That stops being the right answer
 * the moment the product *is* a photograph — an original painting sold as a
 * framed print cannot be represented by a generated poster. So a real image
 * wins wherever there is one, and the drawing stays as the fallback for products
 * nobody has photographed yet.
 *
 * A drop-in for `ProductArt`: same props, same box, so every caller keeps the
 * framing, zoom and wall-view behaviour it already had.
 */
export function ProductShot({
  product,
  colorway,
  print,
  orientation = "portrait",
  bare = false,
  photo,
  crossOrigin,
  className,
}: {
  product: Product;
  colorway: Colorway;
  print?: ArtPrint;
  orientation?: ArtOrientation;
  bare?: boolean;
  /** A specific photograph — the gallery passes the one its thumbnail selected. */
  photo?: ProductImage | null;
  /**
   * Set where the rendered node is later drawn into a `<canvas>` — the wall
   * view's capture. The bucket is a different origin from the site, and a
   * tainted canvas makes `toBlob` throw, losing the whole photograph.
   */
  crossOrigin?: "anonymous";
  className?: string;
}) {
  const image = photo ?? photosFor(product, colorway.id)[0];

  if (!image) {
    return (
      <ProductArt
        shape={product.shape}
        colorway={colorway}
        print={print ?? product.print}
        bare={bare}
        orientation={orientation}
        className={className}
      />
    );
  }

  /*
    A plain <img> rather than next/image: `prepare-media.mjs` already resized
    every file to fit 1600 px and encoded it as webp, so the optimiser would
    re-encode 119 artworks on demand to arrive at what is already on disk.
  */
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={mediaUrl(image.path)}
      alt={image.alt ?? product.name}
      crossOrigin={crossOrigin}
      loading="lazy"
      decoding="async"
      /*
        Loose, the scan keeps its own proportions — cropping a painting to fit a
        box is not ours to do.

        Behind glass it is the other way round. `bare` means the artwork is
        sitting in a mount cut to a printed format, and no scan matches 40 × 30
        or 70 × 50 to the millimetre: contain would leave a white band between
        the paper and the bevel, which reads as a printing fault rather than as
        a mount. A print is trimmed to its paper, so the aperture is filled and
        the millimetre over the edge is lost — exactly what the framer does.
      */
      className={cn("h-full w-full", bare ? "object-cover" : "object-contain", className)}
    />
  );
}
