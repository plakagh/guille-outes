"use client";

import { useState, useTransition } from "react";
import { ProductArt } from "@/components/brand/product-art";
import { CheckIcon, CloseIcon, PlusIcon } from "@/components/icons";
import { FramedArt, FrameSwatch } from "@/components/product/framed-art";
import { Swatch } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  addCredit,
  addVariant,
  deleteProductImage,
  deleteVariant,
  removeCredit,
  saveFramePreview,
  saveProduct,
  saveSizeGuide,
  setStock,
  uploadProductImage,
  type ActionResult,
} from "@/lib/admin/actions";
import {
  allSizes,
  baselineSizeGuide,
  compareSizes,
  DEFAULT_FRAME_PREVIEW,
  frameAspect,
  frameOrientation,
  frameSizeFor,
  FRAME_FINISHES,
  FRAME_MAX_CM,
  FRAME_MIN_CM,
  palette,
  PRODUCT_IMAGE_MAX_BYTES,
  SIZE_DIMENSIONS,
  type Author,
  type Category,
  type Collection,
  type FrameFinish,
  type FramePreview,
  type Product,
  type SizeDimension,
} from "@/lib/catalog";
import { LOCALE_META, LOCALES, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { mediaUrl } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";

const SHAPES = [
  "tee",
  "hoodie",
  "jersey",
  "jacket",
  "shorts",
  "cap",
  "beanie",
  "tote",
  "ball",
  "bottle",
  "poster",
] as const;

const PRINTS = ["wordmark", "monogram", "number", "none"] as const;
const AUDIENCES = ["unisex", "hombre", "mujer", "ninos"] as const;

/** Per-locale bundles are not exposed by the flattened Product, so the editor
 * receives them separately, straight from the row. */
export type ProductDraft = {
  id: string | null;
  ref: string;
  slug: Record<Locale, string>;
  name: Record<Locale, string>;
  description: Record<Locale, string>;
  keywords: Record<Locale, string[]>;
  details: Record<Locale, string[]>;
  categoryId: string;
  collectionId: string | null;
  audience: string;
  shape: string;
  print: string;
  priceCents: number;
  compareAtCents: number | null;
  colorways: string[];
  /** Blank when the product has no video, which is the normal case. */
  videoUrl: string;
  videoCaption: Record<Locale, string>;
  artworkPrintable: boolean;
  published: boolean;
  arrived: number;
};

export function ProductEditor({
  draft,
  product,
  categories,
  collections,
  authors,
  locale,
  t,
  onSavedHref,
}: {
  draft: ProductDraft;
  /** Present when editing; absent for a brand-new product. */
  product: Product | null;
  categories: Category[];
  collections: Collection[];
  authors: Author[];
  locale: Locale;
  t: Dictionary;
  onSavedHref: string;
}) {
  const [tab, setTab] = useState<Locale>("es");
  const [colors, setColors] = useState<string[]>(draft.colorways);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const swatches = palette(locale);
  // A cuadro wider than it is tall is drawn landscape, here as on the storefront.
  const orientation = product?.framePreview
    ? frameOrientation(product.framePreview)
    : "portrait";

  const run = async (action: (form: FormData) => Promise<ActionResult>, form: FormData) => {
    setStatus("saving");
    try {
      const result = await action(form);
      if (result.ok) {
        setStatus("saved");
        setMessage(null);
      } else {
        setStatus("error");
        setMessage(result.error);
      }
    } catch (cause) {
      /*
        An action that rejects instead of answering — a request body the
        framework refused, a server that went away mid-save — reaches the router
        with nothing to catch it, and Next replaces the entire editor with its
        own error page. Every unsaved field in a long form goes with it. Failing
        into the status line keeps the work on screen and says what happened.
      */
      setStatus("error");
      setMessage(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <div className="shell space-y-8 py-8">
      {/* ------------------------------------------------------- main form */}
      <form
        action={async (form) => {
          for (const color of colors) form.append("colorways", color);
          await run(saveProduct, form);
        }}
        className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]"
      >
        {draft.id && <input type="hidden" name="id" value={draft.id} />}

        <div className="space-y-6 border border-line bg-white p-6">
          {/* Locale tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-line pb-4">
            <span className="eyebrow mr-2 text-mute">{t.admin.localeTab}</span>
            {LOCALES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setTab(option)}
                aria-pressed={option === tab}
                className={cn(
                  "h-9 border px-3 text-[0.8125rem] font-semibold transition",
                  option === tab ? "border-ink bg-ink text-white" : "border-line hover:border-ink",
                )}
              >
                {LOCALE_META[option].endonym}
                {option === "es" && <span className="text-flame"> *</span>}
              </button>
            ))}
            <p className="w-full pt-2 text-[0.75rem] text-mute">{t.admin.requiredEs}</p>
          </div>

          {/* All locales stay mounted so one submit carries every translation. */}
          {LOCALES.map((option) => (
            <div key={option} className={option === tab ? "space-y-4" : "hidden"}>
              <Field
                label={`${t.admin.name} (${LOCALE_META[option].endonym})`}
                name={`name_${option}`}
                defaultValue={draft.name[option]}
                required={option === "es"}
              />
              <Field
                label={`${t.admin.slug} (${LOCALE_META[option].endonym})`}
                name={`slug_${option}`}
                defaultValue={draft.slug[option]}
                hint={t.admin.slugHint}
              />
              <Field
                as="textarea"
                label={`${t.admin.description} (${LOCALE_META[option].endonym})`}
                name={`description_${option}`}
                defaultValue={draft.description[option]}
                required={option === "es"}
              />
              <Field
                as="textarea"
                label={`${t.admin.keywords} (${LOCALE_META[option].endonym})`}
                name={`keywords_${option}`}
                defaultValue={draft.keywords[option]?.join(", ") ?? ""}
                hint={t.admin.keywordsHint}
              />
              <Field
                as="textarea"
                label={`${t.pdp.detailsHeading} (${LOCALE_META[option].endonym})`}
                name={`details_${option}`}
                defaultValue={draft.details[option]?.join(", ") ?? ""}
                hint={t.admin.keywordsHint}
              />
            </div>
          ))}

          {/*
            The video. Part of the main form because both halves are plain columns
            on the product — and because a brand-new product should be able to
            arrive with its video already on it, which the sections below (they
            need a saved row) cannot do.
          */}
          <div className="space-y-4 border-t border-line pt-5">
            <div>
              <h2 className="text-xl">{t.admin.video.title}</h2>
              <p className="mt-1 max-w-2xl text-[0.875rem] text-mute">{t.admin.video.blurb}</p>
            </div>

            <Field
              label={t.admin.video.url}
              name="video_url"
              type="url"
              defaultValue={draft.videoUrl}
              hint={t.admin.video.urlHint}
            />

            {/* Follows the locale tabs above, and every language stays mounted so
                one submit carries all three. */}
            {LOCALES.map((option) => (
              <div key={option} className={option === tab ? "block" : "hidden"}>
                <Field
                  as="textarea"
                  label={`${t.admin.video.caption} (${LOCALE_META[option].endonym})`}
                  name={`video_caption_${option}`}
                  defaultValue={draft.videoCaption[option]}
                  hint={t.admin.video.captionHint}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar: commerce fields */}
        <aside className="space-y-4 border border-line bg-white p-6">
          {!draft.id && (
            <Field label={t.pdp.ref} name="ref" defaultValue={draft.ref} required />
          )}

          <Field
            label={t.admin.price}
            name="price"
            type="number"
            step="0.01"
            defaultValue={(draft.priceCents / 100).toFixed(2)}
            required
          />
          <Field
            label={t.admin.compareAt}
            name="compare_at"
            type="number"
            step="0.01"
            defaultValue={
              draft.compareAtCents === null ? "" : (draft.compareAtCents / 100).toFixed(2)
            }
          />

          <Select label={t.admin.category} name="category_id" defaultValue={draft.categoryId}>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>

          <Select
            label={t.admin.collection}
            name="collection_id"
            defaultValue={draft.collectionId ?? ""}
          >
            <option value="">—</option>
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name}
              </option>
            ))}
          </Select>

          <Select label={t.admin.audience} name="audience" defaultValue={draft.audience}>
            {AUDIENCES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>

          <Select label={t.admin.shape} name="shape" defaultValue={draft.shape}>
            {SHAPES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>

          <Select label={t.admin.print} name="print" defaultValue={draft.print}>
            {PRINTS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>

          <Field
            label={t.plp.newTitle}
            name="arrived"
            type="number"
            defaultValue={String(draft.arrived)}
            hint="0–100"
          />

          {/* Colourways */}
          <div>
            <p className="eyebrow mb-2 text-mute">{t.admin.colorways}</p>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-2">
              {swatches.map((swatch) => {
                const active = colors.includes(swatch.id);
                return (
                  <li key={swatch.id}>
                    <button
                      type="button"
                      title={swatch.name}
                      aria-pressed={active}
                      onClick={() =>
                        setColors((current) =>
                          active
                            ? current.filter((id) => id !== swatch.id)
                            : [...current, swatch.id],
                        )
                      }
                      className={cn(
                        "relative grid size-10 place-items-center border transition",
                        active ? "border-ink" : "border-line hover:border-ink",
                      )}
                    >
                      <Swatch base={swatch.base} trim={swatch.trim} className="size-6" />
                      {active && (
                        <CheckIcon className="absolute size-4 text-white mix-blend-difference" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/*
            Whether a drawing from the children's gallery can be printed on this
            product. Off for everything by default: the print area, the process
            and the price are not the same on a cap as on a tee, so this is a
            decision per product rather than a shop-wide switch — and with none
            ticked, an artwork page simply has no "put it on a t-shirt" section.
          */}
          <label className="flex items-start gap-2.5 pt-2 text-[0.875rem]">
            <input
              type="checkbox"
              name="artwork_printable"
              defaultChecked={draft.artworkPrintable}
              className="mt-0.5 size-4 accent-black"
            />
            <span>
              {t.admin.artworkPrintable}
              <span className="block text-[0.8125rem] font-normal text-mute">
                {t.admin.artworkPrintableHint}
              </span>
            </span>
          </label>

          <label className="flex items-center gap-2.5 pt-2 text-[0.875rem]">
            <input
              type="checkbox"
              name="published"
              defaultChecked={draft.published}
              className="size-4 accent-black"
            />
            {t.admin.published}
          </label>

          <Button type="submit" block size="lg" disabled={status === "saving"}>
            {status === "saving" ? t.admin.saving : t.admin.save}
          </Button>

          {status === "saved" && (
            <p className="text-[0.8125rem] font-semibold text-pine">{t.admin.saved}</p>
          )}
          {status === "error" && (
            <p role="alert" className="text-[0.8125rem] font-semibold text-flame">
              {t.admin.error}
              {message && <span className="block font-normal text-mute">{message}</span>}
            </p>
          )}

          {/* Live preview of the generated artwork */}
          {colors[0] && (
            <div className="mt-4 aspect-[5/6] bg-shell">
              <ProductArt
                shape={draft.shape as (typeof SHAPES)[number]}
                colorway={swatches.find((s) => s.id === colors[0]) ?? swatches[0]}
                print={draft.print as (typeof PRINTS)[number]}
                orientation={orientation}
              />
            </div>
          )}
        </aside>
      </form>

      {product && (
        <>
          <FrameEditor product={product} t={t} run={run} />
          <SizeGuideEditor product={product} t={t} run={run} />
          <StockGrid product={product} t={t} locale={locale} run={run} />
          <CreditsEditor product={product} authors={authors} t={t} run={run} />
          <ImageManager product={product} t={t} run={run} />
        </>
      )}

      <p className="text-[0.8125rem] text-mute">
        <a href={onSavedHref} className="underline">
          {t.admin.backToList}
        </a>
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ stock grid */

type Runner = (
  action: (form: FormData) => Promise<ActionResult>,
  form: FormData,
) => Promise<void>;

/**
 * Measurements for this product's own sizes.
 *
 * The columns are the measurements that make sense for this garment; the rows are
 * the sizes it is actually sold in. Untouched, the grid is pre-filled from the
 * baseline for the shape, so the numbers only need correcting rather than typing
 * from nothing — but nothing is stored until it is saved, and the storefront
 * keeps using the baseline in the meantime.
 */
/**
 * Framing preview for a cuadro.
 *
 * Off by default and off for most products: a t-shirt in a frame is a joke. When
 * it is on, the finishes offered are the shop's choice per piece — a numbered
 * serigraph may only be sold in black — and the first one is what the preview
 * opens with.
 */
function FrameEditor({
  product,
  t,
  run,
}: {
  product: Product;
  t: Dictionary;
  run: Runner;
}) {
  const stored = product.framePreview;
  const [enabled, setEnabled] = useState(stored !== null);
  const [finishes, setFinishes] = useState<FrameFinish[]>(
    stored?.finishes ?? [...FRAME_FINISHES],
  );

  /*
    One row per format the piece is sold in, in the order the shop shows them.

    A cuadro is two products in one listing — a 30 × 40 and a 50 × 70 at two
    prices — and the camera view hangs whichever one the shopper picked. So the
    measurements are per size here, not per product. A product with no sizes at
    all still gets a row, keyed by `""`: it is what the frame falls back to.

    Held as typed rather than as numbers: a half-deleted field is a valid thing to
    be looking at, and `Number("")` is 0, which would flip the preview on its side
    mid-keystroke.
  */
  const formats = [...product.sizes].sort(compareSizes);
  const rows = formats.length > 0 ? formats : [""];

  /*
    Only what has been typed is held, not a row per format: adding a size in the
    stock table below re-renders this form with one more format, and a state
    object built once at mount would leave that row blank — a blank measurement
    saved as the storefront default is a wrong size nobody was shown.
  */
  const [typed, setTyped] = useState<Record<string, { width: string; height: string }>>({});

  /** A row as it appears in the fields: what was typed, or what is stored. */
  const shown = (format: string) => {
    const edited = typed[format];
    if (edited) return edited;
    const measured = frameSizeFor(stored ?? DEFAULT_FRAME_PREVIEW, format || null);
    return { width: String(measured.width), height: String(measured.height) };
  };

  const set = (format: string, key: "width" | "height", value: string) =>
    setTyped((current) => ({ ...current, [format]: { ...shown(format), [key]: value } }));

  /** A row as numbers, falling back while what is typed is unusable. */
  const measurements = (format: string) => {
    const row = shown(format);
    return {
      width: cmOr(row.width, DEFAULT_FRAME_PREVIEW.width),
      height: cmOr(row.height, DEFAULT_FRAME_PREVIEW.height),
    };
  };

  /**
   * What the preview draws: the first format, which is the one a listing card and
   * an unchosen product page show.
   */
  const preview: FramePreview = {
    finishes,
    mount: stored?.mount ?? DEFAULT_FRAME_PREVIEW.mount,
    surcharge: stored?.surcharge ?? DEFAULT_FRAME_PREVIEW.surcharge,
    sizes: {},
    ...measurements(rows[0]),
  };

  const toggle = (finish: FrameFinish) =>
    setFinishes((current) =>
      current.includes(finish)
        ? current.filter((item) => item !== finish)
        : // Keep the canonical order so the default finish is predictable.
          FRAME_FINISHES.filter((item) => item === finish || current.includes(item)),
    );

  return (
    <section className="border border-line bg-white p-6">
      <h2 className="mb-1 text-2xl">{t.admin.frame.title}</h2>
      <p className="mb-4 max-w-2xl text-[0.875rem] text-mute">{t.admin.frame.blurb}</p>

      <form
        action={async (form) => {
          for (const finish of finishes) form.append("finishes", finish);
          await run(saveFramePreview, form);
        }}
        className="space-y-5"
      >
        <input type="hidden" name="id" value={product.id} />

        <label className="flex cursor-pointer items-center gap-2 text-[0.9375rem]">
          <input
            type="checkbox"
            name="frame_enabled"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            className="size-4 accent-black"
          />
          {t.admin.frame.enable}
        </label>

        {enabled && (
          <>
            <fieldset>
              <legend className="eyebrow mb-2 text-mute">{t.admin.frame.finishes}</legend>
              <ul className="flex flex-wrap gap-2">
                {FRAME_FINISHES.map((finish) => {
                  const active = finishes.includes(finish);
                  return (
                    <li key={finish}>
                      <button
                        type="button"
                        onClick={() => toggle(finish)}
                        aria-pressed={active}
                        className={cn(
                          "inline-flex items-center gap-2 border px-3 py-2 text-[0.8125rem] transition",
                          active ? "border-ink bg-shell" : "border-line hover:border-ink",
                        )}
                      >
                        <FrameSwatch finish={finish} />
                        {t.pdp.frameFinishes[finish]}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {finishes.length === 0 && (
                <p className="mt-2 border-l-2 border-gold bg-shell p-3 text-[0.8125rem]">
                  {t.admin.frame.noFinishes}
                </p>
              )}
            </fieldset>

            <label className="block max-w-xs">
              <span className="eyebrow mb-1.5 block text-mute">{t.admin.frame.mount}</span>
              <span className="flex h-11 items-center border border-line focus-within:border-ink">
                <input
                  name="mount"
                  type="number"
                  min={0}
                  max={30}
                  step={1}
                  defaultValue={stored?.mount ?? 10}
                  className="h-full min-w-0 flex-1 px-3 text-right text-[0.9375rem] outline-none"
                />
                <span className="px-3 text-[0.875rem] text-mute">%</span>
              </span>
              <span className="mt-1 block text-[0.75rem] text-mute">
                {t.admin.frame.mountHint}
              </span>
            </label>

            {/*
              What the frame costs. Not decoration: this is the difference the
              shopper pays for choosing an acabado over "sin marco", and the
              server adds it to every line that asks for one.
            */}
            <label className="block max-w-xs">
              <span className="eyebrow mb-1.5 block text-mute">{t.admin.frame.surcharge}</span>
              <span className="flex h-11 items-center border border-line focus-within:border-ink">
                <input
                  name="frame_surcharge"
                  type="text"
                  inputMode="decimal"
                  defaultValue={((stored?.surcharge ?? 0) / 100).toFixed(2)}
                  className="h-full min-w-0 flex-1 px-3 text-right text-[0.9375rem] outline-none"
                />
                <span className="px-3 text-[0.875rem] text-mute">€</span>
              </span>
              <span className="mt-1 block text-[0.75rem] text-mute">
                {t.admin.frame.surchargeHint}
              </span>
            </label>

            {/*
              The printed size, per format. Everything else on this form is
              presentation; these numbers are a fact about the object, and the
              camera view scales the piece on someone's wall by them.
            */}
            <fieldset className="max-w-lg">
              <legend className="eyebrow mb-1.5 text-mute">{t.admin.frame.size}</legend>
              <ul className="space-y-2">
                {rows.map((format) => {
                  const row = measurements(format);
                  return (
                    <li key={format} className="flex flex-wrap items-center gap-3">
                      {/* The size the row belongs to travels with the values, so
                          the action never has to guess which is which. */}
                      {format && <input type="hidden" name="frame_format" value={format} />}
                      <span className="w-24 shrink-0 text-[0.875rem] font-semibold">
                        {format || t.admin.frame.defaultSize}
                      </span>
                      {(
                        [
                          ["width", t.pdp.sizeDimensions.width],
                          ["height", t.admin.frame.height],
                        ] as const
                      ).map(([key, label]) => (
                        <label key={key} className="min-w-28 flex-1">
                          <span className="sr-only">
                            {format ? `${format} · ${label}` : label}
                          </span>
                          <span className="flex h-11 items-center border border-line focus-within:border-ink">
                            {/* Controlled, so the preview below turns as it is
                                typed: checking the orientation is most of why it
                                is there. */}
                            <input
                              name={format ? `frame_${key}_${format}` : `frame_${key}`}
                              type="number"
                              min={FRAME_MIN_CM}
                              max={FRAME_MAX_CM}
                              step={0.5}
                              value={shown(format)[key]}
                              onChange={(event) => set(format, key, event.target.value)}
                              aria-label={format ? `${format} · ${label}` : label}
                              className="h-full min-w-0 flex-1 px-3 text-right text-[0.9375rem] outline-none"
                            />
                            <span className="px-3 text-[0.875rem] text-mute">cm</span>
                          </span>
                        </label>
                      ))}
                      <span className="w-28 shrink-0 text-[0.75rem] text-mute">
                        {t.admin.frame[row.width > row.height ? "landscape" : "portrait"]}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <span className="mt-1.5 block text-[0.75rem] text-mute">
                {t.admin.frame.sizeHint}
              </span>
            </fieldset>

            {/* What the shopper will see, with the same component the PDP uses. */}
            <div className="max-w-[16rem]">
              <p className="eyebrow mb-2 text-mute">{t.admin.frame.preview}</p>
              <FramedArt
                finish={finishes[0] ?? "black"}
                mount={preview.mount}
                className="aspect-[5/6]"
              >
                <div style={{ aspectRatio: frameAspect(preview) }}>
                  <ProductArt
                    shape={product.shape}
                    colorway={product.colorways[0]}
                    print={product.print}
                    bare
                    orientation={frameOrientation(preview)}
                  />
                </div>
              </FramedArt>
            </div>
          </>
        )}

        <Button type="submit" variant="outline" size="sm">
          {t.admin.save}
        </Button>
      </form>
    </section>
  );
}

function SizeGuideEditor({
  product,
  t,
  run,
}: {
  product: Product;
  t: Dictionary;
  run: Runner;
}) {
  const stored = product.sizeGuide;
  const baseline = baselineSizeGuide(product.shape, product.sizes);
  const guide = stored ?? baseline;

  const [dimensions, setDimensions] = useState<SizeDimension[]>(guide.dimensions);
  const sizes = [...product.sizes].sort(compareSizes);

  const toggle = (dimension: SizeDimension) =>
    setDimensions((current) =>
      current.includes(dimension)
        ? current.filter((item) => item !== dimension)
        : // Keep the canonical order regardless of the order they were ticked.
          SIZE_DIMENSIONS.filter((item) => item === dimension || current.includes(item)),
    );

  return (
    <section className="border border-line bg-white p-6">
      <h2 className="mb-1 text-2xl">{t.admin.sizeGuide}</h2>
      <p className="mb-4 max-w-2xl text-[0.875rem] text-mute">
        {stored ? t.admin.sizeGuideOwn : t.admin.sizeGuideBaseline}
      </p>

      <form
        action={async (form) => {
          for (const dimension of dimensions) form.append("dimensions", dimension);
          await run(saveSizeGuide, form);
        }}
      >
        <input type="hidden" name="id" value={product.id} />

        <fieldset className="mb-5">
          <legend className="eyebrow mb-2">{t.admin.sizeGuideDimensions}</legend>
          <ul className="flex flex-wrap gap-2">
            {SIZE_DIMENSIONS.map((dimension) => {
              const active = dimensions.includes(dimension);
              return (
                <li key={dimension}>
                  <button
                    type="button"
                    onClick={() => toggle(dimension)}
                    aria-pressed={active}
                    className={cn(
                      "border px-3 py-1.5 text-[0.8125rem] transition",
                      active ? "border-ink bg-ink text-white" : "border-line hover:border-ink",
                    )}
                  >
                    {t.pdp.sizeDimensions[dimension]}
                  </button>
                </li>
              );
            })}
          </ul>
        </fieldset>

        {dimensions.length === 0 ? (
          <p className="border-l-2 border-gold bg-shell p-4 text-[0.875rem]">
            {t.admin.sizeGuideNone}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] text-[0.875rem]">
              <thead className="border-b border-line bg-shell">
                <tr>
                  <th className="p-2.5 text-left font-display uppercase">{t.admin.size}</th>
                  {dimensions.map((dimension) => (
                    <th key={dimension} className="p-2.5 text-left font-display uppercase">
                      {t.pdp.sizeDimensions[dimension]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sizes.map((size) => (
                  <tr key={size} className="border-b border-line-soft">
                    <td className="p-2.5 font-semibold">{size}</td>
                    {dimensions.map((dimension) => (
                      <td key={dimension} className="p-2.5">
                        <input
                          name={`m_${size}_${dimension}`}
                          type="number"
                          step="0.5"
                          min="0"
                          max="400"
                          defaultValue={
                            guide.measurements[size]?.[dimension] ??
                            baseline.measurements[size]?.[dimension] ??
                            ""
                          }
                          aria-label={`${t.pdp.sizeDimensions[dimension]} ${size}`}
                          className="h-9 w-20 border border-line px-2 text-right outline-none focus:border-ink"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <Button type="submit" variant="outline" size="sm">
            {t.admin.save}
          </Button>
          <p className="text-[0.75rem] text-mute">{t.admin.sizeGuideUnits}</p>
        </div>
      </form>
    </section>
  );
}

function StockGrid({
  product,
  t,
  locale,
  run,
}: {
  product: Product;
  t: Dictionary;
  locale: Locale;
  run: Runner;
}) {
  const [pending, start] = useTransition();
  const swatches = palette(locale);

  return (
    <section className="border border-line bg-white p-6">
      <h2 className="mb-4 text-2xl">{t.admin.variants}</h2>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-[0.875rem]">
          <thead className="border-b border-line bg-shell">
            <tr>
              <th className="p-2.5 text-left font-display uppercase">{t.common.color}</th>
              <th className="p-2.5 text-left font-display uppercase">{t.admin.size}</th>
              <th className="p-2.5 text-left font-display uppercase">{t.admin.sku}</th>
              <th className="p-2.5 text-right font-display uppercase">{t.admin.units}</th>
              <th className="p-2.5" />
            </tr>
          </thead>
          <tbody>
            {product.variants.map((variant) => {
              const swatch = swatches.find((s) => s.id === variant.colorwayId);
              return (
                <tr key={variant.id} className="border-b border-line-soft">
                  <td className="p-2.5">
                    <span className="flex items-center gap-2">
                      {swatch && <Swatch base={swatch.base} trim={swatch.trim} />}
                      {swatch?.name ?? variant.colorwayId}
                    </span>
                  </td>
                  <td className="p-2.5 font-semibold">{variant.size}</td>
                  <td className="p-2.5 text-mute">{variant.sku ?? "—"}</td>
                  <td className="p-2.5">
                    <form
                      action={async (form) => {
                        form.set("variant_id", variant.id);
                        await run(setStock, form);
                      }}
                      className="flex items-center justify-end gap-2"
                    >
                      <input
                        name="stock"
                        type="number"
                        min={0}
                        defaultValue={variant.stock}
                        aria-label={`${t.admin.units} ${variant.size}`}
                        className={cn(
                          "h-9 w-20 border px-2 text-right text-[0.875rem] outline-none focus:border-ink",
                          variant.stock === 0 ? "border-flame text-flame" : "border-line",
                        )}
                      />
                      <Button type="submit" variant="outline" size="sm" className="h-9">
                        {t.admin.save}
                      </Button>
                    </form>
                  </td>
                  <td className="p-2.5 text-right">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const form = new FormData();
                          form.set("variant_id", variant.id);
                          await run(deleteVariant, form);
                        })
                      }
                      aria-label={t.admin.delete}
                      className="grid size-8 place-items-center text-mute hover:text-flame"
                    >
                      <CloseIcon className="size-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add a variant */}
      <form
        action={async (form) => {
          form.set("product_id", product.id);
          await run(addVariant, form);
        }}
        className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4"
      >
        <Select label={t.common.color} name="colorway_id" defaultValue={product.colorways[0]?.id}>
          {swatches.map((swatch) => (
            <option key={swatch.id} value={swatch.id}>
              {swatch.name}
            </option>
          ))}
        </Select>
        <Select label={t.admin.size} name="size" defaultValue="M">
          {allSizes().map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </Select>
        <Field label={t.admin.units} name="stock" type="number" defaultValue="0" />
        <Button type="submit" variant="outline" className="h-12">
          <PlusIcon className="size-4" />
          {t.admin.addVariant}
        </Button>
      </form>
    </section>
  );
}

/* -------------------------------------------------------------- credits */

function CreditsEditor({
  product,
  authors,
  t,
  run,
}: {
  product: Product;
  authors: Author[];
  t: Dictionary;
  run: Runner;
}) {
  const [pending, start] = useTransition();
  const credited = new Set(product.credits.map((credit) => credit.authorId));
  const available = authors.filter((author) => !credited.has(author.id));

  return (
    <section className="border border-line bg-white p-6">
      <h2 className="mb-4 text-2xl">{t.admin.credits}</h2>

      {product.credits.length === 0 ? (
        <p className="text-[0.875rem] text-mute">{t.admin.noCredits}</p>
      ) : (
        <ul className="divide-y divide-line-soft border-y border-line-soft">
          {product.credits.map((credit) => (
            <li key={credit.authorId} className="flex items-center gap-3 py-3">
              <span className="flex-1">
                <span className="block font-semibold">{credit.name}</span>
                <span className="block text-[0.8125rem] text-mute">{credit.role ?? "—"}</span>
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const form = new FormData();
                    form.set("product_id", product.id);
                    form.set("author_id", credit.authorId);
                    await run(removeCredit, form);
                  })
                }
                className="inline-flex h-9 items-center gap-1.5 border border-line px-3 text-[0.8125rem] transition hover:border-flame hover:text-flame"
              >
                <CloseIcon className="size-3.5" />
                {t.admin.removeAuthor}
              </button>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 && (
        <form
          action={async (form) => {
            form.set("product_id", product.id);
            await run(addCredit, form);
          }}
          className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4"
        >
          <Select label={t.admin.addAuthor} name="author_id" defaultValue={available[0].id}>
            {available.map((author) => (
              <option key={author.id} value={author.id}>
                {author.name} — {author.role}
              </option>
            ))}
          </Select>
          {LOCALES.map((option) => (
            <Field
              key={option}
              label={`${t.admin.authorRole} (${LOCALE_META[option].endonym})`}
              name={`role_${option}`}
              required={option === "es"}
            />
          ))}
          <Button type="submit" variant="outline" className="h-12">
            <PlusIcon className="size-4" />
            {t.admin.addAuthor}
          </Button>
        </form>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------- images */

function ImageManager({
  product,
  t,
  run,
}: {
  product: Product;
  t: Dictionary;
  run: Runner;
}) {
  const [pending, start] = useTransition();
  /*
    Which image the confirmation is asking about. Held as the image rather than a
    boolean so the dialog can show the thumbnail: "are you sure?" is a much easier
    question to answer when the thing in question is on screen.
  */
  const [doomed, setDoomed] = useState<Product["images"][number] | null>(null);

  return (
    <section className="border border-line bg-white p-6">
      <h2 className="mb-4 text-2xl">{t.admin.media}</h2>

      {product.images.length === 0 ? (
        <p className="text-[0.875rem] text-mute">{t.admin.noImages}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {product.images.map((image) => {
            /*
              The colour this photograph belongs to, looked up in the product's own
              list rather than resolved from the palette: a tag left behind by a
              colour that has since been dropped from the product would otherwise
              come back as "negro", and a caption that quietly names the wrong
              colour is worse than one that looks broken. Such an image shows under
              no colour on the storefront, so its raw id is what gets printed —
              it should look wrong, because it is.
            */
            const tagged = product.colorways.find((c) => c.id === image.colorwayId);

            return (
              <li key={image.id} className="group relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL */}
                <img
                  src={mediaUrl(image.path)}
                  alt={image.alt ?? product.name}
                  className="aspect-square w-full bg-shell object-cover"
                />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setDoomed(image)}
                  aria-label={t.admin.deleteImage}
                  className="absolute right-1 top-1 grid size-8 place-items-center bg-white/90 text-ink opacity-0 transition group-hover:opacity-100 hover:text-flame"
                >
                  <CloseIcon className="size-4" />
                </button>
                <span className="mt-1.5 flex items-center gap-1.5 text-[0.75rem] text-mute">
                  {tagged ? (
                    <>
                      <Swatch base={tagged.base} trim={tagged.trim} className="size-3.5" />
                      {tagged.name}
                    </>
                  ) : (
                    image.colorwayId ?? t.admin.imageColorwayAll
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <form
        action={async (form) => {
          form.set("product_id", product.id);
          const file = form.get("file");
          if (file instanceof File && file.size > PRODUCT_IMAGE_MAX_BYTES) {
            /*
              Refused here, and reported through `run` so it lands in the same
              status line as every other failure. Sending it would be worse than
              pointless: the framework caps the request body and would reject it
              on the way in, so the action's own `too_large` never gets to speak.
            */
            await run(() => Promise.resolve({ ok: false, error: "too_large" }), form);
            return;
          }
          await run(uploadProductImage, form);
        }}
        className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4"
      >
        <label className="block">
          <span className="eyebrow mb-1.5 block text-mute">{t.admin.uploadImage}</span>
          <input
            type="file"
            name="file"
            required
            accept="image/jpeg,image/png,image/webp,image/avif,image/svg+xml"
            className="h-12 border border-line px-3 py-2.5 text-[0.8125rem] file:mr-3 file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-white"
          />
        </label>
        <Field label={`${t.admin.imageAlt} (es)`} name="alt_es" required />

        {/*
          Which colour of the garment this photograph is of.

          "Every colour" is the default and stays the right answer for most of the
          shop — a framed print has no colour to choose, and one flat-lay of a tee
          is better than none for a colour nobody photographed yet.
        */}
        <Select label={t.admin.imageColorway} name="colorway_id" defaultValue="">
          <option value="">{t.admin.imageColorwayAll}</option>
          {product.colorways.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </Select>

        <Button type="submit" variant="outline" className="h-12">
          {t.admin.uploadImage}
        </Button>
        <p className="w-full text-[0.75rem] text-mute">{t.admin.imageHint}</p>
        <p className="w-full text-[0.75rem] text-mute">{t.admin.imageColorwayHint}</p>
      </form>

      <ConfirmDialog
        open={doomed !== null}
        title={t.admin.deleteImage}
        body={t.admin.deleteImageConfirm}
        confirmLabel={t.admin.delete}
        cancelLabel={t.admin.cancel}
        pending={pending}
        onClose={() => setDoomed(null)}
        onConfirm={() => {
          const image = doomed;
          if (!image) return;
          start(async () => {
            const form = new FormData();
            form.set("image_id", image.id);
            await run(deleteProductImage, form);
            setDoomed(null);
          });
        }}
      >
        {doomed && (
          /* eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL */
          <img
            src={mediaUrl(doomed.path)}
            alt={doomed.alt ?? product.name}
            className="mx-auto aspect-square w-32 border border-line bg-shell object-cover"
          />
        )}
      </ConfirmDialog>
    </section>
  );
}

/**
 * A typed measurement as a number, or the fallback while it is not one yet.
 * The server clamps the value that is actually stored; this only decides what the
 * preview draws while someone is still typing.
 */
function cmOr(typed: string, fallback: number): number {
  const value = Number(typed.replace(",", "."));
  return Number.isFinite(value) && value >= FRAME_MIN_CM && value <= FRAME_MAX_CM
    ? value
    : fallback;
}

/* ----------------------------------------------------------------- atoms */

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  step,
  required,
  hint,
  as = "input",
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  step?: string;
  required?: boolean;
  hint?: string;
  as?: "input" | "textarea";
}) {
  const shared =
    "w-full border border-line px-3 text-[0.9375rem] outline-none transition focus:border-ink";

  return (
    <label className="block">
      <span className="eyebrow mb-1.5 block text-mute">
        {label}
        {required && <span className="text-flame"> *</span>}
      </span>
      {as === "textarea" ? (
        <textarea name={name} defaultValue={defaultValue} rows={3} className={`${shared} py-2`} />
      ) : (
        <input
          name={name}
          type={type}
          step={step}
          defaultValue={defaultValue}
          className={`${shared} h-12`}
        />
      )}
      {hint && <span className="mt-1 block text-[0.75rem] text-mute">{hint}</span>}
    </label>
  );
}

function Select({
  label,
  name,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="eyebrow mb-1.5 block text-mute">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="h-12 w-full border border-line bg-white px-3 text-[0.9375rem] outline-none transition focus:border-ink"
      >
        {children}
      </select>
    </label>
  );
}
