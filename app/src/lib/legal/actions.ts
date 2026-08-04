"use server";

import { revalidatePath } from "next/cache";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { recordConsent } from "@/lib/legal/consent";

export type ConsentState = { ok?: true; error?: string };

/**
 * Grants or withdraws marketing consent.
 *
 * Withdrawal has to be as easy as giving it (RGPD Art. 7(3)), which is why this
 * is one click in the account area and not an email to support. Each change
 * appends a record; nothing is overwritten.
 */
export async function setMarketingConsent(form: FormData): Promise<ConsentState> {
  const raw = String(form.get("locale") ?? "");
  const locale: Locale = isLocale(raw) ? raw : "es";
  const granted = form.get("granted") === "true";

  const done = await recordConsent({ kind: "marketing", granted, source: "account", locale });
  if (!done) return { error: "failed" };

  revalidatePath("/", "layout");
  return { ok: true };
}
