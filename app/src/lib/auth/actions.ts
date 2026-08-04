"use server";

import { redirect } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { href } from "@/lib/i18n/routes";
import { LEGAL_VERSION } from "@/lib/legal/version";
import { SITE_URL } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth runs entirely through Server Actions.
 *
 * The session cookies are httpOnly, so no browser JavaScript can read the
 * access or refresh token — which means an XSS bug cannot exfiltrate a session.
 * The trade-off is that there is no browser Supabase client at all; every
 * authenticated operation is an action like these.
 *
 * Server Actions are also CSRF-protected by Next.js (it checks Origin against
 * Host), and the cookies are SameSite=Lax.
 *
 * There is one account type. What separates a shopper from an administrator is
 * `profiles.is_admin`, which the account itself cannot change — so signing up
 * can never grant catalogue access.
 */

const MIN_PASSWORD = 8;

export type SignInState = {
  error?: "invalid" | "unconfirmed" | "rate_limited";
  /** Echoed back so the resend button knows which address to use. */
  email?: string;
};

export type ResendState = { sent?: boolean; error?: "invalid" | "rate_limited" | "unknown" };
export type SignUpState = {
  error?: "invalid" | "weak" | "taken" | "disabled" | "terms" | "unknown";
  /** Set when the project requires email confirmation before first sign-in. */
  confirm?: boolean;
  email?: string;
};

function safeLocale(value: FormDataEntryValue | null): Locale {
  const raw = typeof value === "string" ? value : "";
  return isLocale(raw) ? raw : "es";
}

/**
 * Only same-origin, locale-prefixed paths are accepted as a post-login
 * destination, so `?next=` can never be used as an open redirect.
 */
function safeNext(value: FormDataEntryValue | null, locale: Locale): string {
  const raw = typeof value === "string" ? value : "";
  if (raw.startsWith(`/${locale}/`) || raw === `/${locale}`) return raw;
  return href(locale, "account");
}

export async function signIn(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const locale = safeLocale(formData.get("locale"));
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"), locale);

  if (!email || !password) return { error: "invalid", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const code = error.code ?? "";
    const message = error.message.toLowerCase();

    // A pending confirmation is NOT a wrong password, and saying so would send
    // the customer round in circles looking for a typo that is not there. This
    // leaks only that the address is registered but unconfirmed, which the
    // sign-up form already reveals.
    if (code === "email_not_confirmed" || message.includes("not confirmed")) {
      return { error: "unconfirmed", email };
    }
    if (code === "over_request_rate_limit" || message.includes("rate limit")) {
      return { error: "rate_limited", email };
    }

    // Everything else stays deliberately vague: never reveal whether the
    // address exists or which half of the pair was wrong.
    return { error: "invalid", email };
  }

  redirect(next);
}

export async function signUp(
  _previous: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  const locale = safeLocale(formData.get("locale"));
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const next = safeNext(formData.get("next"), locale);

  if (!email || !password) return { error: "invalid", email };
  if (password.length < MIN_PASSWORD) return { error: "weak", email };

  // Accepting the terms and the privacy notice is a hard requirement, checked
  // here and not only in the browser. The box is never pre-ticked: consent has
  // to be an affirmative action (RGPD Art. 4(11)).
  const acceptedTerms = formData.get("accept_terms") === "on";
  if (!acceptedTerms) return { error: "terms", email };

  // Marketing is a separate, optional decision — unbundled from the terms.
  const wantsMarketing = formData.get("accept_marketing") === "on";

  const supabase = await createClient();

  // Metadata is read by the `handle_new_user` trigger, which writes the profile
  // and the consent records in the same transaction as the account. Note it
  // cannot set is_admin: that column is not writable by the account, so a
  // crafted sign-up cannot escalate.
  //
  // Consent travels here rather than through the confirmation link, because
  // Supabase URL-encodes `emailRedirectTo` and any extra parameter would end up
  // nested inside it.
  //
  // `emailRedirectTo` becomes {{ .RedirectTo }} in the template, so the customer
  // comes back to the account page in the language they signed up in.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        ...(fullName ? { full_name: fullName } : {}),
        consent_terms: true,
        consent_marketing: wantsMarketing,
        consent_version: LEGAL_VERSION,
        consent_locale: locale,
      },
      emailRedirectTo: `${SITE_URL}${href(locale, "account")}`,
    },
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("already registered") || message.includes("already been registered")) {
      return { error: "taken", email };
    }
    if (message.includes("signups not allowed") || message.includes("disabled")) {
      return { error: "disabled", email };
    }
    if (message.includes("password")) return { error: "weak", email };
    return { error: "unknown", email };
  }

  // With email confirmation switched on, signUp returns a user but no session:
  // the account exists and is waiting for the link to be opened.
  //
  // Supabase also returns success with an empty `identities` array when the
  // address is already registered — that is deliberate on their side, so the
  // form cannot be used to enumerate customers. Showing "check your inbox" is
  // the right response either way.
  if (!data.session) return { confirm: true, email };

  redirect(next);
}

export async function signOut(formData: FormData): Promise<void> {
  const locale = safeLocale(formData.get("locale"));
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(href(locale));
}

/**
 * Sends the confirmation email again.
 *
 * Supabase rate-limits this server-side; we surface that rather than pretending
 * the mail went out. The response never says whether the address exists.
 */
export async function resendConfirmation(
  _previous: ResendState,
  formData: FormData,
): Promise<ResendState> {
  const locale = safeLocale(formData.get("locale"));
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "invalid" };

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${SITE_URL}${href(locale, "account")}` },
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("rate limit") || error.code === "over_email_send_rate_limit") {
      return { error: "rate_limited" };
    }
    return { error: "unknown" };
  }

  return { sent: true };
}
