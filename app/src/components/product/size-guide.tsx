"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useI18n } from "@/components/i18n/provider";
import { CloseIcon } from "@/components/icons";
import { resolveSizeGuide, type Product } from "@/lib/catalog";

/**
 * The size guide for one product.
 *
 * Deliberately not a link to a shop-wide page: the table shows the sizes this
 * garment is actually sold in, with the measurements that matter for it. The
 * general advice — how to measure, the tolerance — still lives on the help page,
 * linked at the bottom for anyone who wants it.
 *
 * Rendered as a native `<dialog>`, so the browser handles the focus trap, the
 * backdrop and Escape rather than us reimplementing them badly.
 */
export function SizeGuideDialog({
  product,
  helpHref,
  open,
  onClose,
}: {
  product: Product;
  /** The general "how to measure" page, resolved on the server. */
  helpHref: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const guide = resolveSizeGuide(product);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  if (!guide) return null;

  const sizes = Object.keys(guide.measurements);

  return (
    <dialog
      ref={ref}
      // `close` fires for Escape and for the backdrop, so the parent's state
      // cannot drift out of step with what the browser has done.
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      aria-labelledby="size-guide-title"
      className="w-[min(34rem,calc(100vw-2rem))] bg-white p-0 text-ink backdrop:bg-black/50"
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div>
          <h2 id="size-guide-title" className="text-xl">
            {t.pdp.sizeGuide}
          </h2>
          <p className="mt-1 text-[0.8125rem] text-mute">{product.name}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.common.close}
          className="grid size-9 shrink-0 place-items-center hover:text-flame"
        >
          <CloseIcon className="size-5" />
        </button>
      </div>

      <div className="px-5 py-5">
        <p className="text-[0.8125rem] leading-relaxed text-mute">{t.pdp.sizeGuideIntro}</p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-[0.875rem]">
            <thead>
              <tr className="border-b-2 border-ink">
                <th scope="col" className="py-2 pr-3 font-display text-[0.75rem] uppercase">
                  {t.plp.size}
                </th>
                {guide.dimensions.map((dimension) => (
                  <th
                    key={dimension}
                    scope="col"
                    className="py-2 pr-3 font-display text-[0.75rem] uppercase"
                  >
                    {t.pdp.sizeDimensions[dimension]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sizes.map((size) => (
                <tr key={size} className="border-b border-line-soft">
                  <th scope="row" className="py-2 pr-3 font-semibold">
                    {size}
                  </th>
                  {guide.dimensions.map((dimension) => {
                    const value = guide.measurements[size]?.[dimension];
                    return (
                      <td key={dimension} className="py-2 pr-3 tabular-nums text-mute">
                        {value === undefined ? "—" : formatCm(value)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-[0.75rem] leading-relaxed text-mute">{t.pdp.sizeGuideTolerance}</p>

        <Link
          href={helpHref}
          className="mt-4 inline-block text-[0.8125rem] font-semibold underline hover:text-flame"
        >
          {t.pdp.sizeGuideHowTo}
        </Link>
      </div>
    </dialog>
  );
}

/** Half-centimetre precision, without a trailing `.0` on whole numbers. */
function formatCm(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)} cm`;
}
