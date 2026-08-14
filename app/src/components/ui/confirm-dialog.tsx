"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

/**
 * "Are you sure?" for something that cannot be walked back.
 *
 * A native `<dialog>` opened with `showModal()`, so the browser gives us the
 * focus trap, the backdrop and Escape for free rather than us reimplementing
 * three accessibility features badly.
 *
 * Two deliberate details:
 *
 *  * **Cancel comes first in the DOM.** `showModal()` focuses the first
 *    focusable element, and the first thing a keyboard lands on should not be
 *    the button that deletes. It still reads left-to-right as Cancel / Delete.
 *  * **While the action runs, nothing closes the dialog** — not Escape, not the
 *    backdrop. A half-finished delete with the dialog already gone leaves
 *    somebody guessing whether it happened.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  pending,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  /** Optional preview of what is about to go, e.g. the image itself. */
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(event) => {
        // Escape, which the browser routes here before `close`.
        if (pending) event.preventDefault();
      }}
      onClick={(event) => {
        if (event.target === ref.current && !pending) onClose();
      }}
      aria-labelledby="confirm-title"
      aria-describedby="confirm-body"
      className="w-[min(26rem,calc(100vw-1.5rem))] bg-white p-0 text-ink backdrop:bg-black/60"
    >
      <div className="space-y-4 p-5">
        <h2 id="confirm-title" className="text-xl">
          {title}
        </h2>

        {children}

        <p id="confirm-body" className="text-[0.9375rem] leading-relaxed text-mute">
          {body}
        </p>

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" disabled={pending} onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button type="button" variant="sale" disabled={pending} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
