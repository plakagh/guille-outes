"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowRight, CheckIcon } from "@/components/icons";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/config";
import { subscribeToNewsletter, type SubscribeState } from "@/lib/newsletter/actions";

/**
 * Newsletter signup, with double opt-in.
 *
 * Nothing is promised on submit: the panel says an email is on its way, because
 * that is all that has happened. The address is not on the list until it clicks.
 *
 * The consent box is required and never pre-ticked — consent has to be an
 * affirmative act (RGPD Art. 4(11)) — and the requirement is enforced in the
 * server action too, so it cannot be skipped by posting the form directly.
 */
export function Newsletter({
  t,
  locale,
  privacyHref,
}: {
  t: Dictionary;
  locale: Locale;
  privacyHref: string;
}) {
  const [state, action, pending] = useActionState<SubscribeState, FormData>(
    subscribeToNewsletter,
    { status: "idle" },
  );

  const n = t.footer.newsletter;

  return (
    <section data-chrome="dark" className="bg-black text-white">
      <div className="shell grid gap-8 py-12 lg:grid-cols-2 lg:items-center lg:py-16">
        <div>
          <p className="eyebrow mb-3 text-flame-bright">{n.eyebrow}</p>
          <h2 className="text-[clamp(2rem,5vw,3.5rem)] leading-[0.9]">
            {n.title1}
            <br />
            {n.title2}
          </h2>
          <p className="mt-4 text-[0.9375rem] leading-relaxed text-white/70">{n.blurb}</p>
        </div>

        <div>
          {state.status === "sent" ? (
            <div className="flex items-start gap-3 border border-white/20 bg-white/5 p-6">
              {/*
                White, not red. This tick is a confirmation, and red on this site
                means the action or a discount — neither of which a "we've sent
                the email" panel is. Success green is the token for it, but #067647
                on black is unreadable, and white says it plainly on this surface.
              */}
              <CheckIcon className="mt-0.5 size-6 shrink-0 text-white" />
              <div>
                <p className="font-display text-xl font-bold uppercase">{n.checkInboxTitle}</p>
                <p className="mt-1 text-[0.875rem] text-white/70">
                  {n.checkInboxBody}{" "}
                  <span className="font-semibold text-white">{state.email}</span>.
                </p>
                <p className="mt-2 text-[0.75rem] text-white/50">{n.checkInboxHint}</p>
              </div>
            </div>
          ) : (
            <form action={action} className="space-y-3">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="source" value="footer" />

              <label htmlFor="newsletter-email" className="eyebrow block text-white/60">
                {n.email}
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="newsletter-email"
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  defaultValue={state.status === "error" ? state.email : ""}
                  placeholder={n.placeholder}
                  aria-invalid={state.status === "error" || undefined}
                  aria-describedby={state.status === "error" ? "newsletter-error" : undefined}
                  className="h-14 min-w-0 flex-1 border border-white/25 bg-transparent px-4 text-[0.9375rem] outline-none transition placeholder:text-white/40 focus:border-white"
                />
                {/*
                  White with black text, per §2.2 — not the red it was.

                  On a black band, white *is* the strongest thing available, so red
                  buys no emphasis here and only spends the CTA colour on a
                  secondary ask: signing up for a newsletter is not the action any
                  page on this site exists for. Body face and .06em, like every
                  other label.
                */}
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex h-14 items-center justify-center gap-2 bg-white px-7 font-sans text-base font-bold uppercase tracking-cta text-ink transition-colors hover:bg-shell-deep disabled:opacity-60"
                >
                  {pending ? n.submitting : n.submit}
                  <ArrowRight className="size-4" />
                </button>
              </div>

              {/*
                Required, and deliberately NOT defaultChecked. Also unbundled from
                anything else: this box buys the newsletter and nothing more.
              */}
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

              <p className="text-[0.75rem] leading-relaxed text-white/50">{n.consentDetail}</p>

              {state.status === "error" && (
                <p
                  id="newsletter-error"
                  role="alert"
                  className="border-l-2 border-flame-bright bg-white/5 p-3 text-[0.8125rem] text-white"
                >
                  {n.errors[state.error]}
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
