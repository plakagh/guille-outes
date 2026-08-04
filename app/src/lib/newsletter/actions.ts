"use server";

import { headers } from "next/headers";
import { canSendMail, sendMail } from "@/lib/email/mailer";
import { newsletterConfirmEmail } from "@/lib/email/templates";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";
import { LEGAL_VERSION } from "@/lib/legal/version";
import { requestSubscription } from "@/lib/newsletter/store";
import { SITE_URL } from "@/lib/supabase/env";

/**
 * Subscribing to the newsletter.
 *
 * Two things are non-negotiable here and both are enforced on the server, not
 * only in the browser:
 *
 *  1. **The box has to be ticked.** Consent must be an affirmative act
 *     (RGPD Art. 4(11)), so it is never pre-checked and a submission without it
 *     is refused outright.
 *  2. **The address has to confirm.** Nothing but the confirmation request is
 *     ever sent to an unconfirmed address, because anyone can type someone
 *     else's email into a form.
 *
 * The reply is also deliberately uninformative: whether the address was new,
 * already pending, or already subscribed, the visitor is told the same thing.
 * Otherwise the form becomes a way to ask "is this person on your list?".
 */

export type SubscribeState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; error: "invalid_email" | "consent" | "unavailable"; email: string };

/** Roughly RFC-shaped; the confirmation email is the real validation. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export async function subscribeToNewsletter(
  _previous: SubscribeState,
  formData: FormData,
): Promise<SubscribeState> {
  const raw = String(formData.get("email") ?? "").trim();
  const email = raw.toLowerCase();
  const locale = safeLocale(formData.get("locale"));
  const source = String(formData.get("source") ?? "footer").slice(0, 40);

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { status: "error", error: "invalid_email", email: raw };
  }

  if (formData.get("accept_newsletter") !== "on") {
    return { status: "error", error: "consent", email: raw };
  }

  const t = await getDictionary(locale);

  // Store what was actually on screen, verbatim. Pointing at today's privacy
  // policy would not show what this person agreed to on this day.
  const n = t.footer.newsletter;
  const consentText = `${n.consentLabel} ${n.privacy}. ${n.consentDetail}`;

  const outcome = await requestSubscription({
    email,
    locale,
    source,
    consentVersion: LEGAL_VERSION,
    consentText,
    ip: await clientIp(),
  });

  if (outcome.status === "error") {
    return { status: "error", error: "unavailable", email: raw };
  }

  if (outcome.status === "confirm_sent") {
    if (!canSendMail()) {
      // Without mail there is no way to confirm, and claiming otherwise would
      // leave someone waiting for an email that cannot arrive.
      console.warn("[newsletter] SMTP_HOST is unset — cannot send the confirmation");
      return { status: "error", error: "unavailable", email: raw };
    }

    const confirmUrl = `${SITE_URL}${href(locale, "newsletterConfirm")}?token=${encodeURIComponent(
      outcome.token,
    )}`;

    const message = newsletterConfirmEmail({ email, confirmUrl }, t);
    const sent = await sendMail({ to: email, ...message });
    if (!sent) return { status: "error", error: "unavailable", email: raw };
  }

  // `already_confirmed` also lands here, on purpose: same answer, no email.
  return { status: "sent", email };
}

function safeLocale(value: FormDataEntryValue | null): Locale {
  const raw = typeof value === "string" ? value : "";
  return isLocale(raw) ? raw : DEFAULT_LOCALE;
}

/**
 * Best-effort caller address, kept as evidence of consent.
 *
 * Behind a proxy the left-most entry of `x-forwarded-for` is the client. It is
 * spoofable, which is fine: this is corroboration for a consent record, not an
 * access-control decision.
 */
async function clientIp(): Promise<string | null> {
  const list = await headers();
  const forwarded = list.get("x-forwarded-for");
  const candidate = forwarded?.split(",")[0]?.trim() || list.get("x-real-ip")?.trim();
  return candidate || null;
}
