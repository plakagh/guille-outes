"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { CheckIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { signUp, type SignUpState } from "@/lib/auth/actions";

export function RegisterForm({ next }: { next?: string }) {
  const { t, locale, href } = useI18n();
  const [state, action, pending] = useActionState<SignUpState, FormData>(signUp, {});

  if (state.confirm) {
    return (
      <div className="mt-8 flex items-start gap-3 border border-line bg-shell p-6">
        <CheckIcon className="mt-0.5 size-6 shrink-0 text-pine" />
        <div>
          <p className="font-display text-xl font-bold uppercase">{t.auth.checkInbox}</p>
          <p className="mt-1 text-[0.875rem] text-mute">
            {t.auth.checkInboxBody}{" "}
            {state.email && <span className="font-semibold text-ink">{state.email}</span>}
          </p>
          <p className="mt-3 text-[0.8125rem] text-mute">
            <Link href={href("login")} className="font-semibold text-ink underline">
              {t.auth.signInInstead}
            </Link>{" "}
            — {t.auth.resend.toLowerCase()}
          </p>
        </div>
      </div>
    );
  }

  const message =
    state.error === "taken"
      ? t.auth.emailTaken
      : state.error === "weak"
        ? t.auth.weakPassword
        : state.error === "terms"
          ? t.auth.acceptTermsRequired
          : state.error === "disabled"
            ? t.auth.signUpDisabled
            : state.error
              ? t.admin.error
              : null;

  return (
    <form action={action} className="mt-8 max-w-sm space-y-4">
      <input type="hidden" name="locale" value={locale} />
      {next && <input type="hidden" name="next" value={next} />}

      <label className="block">
        <span className="eyebrow mb-1.5 block text-mute">{t.auth.fullName}</span>
        <input
          name="full_name"
          autoComplete="name"
          className="h-12 w-full border border-line px-3 text-[0.9375rem] outline-none transition focus:border-ink"
        />
      </label>

      <label className="block">
        <span className="eyebrow mb-1.5 block text-mute">
          {t.auth.email}
          <span className="text-flame"> *</span>
        </span>
        <input
          name="email"
          type="email"
          required
          defaultValue={state.email}
          autoComplete="email"
          className="h-12 w-full border border-line px-3 text-[0.9375rem] outline-none transition focus:border-ink"
        />
      </label>

      <label className="block">
        <span className="eyebrow mb-1.5 block text-mute">
          {t.auth.password}
          <span className="text-flame"> *</span>
        </span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="h-12 w-full border border-line px-3 text-[0.9375rem] outline-none transition focus:border-ink"
        />
        <span className="mt-1 block text-[0.75rem] text-mute">{t.auth.passwordHint}</span>
      </label>

      {/* Plain-language notice at the point of collection (RGPD Art. 13). */}
      <div className="border-l-2 border-line bg-shell p-4">
        <p className="eyebrow mb-1.5 text-mute">{t.auth.dataUseTitle}</p>
        <p className="text-[0.8125rem] leading-relaxed text-ink/75">{t.auth.dataUseBody}</p>
      </div>

      <fieldset className="space-y-3 border-t border-line pt-4">
        {/*
          Required, and deliberately NOT defaultChecked: consent has to be an
          affirmative act, and a pre-ticked box is not one.
        */}
        <label className="flex cursor-pointer items-start gap-2.5 text-[0.8125rem] leading-relaxed">
          <input
            type="checkbox"
            name="accept_terms"
            required
            className="mt-0.5 size-4 shrink-0 accent-black"
          />
          <span>
            {t.auth.acceptTermsLabel}{" "}
            <Link
              href={href("legal", "condiciones")}
              target="_blank"
              className="underline hover:text-flame"
            >
              {t.checkout.termsLink}
            </Link>{" "}
            {t.auth.andThe}{" "}
            <Link
              href={href("legal", "privacidad")}
              target="_blank"
              className="underline hover:text-flame"
            >
              {t.footer.newsletter.privacy}
            </Link>
            <span className="text-flame"> *</span>
          </span>
        </label>

        {/* Separate decision, unbundled from the terms. */}
        <label className="flex cursor-pointer items-start gap-2.5 text-[0.8125rem] leading-relaxed">
          <input
            type="checkbox"
            name="accept_marketing"
            className="mt-0.5 size-4 shrink-0 accent-black"
          />
          <span>
            {t.auth.acceptMarketingLabel}
            <span className="mt-0.5 block text-[0.75rem] text-mute">
              {t.auth.acceptMarketingHint}
            </span>
          </span>
        </label>
      </fieldset>

      {message && (
        <p role="alert" className="text-[0.875rem] font-semibold text-flame">
          {message}
        </p>
      )}

      <Button type="submit" size="lg" block disabled={pending}>
        {pending ? t.auth.registering : t.auth.register}
      </Button>

      <p className="border-t border-line pt-4 text-[0.875rem] text-mute">
        {t.auth.haveAccount}{" "}
        <Link href={href("login")} className="font-semibold text-ink underline">
          {t.auth.signInInstead}
        </Link>
      </p>
    </form>
  );
}
