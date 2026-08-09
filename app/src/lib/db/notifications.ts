import "server-only";

import { createElevatedClient } from "@/lib/supabase/elevated";

/**
 * Where the shop is told about an order.
 *
 * ## Why this reads through the service role
 *
 * The address is admin-only in the database: it is an internal mailbox, not
 * public information like the shipping rates, and a signed-in customer has no
 * business querying it. But the two places that need it have no administrator
 * present — a checkout runs as the shopper, and the payment callback runs as a
 * bank — so neither can read the row under its own session.
 *
 * The alternative would be a policy letting every authenticated visitor read it,
 * which is exactly the leak the admin-only policy exists to prevent. So this is
 * the second and last caller of the elevated client, and it is deliberately
 * narrow: one column, one row, read-only, and nothing about it depends on
 * anything the caller sent.
 */
export async function getOrderNoticeEmail(): Promise<string | null> {
  try {
    const supabase = createElevatedClient();
    const { data, error } = await supabase
      .from("notification_settings")
      .select("order_email")
      .maybeSingle();

    if (error) {
      console.error("[notifications] could not read the notice address", error);
      return null;
    }

    const email = (data as { order_email: string | null } | null)?.order_email?.trim();
    return email ? email : null;
  } catch (error) {
    // No service-role key in this environment. A shop notice is never worth
    // failing a checkout over, so it is logged and skipped.
    console.warn("[notifications] no elevated client available", error);
    return null;
  }
}
