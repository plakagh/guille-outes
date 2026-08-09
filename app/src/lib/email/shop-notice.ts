import "server-only";

import { getOrderNoticeEmail } from "@/lib/db/notifications";
import { canSendMail, sendMail } from "@/lib/email/mailer";
import { shopOrderEmail, type ShopNotice } from "@/lib/email/templates";
import { getDictionary } from "@/lib/i18n/dictionary";

/**
 * Tells the shop about an order.
 *
 * Always in Spanish, whatever language the customer was shopping in: this one is
 * read by the people who make and post the parcel, and the locale on the order
 * describes the buyer, not them.
 *
 * Silent about every reason it might not send — no address configured, no SMTP,
 * a mail server that is down. None of them is a reason to fail a checkout or to
 * leave a paid order unsettled, and each one is already logged where it happens.
 */
export async function sendShopNotice(notice: ShopNotice): Promise<void> {
  if (!canSendMail()) return;

  const to = await getOrderNoticeEmail();
  if (!to) return;

  const t = await getDictionary("es");
  await sendMail({ to, ...shopOrderEmail(notice, t) });
}
