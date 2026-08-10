import "server-only";

import { frameLabel, type FrameChoice } from "@/lib/catalog";
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
  /** The code used, snapshotted on the order. Null when there was none. */
  discountCode?: string | null;
  /** Cents taken off, waived delivery included. */
  discountCents?: number;
  /** Rate charged on this order, so the email matches the invoice. */
  vatRate: number;
  items: {
    name: string;
    size: string;
    qty: number;
    unitPriceCents: number;
    /** The child's drawing printed on this line, when there is one. */
    artworkTitle?: string | null;
    /**
     * The frame this line was bought with, or `"none"` for the print alone. Null
     * for anything not sold framed — a t-shirt has no answer to give here.
     */
    frameFinish?: FrameChoice | null;
  }[];
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
                      <span style="color:${MUTE};font-size:12px;">${t.cart.size} ${escapeHtml(item.size)} · ×${item.qty}</span>${
                        item.frameFinish
                          ? // The frame is what the workshop has to fit and what
                            // the buyer chose, so it is on the line rather than
                            // in a footnote.
                            `<br /><span style="color:${INK};font-size:12px;font-weight:bold;">${escapeHtml(
                              frameLabel(item.frameFinish, t.pdp),
                            )}</span>`
                          : ""
                      }${
                        item.artworkTitle
                          ? `<br /><span style="color:${MUTE};font-size:12px;">${t.gallery.printedWith} «${escapeHtml(item.artworkTitle)}»</span>`
                          : ""
                      }
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
                  ${
                    (order.discountCents ?? 0) > 0
                      ? `<tr>
                    <td style="padding:8px 0;font-family:Arial,sans-serif;font-size:13px;color:${MUTE};">${t.cart.discount}${
                      order.discountCode ? ` ${escapeHtml(order.discountCode)}` : ""
                    }</td>
                    <td align="right" style="padding:8px 0;font-family:Arial,sans-serif;font-size:13px;color:#1f6f4a;">
                      −${formatPrice(order.discountCents ?? 0)}
                    </td>
                  </tr>`
                      : ""
                  }
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
      `- ${item.name} (${t.cart.size} ${item.size}, ×${item.qty})${
        item.frameFinish ? ` — ${frameLabel(item.frameFinish, t.pdp)}` : ""
      }${item.artworkTitle ? ` — ${t.gallery.printedWith} «${item.artworkTitle}»` : ""} ${formatPrice(
        item.unitPriceCents * item.qty,
      )}`,
  );
  return [
    `${t.order.reference} ${order.orderRef}`,
    ...lines,
    `${t.cart.shipping}: ${order.shippingCents === 0 ? t.cart.free : formatPrice(order.shippingCents)}`,
    ...((order.discountCents ?? 0) > 0
      ? [
          `${t.cart.discount}${order.discountCode ? ` ${order.discountCode}` : ""}: −${formatPrice(
            order.discountCents ?? 0,
          )}`,
        ]
      : []),
    `${t.cart.total}: ${formatPrice(order.amountCents)}`,
    `${t.cart.taxBase}: ${formatPrice(tax.netCents)}`,
    `${t.cart.vat} (${formatVatRate(tax.rate)}): ${formatPrice(tax.vatCents)}`,
  ].join("\n");
}

/* ------------------------------------------------- the shop's own notice --
 *
 * Not a customer email: this one goes to the shop when the bank confirms the
 * order. Its reason for existing is the frame. A cuadro can be ordered in black,
 * white, wood or on its own, and nothing else in the shop's day tells them
 * which, so the finishes get their own block above the order rather than living
 * as small print on a line.
 */

export type ShopNotice = {
  order: OrderSummary;
  stage: "paid";
  customer: {
    name: string;
    email: string;
    phone: string | null;
    /** The shipping address, one line per line, already in order. */
    address: string[];
  };
};

/**
 * Every line that had a frame to decide about, and what was decided.
 *
 * "Sin marco" is listed as loudly as an acabado: it is the difference between
 * posting a parcel and building one, and it is not something to infer from an
 * absence halfway down an invoice.
 */
function framedLines(order: OrderSummary, t: Dictionary) {
  return order.items.flatMap((item) =>
    item.frameFinish
      ? [{ item, label: frameLabel(item.frameFinish, t.pdp) }]
      : [],
  );
}

/** The frames to fit, spelled out above everything else in the notice. */
function frameBlock(order: OrderSummary, t: Dictionary): string {
  const framed = framedLines(order, t);
  const s = t.mail.shop;

  const rows = framed.length
    ? framed
        .map(
          ({ item, label }) => `
                    <li style="margin:0 0 6px;">
                      <strong>${escapeHtml(label)}</strong> —
                      ${escapeHtml(item.name)} · ${t.cart.size} ${escapeHtml(item.size)} · ×${item.qty}
                    </li>`,
        )
        .join("")
    : `<li style="margin:0;color:${MUTE};">${s.noFrames}</li>`;

  return `
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
                  <tr>
                    <td style="border-left:4px solid ${FLAME};background-color:${SHELL};padding:16px 18px;">
                      <p style="font-family:Arial,sans-serif;font-size:11px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;color:${MUTE};margin:0 0 10px;">
                        ${s.frames}
                      </p>
                      <ul style="font-family:Arial,sans-serif;font-size:14px;color:${INK};line-height:1.6;margin:0;padding-left:18px;">${rows}
                      </ul>
                    </td>
                  </tr>
                </table>`;
}

/** Who bought it and where it goes — everything needed to pack the parcel. */
function customerBlock(notice: ShopNotice, t: Dictionary): string {
  const s = t.mail.shop;
  const { customer } = notice;

  const contact = [
    escapeHtml(customer.name),
    `<a href="mailto:${escapeHtml(customer.email)}" style="color:${INK};">${escapeHtml(customer.email)}</a>`,
    ...(customer.phone ? [escapeHtml(customer.phone)] : []),
  ].join("<br />");

  const address = customer.address.map(escapeHtml).join("<br />");

  return `
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
                  <tr>
                    <td style="border:1px solid #ececec;padding:16px 18px;">
                      <p style="font-family:Arial,sans-serif;font-size:11px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;color:${MUTE};margin:0 0 10px;">
                        ${s.customer}
                      </p>
                      <p style="font-family:Arial,sans-serif;font-size:14px;color:#444444;line-height:1.7;margin:0 0 12px;">
                        ${contact}
                      </p>
                      <p style="font-family:Arial,sans-serif;font-size:11px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;color:${MUTE};margin:0 0 6px;">
                        ${s.shipTo}
                      </p>
                      <p style="font-family:Arial,sans-serif;font-size:14px;color:#444444;line-height:1.7;margin:0;">
                        ${address}
                      </p>
                    </td>
                  </tr>
                </table>`;
}

export function shopOrderEmail(notice: ShopNotice, t: Dictionary) {
  const s = t.mail.shop;
  const { order } = notice;

  const subject = `${s.paidSubject} · ${order.orderRef}`;

  return {
    subject,
    html: shell({
      title: subject,
      heading: s.paidHeading,
      intro: s.paidBody,
      body: frameBlock(order, t) + customerBlock(notice, t) + itemsTable(order, t),
      cta: { label: t.mail.viewOrder, href: order.url },
    }),
    text: [
      s.paidHeading,
      "",
      s.paidBody,
      "",
      s.frames,
      ...(framedLines(order, t).length > 0
        ? framedLines(order, t).map(
            ({ item, label }) =>
              `- ${label} — ${item.name} · ${t.cart.size} ${item.size} · ×${item.qty}`,
          )
        : [s.noFrames]),
      "",
      s.customer,
      notice.customer.name,
      notice.customer.email,
      ...(notice.customer.phone ? [notice.customer.phone] : []),
      "",
      s.shipTo,
      ...notice.customer.address,
      "",
      plainItems(order, t),
      "",
      order.url,
    ].join("\n"),
  };
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

/**
 * The welcome discount, set as type in a box.
 *
 * The code is the only thing in this email that has to survive being copied by
 * hand off a phone screen, so it is large, monospaced, letter-spaced and on its
 * own line — and it is text rather than an image, because a code inside a blocked
 * image is a code nobody can use. The expiry sits under it: a discount with a date
 * on it is a discount somebody uses.
 */
function codeBlock(discount: WelcomeDiscount, t: Dictionary): string {
  const n = t.mail.newsletter;

  return `
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px;">
                  <tr>
                    <td align="center" style="border:2px dashed ${INK};background-color:${SHELL};padding:22px 18px;">
                      <p style="font-family:Arial,sans-serif;font-size:11px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;color:${MUTE};margin:0 0 10px;">
                        ${n.codeEyebrow.replace("{{percent}}", String(discount.percent))}
                      </p>
                      <p style="font-family:'Courier New',Courier,monospace;font-size:26px;font-weight:bold;letter-spacing:2px;color:${INK};margin:0;">
                        ${escapeHtml(discount.code)}
                      </p>
                      <p style="font-family:Arial,sans-serif;font-size:12px;color:${MUTE};margin:12px 0 0;line-height:1.6;">
                        ${n.codeExpires.replace("{{date}}", escapeHtml(discount.expires))}<br />${n.codeSingleUse}
                      </p>
                    </td>
                  </tr>
                </table>`;
}

/** The offer as the welcome email needs it: no cents, no ids, a formatted date. */
export type WelcomeDiscount = {
  code: string;
  percent: number;
  /** Already formatted for the subscriber's locale by the caller. */
  expires: string;
};

/**
 * Sent once, after the address has proved it wants to be on the list.
 *
 * The discount is optional and its absence is not a failure: someone who
 * unsubscribed and came back has already had their welcome offer, and this email
 * then says welcome back without inventing a second one.
 */
export function newsletterWelcomeEmail(
  subscription: {
    email: string;
    shopUrl: string;
    unsubscribeUrl: string;
    discount?: WelcomeDiscount | null;
  },
  t: Dictionary,
) {
  const n = t.mail.newsletter;
  const unsubscribe = `<a href="${subscription.unsubscribeUrl}" style="color:${MUTE};">${n.unsubscribeLink}</a>`;
  const { discount } = subscription;

  const subject = discount
    ? n.welcomeCodeSubject.replace("{{percent}}", String(discount.percent))
    : n.welcomeSubject;

  const intro = discount
    ? n.welcomeCodeBody.replace("{{percent}}", String(discount.percent))
    : n.welcomeBody;

  return {
    subject,
    html: shell({
      title: subject,
      heading: n.welcomeHeading,
      intro,
      body: discount ? codeBlock(discount, t) : "",
      cta: { label: discount ? n.welcomeCodeCta : n.welcomeCta, href: subscription.shopUrl },
      footerNote: unsubscribe,
    }),
    text: [
      n.welcomeHeading,
      "",
      intro,
      ...(discount
        ? [
            "",
            `${n.codeEyebrow.replace("{{percent}}", String(discount.percent))}: ${discount.code}`,
            n.codeExpires.replace("{{date}}", discount.expires),
            n.codeSingleUse,
          ]
        : []),
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
