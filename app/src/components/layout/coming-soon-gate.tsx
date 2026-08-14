"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { ArrowRight, CheckIcon, CloseIcon } from "@/components/icons";
import { useI18n } from "@/components/i18n/provider";
import { subscribeToNewsletter, type SubscribeState } from "@/lib/newsletter/actions";

/**
 * The "we're still building this" gate.
 *
 * The shop is browsable but not buyable yet, so the first thing a visitor meets
 * is this: what the state of things is, permission to look around anyway, and
 * the one useful thing they can do today — leave an address for opening day.
 *
 * It is a gate, not a wall. Esc, the backdrop and the close button all dismiss
 * it, because "te dejamos ver" is the whole point; a modal that cannot be
 * closed would contradict its own copy.
 *
 * It comes back on every arrival, on every URL, and nothing is remembered
 * between them: while the shop is closed this is the shop's front door, and
 * someone who lands straight on a product page from a link has been told
 * nothing yet. Once inside, moving around the site does not re-open it — the
 * layout this lives in survives client-side navigation — so it announces itself
 * once per visit rather than once per page.
 *
 * The form posts to the same Server Action as the footer, with `source` marking
 * where it came from so the admin list can tell the pre-launch signups apart.
 * The consent wording is deliberately the footer's, verbatim: the action stores
 * `t.footer.newsletter` as the consent record, so showing anything else here
 * would file a consent text this person never actually read.
 */

export function ComingSoonGate({ privacyHref }: { privacyHref: string }) {
  const { t, locale } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<SubscribeState, FormData>(
    subscribeToNewsletter,
    { status: "idle" },
  );

  /*
    Opened by hand rather than by rendering `open` on the element.

    A dialog that arrives open in the HTML is open before the JavaScript lands,
    which means it is open with no way to close it. `showModal()` after mount is
    also what puts it in the top layer and makes Esc and the backdrop work at
    all — an `open` attribute alone gives a non-modal box with none of that.
  */
  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const close = () => ref.current?.close();

  const c = t.comingSoon;
  const n = t.footer.newsletter;

  return (
    <dialog
      ref={ref}
      onClick={(event) => {
        if (event.target === ref.current) close();
      }}
      aria-labelledby="coming-soon-title"
      data-chrome="dark"
      /*
        `m-auto` is what centres it, and it is not decoration: the browser's own
        rule for an open modal is `inset: 0; margin: auto`, and Tailwind's
        preflight zeroes the margin on every element — which drops the panel into
        the top-left corner. The max-height keeps it on screen on a short phone
        instead of running off the bottom with the consent box unreachable.
      */
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(34rem,calc(100vw-1.5rem))] overflow-y-auto bg-black p-0 text-white backdrop:bg-black/70"
    >
      <div className="relative px-6 py-7 sm:px-8 sm:py-9">
        <button
          type="button"
          onClick={close}
          aria-label={t.common.close}
          className="absolute right-4 top-4 p-2 text-white/50 transition hover:text-white"
        >
          <CloseIcon className="size-5" />
        </button>

        <p className="eyebrow mb-3 text-flame-bright">{c.eyebrow}</p>
        <h2 id="coming-soon-title" className="text-[clamp(1.75rem,6vw,2.5rem)] leading-[0.95]">
          {c.title}
        </h2>
        <p className="mt-4 text-[0.9375rem] leading-relaxed text-white/70">{c.body}</p>

        {state.status === "sent" ? (
          <div className="mt-6 flex items-start gap-3 border border-white/20 bg-white/5 p-5">
            {/* White, not the success green: #067647 on black is unreadable. */}
            <CheckIcon className="mt-0.5 size-6 shrink-0 text-white" />
            <div>
              <p className="font-display text-xl font-bold uppercase">{n.checkInboxTitle}</p>
              <p className="mt-1 text-[0.875rem] text-white/70">
                {n.checkInboxBody} <span className="font-semibold text-white">{state.email}</span>.
              </p>
              <p className="mt-2 text-[0.75rem] text-white/50">{n.checkInboxHint}</p>
              <button
                type="button"
                onClick={close}
                className="mt-4 font-sans text-[0.8125rem] font-bold uppercase tracking-cta underline underline-offset-4 hover:text-white"
              >
                {c.dismiss}
              </button>
            </div>
          </div>
        ) : (
          <form action={action} className="mt-6 space-y-3">
            <input type="hidden" name="locale" value={locale} />
            {/* Marks the pre-launch list apart from the footer's in the admin. */}
            <input type="hidden" name="source" value="coming_soon" />

            <label htmlFor="coming-soon-email" className="eyebrow block text-white/60">
              {n.email}
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="coming-soon-email"
                name="email"
                type="email"
                required
                maxLength={254}
                defaultValue={state.status === "error" ? state.email : ""}
                placeholder={n.placeholder}
                aria-invalid={state.status === "error" || undefined}
                aria-describedby={state.status === "error" ? "coming-soon-error" : undefined}
                className="h-14 min-w-0 flex-1 border border-white/25 bg-transparent px-4 text-[0.9375rem] outline-none transition placeholder:text-white/40 focus:border-white"
              />
              {/*
                White on black, like the footer's: red is the CTA colour for the
                thing a page exists for, and on a black panel white is already
                the loudest thing available.
              */}
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-14 items-center justify-center gap-2 bg-white px-7 font-sans text-base font-bold uppercase tracking-cta text-ink transition-colors hover:bg-shell-deep disabled:opacity-60"
              >
                {pending ? n.submitting : c.submit}
                <ArrowRight className="size-4" />
              </button>
            </div>

            {/* Required, never pre-ticked — consent is an affirmative act. */}
            <label className="flex cursor-pointer items-start gap-2.5 pt-1 text-[0.8125rem] leading-relaxed text-white/70">
              <input
                type="checkbox"
                name="accept_newsletter"
                required
                className="mt-0.5 size-4 shrink-0 accent-white"
              />
              <span>
                {n.consentLabel}{" "}
                <Link href={privacyHref} target="_blank" className="underline hover:text-white">
                  {n.privacy}
                </Link>
                <span className="text-flame-bright"> *</span>
              </span>
            </label>

            {state.status === "error" && (
              <p
                id="coming-soon-error"
                role="alert"
                className="border-l-2 border-flame-bright bg-white/5 p-3 text-[0.8125rem] text-white"
              >
                {n.errors[state.error]}
              </p>
            )}

            <div className="pt-1">
              <button
                type="button"
                onClick={close}
                className="font-sans text-[0.8125rem] font-bold uppercase tracking-cta text-white/60 underline underline-offset-4 transition hover:text-white"
              >
                {c.dismiss}
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
