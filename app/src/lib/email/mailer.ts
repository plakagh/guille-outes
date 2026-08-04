import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

/**
 * Transactional email (order confirmations, failed payments).
 *
 * Separate from the auth emails, which Supabase sends from its own templates.
 * Both use the same SMTP host and the same visual identity.
 *
 * Locally this points at Mailpit (`smtp_port` in `infra/supabase/config.toml`),
 * so nothing ever leaves the machine while developing.
 */

export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

let cached: Transporter | null = null;

function transporter(): Transporter | null {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  cached ??= nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    // Mailpit and most providers on 587 use STARTTLS, not implicit TLS.
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" }
      : undefined,
    // Mailpit presents a self-signed certificate.
    tls: { rejectUnauthorized: process.env.NODE_ENV === "production" },
  });

  return cached;
}

/** True when the server is configured to send mail at all. */
export function canSendMail(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

/**
 * Sends a message, returning whether it went out.
 *
 * Never throws: an order must not fail to settle because the mail server is
 * down. Callers that care (the payment callback) log and carry on, and the
 * failure is visible because `failure_notified_at` stays null.
 */
export async function sendMail(message: MailMessage): Promise<boolean> {
  const transport = transporter();

  if (!transport) {
    console.warn(`[mail] SMTP_HOST is unset — not sending "${message.subject}"`);
    return false;
  }

  const from = process.env.SMTP_SENDER_NAME
    ? `"${process.env.SMTP_SENDER_NAME}" <${process.env.SMTP_ADMIN_EMAIL ?? "no-reply@guilleoutes.com"}>`
    : (process.env.SMTP_ADMIN_EMAIL ?? "no-reply@guilleoutes.com");

  try {
    await transport.sendMail({
      from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    return true;
  } catch (error) {
    console.error("[mail] could not send", message.subject, error);
    return false;
  }
}
