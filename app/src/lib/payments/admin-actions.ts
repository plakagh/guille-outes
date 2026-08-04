"use server";

import { revalidatePath } from "next/cache";
import { savePaymentSettings } from "@/lib/payments/settings";

export type SaveState = { ok?: true; error?: string };

/**
 * Thin wrapper so the admin form can post directly. All validation and the
 * admin check live in `savePaymentSettings`, which is also where the merchant
 * secret gets encrypted before it touches the database.
 */
export async function saveRedsysSettings(form: FormData): Promise<SaveState> {
  const text = (key: string) => String(form.get(key) ?? "").trim();

  const rawSecret = text("secret_key");
  const environment = text("environment") === "live" ? "live" : "test";

  const result = await savePaymentSettings({
    enabled: form.get("enabled") === "on",
    environment,
    merchantCode: text("merchant_code"),
    terminal: text("terminal") || "1",
    merchantName: text("merchant_name"),
    currency: 978,
    maxAttempts: Number(text("max_attempts")) || 3,
    // An empty field means "keep the key you already have".
    secretKey: rawSecret === "" ? undefined : rawSecret,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/", "layout");
  return { ok: true };
}
