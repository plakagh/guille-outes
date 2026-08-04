import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/config";
import { href } from "@/lib/i18n/routes";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for the link in the confirmation email.
 *
 * The template sends `token_hash` rather than using `{{ .ConfirmationURL }}`,
 * because that default route hands the session back in the URL *fragment* —
 * which never reaches the server, so a server-rendered app cannot turn it into a
 * cookie session. Verifying here writes the same httpOnly cookies as a normal
 * sign-in.
 *
 * Both shapes are handled, because which one arrives depends on the project's
 * auth flow:
 *
 *   ?token_hash=…&type=email   implicit flow  → verifyOtp
 *   ?code=…                    PKCE flow      → exchangeCodeForSession
 *
 * Supabase also emits a `pkce_`-prefixed token hash when the project is on PKCE;
 * that is still a token hash and goes through verifyOtp.
 *
 * Deliberately outside `app/[locale]` (Supabase builds the URL from SiteURL) and
 * excluded from the proxy's locale redirect.
 */

const ALLOWED_TYPES: EmailOtpType[] = ["email", "signup", "recovery", "email_change", "invite"];

/**
 * `next` arrives from the email, so it is treated as untrusted: only a
 * same-origin, locale-prefixed path is honoured. Anything else falls back to the
 * account page, so the link can never be turned into an open redirect.
 */
function safeDestination(raw: string | null, origin: string): { path: string; locale: Locale } {
  const fallbackLocale = DEFAULT_LOCALE;

  if (raw) {
    try {
      // Accepts both an absolute URL (what {{ .RedirectTo }} produces) and a path.
      const url = new URL(raw, origin);
      if (url.origin === origin) {
        const first = url.pathname.split("/").filter(Boolean)[0];
        // Drop the incoming query: the consent hint is read from our own params,
        // and appending two query strings would produce "?a=1?b=2".
        if (isLocale(first)) return { path: url.pathname, locale: first };
      }
    } catch {
      // fall through
    }
  }

  return { path: href(fallbackLocale, "account"), locale: fallbackLocale };
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const tokenHash = searchParams.get("token_hash");
  const code = searchParams.get("code");
  const rawType = searchParams.get("type");
  const type = ALLOWED_TYPES.includes(rawType as EmailOtpType)
    ? (rawType as EmailOtpType)
    : "email";

  const { path, locale } = safeDestination(searchParams.get("next"), origin);
  const loginWith = (reason: "invalid" | "expired") =>
    NextResponse.redirect(new URL(`${href(locale, "login")}?confirm=${reason}`, origin));

  if (!tokenHash && !code) return loginWith("invalid");

  const supabase = await createClient();

  const { error } = tokenHash
    ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    : await supabase.auth.exchangeCodeForSession(code as string);

  if (error) {
    // Expired or already-used links land here; the login page offers a resend.
    return loginWith("expired");
  }

  return NextResponse.redirect(new URL(`${path}?confirmed=1`, origin));
}
