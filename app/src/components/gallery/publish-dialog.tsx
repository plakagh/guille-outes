"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useI18n } from "@/components/i18n/provider";
import { CloseIcon } from "@/components/icons";
import { Button, ButtonLink } from "@/components/ui/button";
import { publishArtwork, type PublishError, type PublishState } from "@/lib/gallery/actions";
import {
  AGE_MAX,
  AGE_MIN,
  ARTWORK_MAX_BYTES,
  AUTHOR_NAME_MAX,
  TITLE_MAX,
  type ArtworkOrigin,
} from "@/lib/gallery/model";

/**
 * Naming a drawing, signing it, and agreeing to it being published.
 *
 * One dialog for both ways in — a photograph of something drawn on paper and
 * something painted in the studio — because the questions are the same and the
 * consent certainly is. What differs is only where the image comes from, which
 * is why the caller hands over a `makeFile` rather than a file: the studio has
 * to rasterise its canvas, and doing that on submit rather than on every stroke
 * is the difference between a responsive tablet and a hot one.
 *
 * Two things here are not negotiable and are enforced again in the Server
 * Action, because a checkbox in a browser proves nothing:
 *
 *  * **The consent box is never pre-ticked.** Consent has to be an affirmative
 *    act (RGPD Art. 4(11)), and this one is about a child's drawing and first
 *    name on a public page.
 *  * **The name is a first name.** Three or more words is refused rather than
 *    trimmed, because silently publishing "Martina García" as "Martina" would be
 *    guessing at what a parent meant about their own child.
 */

export type PublishSource = () => Promise<{
  file: File;
  width: number;
  height: number;
} | null>;

const ERROR_KEY: Record<PublishError, keyof ReturnType<typeof messages>> = {
  title_empty: "titleEmpty",
  title_too_long: "titleTooLong",
  name_empty: "nameEmpty",
  name_too_long: "nameTooLong",
  name_looks_like_full_name: "nameFullName",
  age_out_of_range: "ageRange",
  not_signed_in: "needsAccount",
  consent: "consentRequired",
  no_image: "noImage",
  unsupported_type: "unsupportedType",
  too_large: "tooLarge",
  upload_failed: "uploadFailed",
  unknown: "unknown",
};

function messages(t: ReturnType<typeof useI18n>["t"]) {
  return t.gallery.errors;
}

export function PublishDialog({
  open,
  onClose,
  origin,
  makeFile,
  previewUrl,
  signedIn,
  returnTo,
  privacyHref,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  origin: ArtworkOrigin;
  makeFile: PublishSource;
  /** What the child is about to publish, so they can see what they are naming. */
  previewUrl: string | null;
  signedIn: boolean;
  /** Where sign-in should come back to, so a drawing survives the round trip. */
  returnTo: string;
  /**
   * Resolved on the server. The legal documents live in `lib/pages.ts`, which is
   * over a thousand lines of article text — importing it here to look up one
   * slug would ship the whole legal corpus to every tablet in the fair.
   */
  privacyHref: string;
  /**
   * Fired once the drawing is on its way to the server. The studio uses it to
   * drop its local draft, so the next child at the stand does not find the
   * previous one's drawing waiting on the sheet.
   */
  onSubmitted?: () => void;
}) {
  const { t, locale, href } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const [state, submit] = useActionState<PublishState, FormData>(publishArtwork, {});
  const [pending, startTransition] = useTransition();
  const [localError, setLocalError] = useState<PublishError | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const error = localError ?? state.error ?? null;
  const g = t.gallery.publish;

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLocalError(null);

    startTransition(async () => {
      // Rasterising here rather than up front keeps the studio from re-encoding
      // a 1500² PNG every time a stroke lands.
      const source = await makeFile();
      if (!source) {
        setLocalError("no_image");
        return;
      }

      /*
        The same limit the action checks, checked again before the drawing is
        sent. Not belt and braces: the framework caps a Server Action's request
        body and turns an oversized one away while it is still arriving, so the
        action never gets to answer `too_large` and the child is handed a server
        error page instead of being told the photograph is too heavy.
      */
      if (source.file.size > ARTWORK_MAX_BYTES) {
        setLocalError("too_large");
        return;
      }

      form.set("file", source.file);
      form.set("width", String(source.width));
      form.set("height", String(source.height));
      form.set("origin", origin);
      form.set("locale", locale);

      submit(form);
      onSubmitted?.();
    });
  };

  const signInHref = `${href("login")}?next=${encodeURIComponent(returnTo)}`;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      aria-labelledby="publish-title"
      className="w-[min(36rem,calc(100vw-1.5rem))] bg-white p-0 text-ink backdrop:bg-black/60"
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <h2 id="publish-title" className="text-xl">
          {g.title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.common.close}
          className="-m-2 p-2 text-mute hover:text-ink"
        >
          <CloseIcon className="size-5" />
        </button>
      </div>

      {!signedIn ? (
        /*
          Painting needs nobody's permission; publishing does. The drawing is
          kept in this browser while the grown-up signs in, and `next` brings
          them straight back to it — a child who loses their drawing to a login
          form does not make a second one.
        */
        <div className="space-y-4 px-5 py-6">
          <p className="font-display text-lg font-bold uppercase leading-tight">
            {g.needsAccountTitle}
          </p>
          <p className="text-[0.9375rem] leading-relaxed text-mute">{g.needsAccountBlurb}</p>
          <div className="flex flex-wrap gap-3 pt-1">
            <ButtonLink href={signInHref}>{t.auth.signIn}</ButtonLink>
            <ButtonLink href={href("register")} variant="outline">
              {t.auth.registerTitle}
            </ButtonLink>
          </div>
          <p className="text-[0.8125rem] text-mute">{g.draftKept}</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5 px-5 py-5">
          {previewUrl && (
            <div className="mx-auto max-w-[14rem] border border-line bg-shell p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="" className="block w-full" />
            </div>
          )}

          <label className="block">
            <span className="mb-1.5 block text-[0.8125rem] font-semibold">{g.titleLabel}</span>
            <input
              name="title"
              required
              maxLength={TITLE_MAX}
              placeholder={g.titlePlaceholder}
              className="h-12 w-full border border-line px-3 text-[0.9375rem] focus:border-ink focus:outline-none"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_7rem]">
            <label className="block">
              <span className="mb-1.5 block text-[0.8125rem] font-semibold">{g.nameLabel}</span>
              <input
                name="author_name"
                required
                maxLength={AUTHOR_NAME_MAX}
                placeholder={g.namePlaceholder}
                autoComplete="off"
                className="h-12 w-full border border-line px-3 text-[0.9375rem] focus:border-ink focus:outline-none"
              />
              <span className="mt-1 block text-[0.75rem] text-mute">{g.nameHint}</span>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[0.8125rem] font-semibold">{g.ageLabel}</span>
              <input
                name="author_age"
                type="number"
                inputMode="numeric"
                min={AGE_MIN}
                max={AGE_MAX}
                className="h-12 w-full border border-line px-3 text-[0.9375rem] focus:border-ink focus:outline-none"
              />
              <span className="mt-1 block text-[0.75rem] text-mute">{g.ageHint}</span>
            </label>
          </div>

          {/*
            Never pre-ticked, and the wording here is stored verbatim on the
            drawing: pointing at today's privacy notice would show what it says
            now, not what this person agreed to today.
          */}
          <label className="flex items-start gap-3 border-l-2 border-flame bg-shell p-4 text-[0.875rem] leading-relaxed">
            <input
              type="checkbox"
              name="consent"
              required
              className="mt-0.5 size-4 shrink-0 accent-black"
            />
            <span>
              {g.consentLabel}{" "}
              <Link href={privacyHref} className="underline hover:text-flame">
                {t.footer.legal.privacy}
              </Link>
              <span className="mt-1.5 block text-[0.8125rem] text-mute">{g.consentDetail}</span>
            </span>
          </label>

          {error && (
            <p role="alert" className="text-[0.875rem] font-semibold text-flame">
              {messages(t)[ERROR_KEY[error]]}
            </p>
          )}

          <Button type="submit" block size="lg" disabled={pending}>
            {pending ? g.publishing : g.publish}
          </Button>

          <p className="text-[0.75rem] leading-relaxed text-mute">{g.withdrawNote}</p>
        </form>
      )}
    </dialog>
  );
}
