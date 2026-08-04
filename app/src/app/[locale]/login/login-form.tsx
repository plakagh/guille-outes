"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { CheckIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  resendConfirmation,
  signIn,
  type ResendState,
  type SignInState,
} from "@/lib/auth/actions";

export function LoginForm({
  next,
  confirmNotice,
}: {
  next?: string;
  /** Set when the visitor arrived from a broken confirmation link. */
  confirmNotice?: "invalid" | "expired";
}) {
  const { t, locale, href } = useI18n();
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, {});

  // An unconfirmed address is the one failure the customer can actually fix, so
  // it gets its own panel with a resend button instead of a red line.
  const needsConfirmation = state.error === "unconfirmed" || confirmNotice !== undefined;

  const message =
    state.error === "rate_limited"
      ? t.auth.rateLimited
      : state.error === "invalid"
        ? t.auth.invalid
        : null;

  return (
    <>
      {needsConfirmation && (
        <ConfirmationPanel
          email={state.email}
          notice={state.error === "unconfirmed" ? undefined : confirmNotice}
        />
      )}

      <form action={action} className="mt-8 max-w-sm space-y-4">
        <input type="hidden" name="locale" value={locale} />
        {next && <input type="hidden" name="next" value={next} />}

        <label className="block">
          <span className="eyebrow mb-1.5 block text-mute">{t.auth.email}</span>
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
          <span className="eyebrow mb-1.5 block text-mute">{t.auth.password}</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="h-12 w-full border border-line px-3 text-[0.9375rem] outline-none transition focus:border-ink"
          />
        </label>

        {message && (
          <p role="alert" className="text-[0.875rem] font-semibold text-flame">
            {message}
          </p>
        )}

        <Button type="submit" size="lg" block disabled={pending}>
          {pending ? t.auth.signingIn : t.auth.signIn}
        </Button>

        <p className="border-t border-line pt-4 text-[0.875rem] text-mute">
          {t.auth.noAccountYet}{" "}
          <Link
            href={next ? `${href("register")}?next=${encodeURIComponent(next)}` : href("register")}
            className="font-semibold text-ink underline"
          >
            {t.auth.createOne}
          </Link>
        </p>
      </form>
    </>
  );
}

function ConfirmationPanel({
  email,
  notice,
}: {
  email?: string;
  notice?: "invalid" | "expired";
}) {
  const { t, locale } = useI18n();
  const [state, action, pending] = useActionState<ResendState, FormData>(resendConfirmation, {});

  const heading =
    notice === "invalid"
      ? t.auth.confirmInvalid
      : notice === "expired"
        ? t.auth.confirmExpired
        : t.auth.unconfirmed;

  return (
    <div className="mt-8 max-w-md border-l-2 border-gold bg-shell p-5">
      <p className="font-display text-lg font-bold uppercase leading-tight">{heading}</p>
      <p className="mt-2 text-[0.875rem] leading-relaxed text-mute">{t.auth.unconfirmedBody}</p>

      {state.sent ? (
        <p className="mt-3 flex items-center gap-1.5 text-[0.875rem] font-semibold text-pine">
          <CheckIcon className="size-4" />
          {t.auth.resent}
        </p>
      ) : (
        <form action={action} className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="locale" value={locale} />
          <label className="block flex-1">
            <span className="eyebrow mb-1.5 block text-mute">{t.auth.email}</span>
            <input
              name="email"
              type="email"
              required
              defaultValue={email}
              className="h-11 w-full border border-line bg-white px-3 text-[0.875rem] outline-none focus:border-ink"
            />
          </label>
          <Button type="submit" variant="outline" size="sm" className="h-11" disabled={pending}>
            {pending ? t.auth.resending : t.auth.resend}
          </Button>

          {state.error && (
            <p role="alert" className="w-full text-[0.8125rem] font-semibold text-flame">
              {state.error === "rate_limited" ? t.auth.rateLimited : t.admin.error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
