import "server-only";

import type { Dictionary } from "@/lib/i18n/dictionary";
import { formatVatRate, vatBreakdown } from "@/lib/tax";
import { formatPrice } from "@/lib/utils";

/**
 * Transactional email bodies, in the store's identity.
 *
 * The same shell as the Supabase auth templates: black masthead, red rule, the
 * wordmark set in type rather than an image so it survives images being blocked.
 * Inline styles and tables only — that is still what email clients understand.
 *
 * Every message also carries a plain-text alternative, because a text/plain part
 * measurably helps deliverability and some people genuinely read it.
 */

const INK = "#0a0a0a";
const FLAME = "#e2001a";
const SHELL = "#f4f4f4";
const MUTE = "#8f8f8f";

function shell({
  title,
  heading,
  intro,
  body = "",
  cta,
  outro,
  footerNote,
}: {
  title: string;
  heading: string;
  intro: string;
  body?: string;
  cta?: { label: string; href: string };
  outro?: string;
  /** Extra line in the dark footer — the unsubscribe link lives here. */
  footerNote?: string;
}): string {
  const button = cta
    ? `
                <table cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">
                  <tr>
                    <td style="background-color:${INK};">
                      <a href="${cta.href}" style="display:inline-block;padding:15px 34px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;text-transform:uppercase;letter-spacing:0.5px;">${cta.label}</a>
                    </td>
                  </tr>
                </table>`
    : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${SHELL};font-family:Arial,Helvetica,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${SHELL};">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
            <tr>
              <td style="background-color:${INK};padding:26px 32px;">
                <span style="font-family:'Arial Narrow',Arial,sans-serif;font-size:30px;font-weight:bold;letter-spacing:-0.5px;color:#ffffff;text-transform:uppercase;">
                  GUILLE <span style="font-weight:normal;">Outes</span>
                </span>
              </td>
            </tr>
            <tr>
              <td style="background-color:${FLAME};height:4px;font-size:1px;line-height:1px;">&nbsp;</td>
            </tr>
            <tr>
              <td style="background-color:#ffffff;padding:40px 32px 32px;">
                <h1 style="font-family:Arial,sans-serif;font-size:22px;font-weight:bold;color:${INK};margin:0 0 14px;line-height:1.3;">${heading}</h1>
                <p style="font-family:Arial,sans-serif;font-size:15px;color:#444444;line-height:1.7;margin:0 0 24px;">${intro}</p>
${body}${button}
                ${outro ? `<p style="font-family:Arial,sans-serif;font-size:13px;color:${MUTE};line-height:1.6;margin:26px 0 0;">${outro}</p>` : ""}
              </td>
            </tr>
            <tr>
              <td style="background-color:#1c1c1c;padding:18px 32px;">
                <p style="font-family:Arial,sans-serif;font-size:11px;color:${MUTE};margin:0;text-align:center;line-height:1.7;">
                  Guille Outes · <a href="mailto:pedidos@guilleoutes.com" style="color:${MUTE};">pedidos@guilleoutes.com</a>
                  ${footerNote ? `<br />${footerNote}` : ""}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export type OrderSummary = {
  orderRef: string;
  amountCents: number;
  shippingCents: number;
  /** Rate charged on this order, so the email matches the invoice. */
  vatRate: number;
  items: { name: string; size: string; qty: number; unitPriceCents: number }[];
  url: string;
};

/**
 * Item table, shared by the confirmation and the failure notice.
 *
 * The prices are tax-inclusive, as everywhere else in the shop; the base and the
 * tax are shown underneath the total, because an email that records a sale has to
 * show the split (RD 1619/2012) even though the customer never pays it separately.
 */
function itemsTable(order: OrderSummary, t: Dictionary): string {
  const tax = vatBreakdown(order.amountCents, order.vatRate);

  const rows = order.items
    .map(
      (item) => `
                  <tr>
                    <td style="padding:8px 0;border-bottom:1px solid #ececec;font-family:Arial,sans-serif;font-size:14px;color:#444444;">
                      ${escapeHtml(item.name)}<br />
                      <span style="color:${MUTE};font-size:12px;">${t.cart.size} ${escapeHtml(item.size)} · ×${item.qty}</span>
                    </td>
                    <td align="right" style="padding:8px 0;border-bottom:1px solid #ececec;font-family:Arial,sans-serif;font-size:14px;color:${INK};font-weight:bold;white-space:nowrap;">
                      ${formatPrice(item.unitPriceCents * item.qty)}
                    </td>
                  </tr>`,
    )
    .join("");

  return `
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
                  <tr>
                    <td colspan="2" style="padding:0 0 6px;font-family:Arial,sans-serif;font-size:11px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;color:${MUTE};">
                      ${t.order.reference} ${escapeHtml(order.orderRef)}
                    </td>
                  </tr>${rows}
                  <tr>
                    <td style="padding:8px 0;font-family:Arial,sans-serif;font-size:13px;color:${MUTE};">${t.cart.shipping}</td>
                    <td align="right" style="padding:8px 0;font-family:Arial,sans-serif;font-size:13px;color:#444444;">
                      ${order.shippingCents === 0 ? t.cart.free : formatPrice(order.shippingCents)}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0 0;border-top:2px solid ${INK};font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:${INK};text-transform:uppercase;">${t.cart.total}</td>
                    <td align="right" style="padding:10px 0 0;border-top:2px solid ${INK};font-family:Arial,sans-serif;font-size:17px;font-weight:bold;color:${INK};">
                      ${formatPrice(order.amountCents)}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0 0;font-family:Arial,sans-serif;font-size:12px;color:${MUTE};">${t.cart.taxBase}</td>
                    <td align="right" style="padding:10px 0 0;font-family:Arial,sans-serif;font-size:12px;color:${MUTE};">
                      ${formatPrice(tax.netCents)}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:2px 0 0;font-family:Arial,sans-serif;font-size:12px;color:${MUTE};">${t.cart.vat} (${formatVatRate(tax.rate)})</td>
                    <td align="right" style="padding:2px 0 0;font-family:Arial,sans-serif;font-size:12px;color:${MUTE};">
                      ${formatPrice(tax.vatCents)}
                    </td>
                  </tr>
                </table>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function plainItems(order: OrderSummary, t: Dictionary): string {
  const tax = vatBreakdown(order.amountCents, order.vatRate);
  const lines = order.items.map(
    (item) =>
      `- ${item.name} (${t.cart.size} ${item.size}, ×${item.qty}) ${formatPrice(
        item.unitPriceCents * item.qty,
      )}`,
  );
  return [
    `${t.order.reference} ${order.orderRef}`,
    ...lines,
    `${t.cart.shipping}: ${order.shippingCents === 0 ? t.cart.free : formatPrice(order.shippingCents)}`,
    `${t.cart.total}: ${formatPrice(order.amountCents)}`,
    `${t.cart.taxBase}: ${formatPrice(tax.netCents)}`,
    `${t.cart.vat} (${formatVatRate(tax.rate)}): ${formatPrice(tax.vatCents)}`,
  ].join("\n");
}

/* ------------------------------------------------------- payment confirmed */

export function orderPaidEmail(order: OrderSummary, t: Dictionary) {
  return {
    subject: `${t.mail.paidSubject} · ${order.orderRef}`,
    html: shell({
      title: t.mail.paidSubject,
      heading: t.order.paidThanksTitle,
      intro: t.order.paidThanksBody,
      body: itemsTable(order, t),
      cta: { label: t.mail.viewOrder, href: order.url },
      outro: t.mail.paidOutro,
    }),
    text: [t.order.paidThanksTitle, "", t.order.paidThanksBody, "", plainItems(order, t), "", order.url].join(
      "\n",
    ),
  };
}

/* ------------------------------------------------ payment attempt declined */

export function paymentRetryEmail(order: OrderSummary, attemptsLeft: number, t: Dictionary) {
  const intro = t.mail.retryBody.replace("{{left}}", String(attemptsLeft));

  return {
    subject: `${t.mail.retrySubject} · ${order.orderRef}`,
    html: shell({
      title: t.mail.retrySubject,
      heading: t.mail.retryHeading,
      intro,
      body: itemsTable(order, t),
      cta: { label: t.order.retry, href: order.url },
      outro: t.mail.retryOutro,
    }),
    text: [t.mail.retryHeading, "", intro, "", plainItems(order, t), "", order.url].join("\n"),
  };
}

/* ---------------------------------------------------------- newsletter */

/**
 * The double opt-in request.
 *
 * The only message an unconfirmed address ever receives. It says who we are and
 * what was asked for, because someone may be reading it having never filled in
 * the form — and for them, doing nothing has to be the safe option.
 */
export function newsletterConfirmEmail(
  subscription: { email: string; confirmUrl: string },
  t: Dictionary,
) {
  const n = t.mail.newsletter;

  return {
    subject: n.confirmSubject,
    html: shell({
      title: n.confirmSubject,
      heading: n.confirmHeading,
      intro: n.confirmBody,
      cta: { label: n.confirmCta, href: subscription.confirmUrl },
      outro: `${n.confirmIgnore}<br /><br /><span style="word-break:break-all;">${escapeHtml(
        subscription.confirmUrl,
      )}</span>`,
    }),
    text: [
      n.confirmHeading,
      "",
      n.confirmBody,
      "",
      subscription.confirmUrl,
      "",
      n.confirmIgnore,
    ].join("\n"),
  };
}

/** Sent once, after the address has proved it wants to be on the list. */
export function newsletterWelcomeEmail(
  subscription: { email: string; shopUrl: string; unsubscribeUrl: string },
  t: Dictionary,
) {
  const n = t.mail.newsletter;
  const unsubscribe = `<a href="${subscription.unsubscribeUrl}" style="color:${MUTE};">${n.unsubscribeLink}</a>`;

  return {
    subject: n.welcomeSubject,
    html: shell({
      title: n.welcomeSubject,
      heading: n.welcomeHeading,
      intro: n.welcomeBody,
      cta: { label: n.welcomeCta, href: subscription.shopUrl },
      footerNote: unsubscribe,
    }),
    text: [
      n.welcomeHeading,
      "",
      n.welcomeBody,
      "",
      subscription.shopUrl,
      "",
      `${n.unsubscribeLink}: ${subscription.unsubscribeUrl}`,
    ].join("\n"),
  };
}

/* --------------------------------------------- payment could not be taken */

export function paymentFailedEmail(order: OrderSummary, t: Dictionary) {
  return {
    subject: `${t.mail.failedSubject} · ${order.orderRef}`,
    html: shell({
      title: t.mail.failedSubject,
      heading: t.mail.failedHeading,
      intro: t.mail.failedBody,
      body: itemsTable(order, t),
      cta: { label: t.mail.viewOrder, href: order.url },
      outro: t.mail.failedOutro,
    }),
    text: [t.mail.failedHeading, "", t.mail.failedBody, "", plainItems(order, t), "", order.url].join(
      "\n",
    ),
  };
}
