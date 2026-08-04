import "server-only";

import type { Locale } from "@/lib/i18n/config";
import { LEGAL_VERSION } from "@/lib/legal/version";
import { createClient, getUser } from "@/lib/supabase/server";

export type ConsentKind = "terms" | "marketing";

/**
 * Appends a consent record. Withdrawal is a new row with `granted: false`, never
 * an update — the history is the evidence.
 */
export async function recordConsent(input: {
  kind: ConsentKind;
  granted: boolean;
  source: "signup" | "account" | "newsletter";
  locale: Locale;
}): Promise<boolean> {
  const user = await getUser();
  if (!user) return false;

  const supabase = await createClient();
  const { error } = await supabase.from("user_consents").insert({
    user_id: user.id,
    kind: input.kind,
    granted: input.granted,
    doc_version: LEGAL_VERSION,
    source: input.source,
    locale: input.locale,
  });

  return !error;
}

/** Current state of one consent, taken from the newest record. */
export async function hasConsent(kind: ConsentKind): Promise<boolean> {
  const user = await getUser();
  if (!user) return false;

  const supabase = await createClient();
  const { data } = await supabase
    .from("user_consents")
    .select("granted")
    .eq("kind", kind)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as { granted: boolean } | null)?.granted === true;
}
