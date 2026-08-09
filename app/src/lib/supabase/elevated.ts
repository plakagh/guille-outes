import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/env";

/**
 * The one place in this application that bypasses Row Level Security.
 *
 * ## Why it exists
 *
 * The payment gateway calls us back server-to-server. There is no user session
 * on that request — the caller is a bank — yet it has to move an order from
 * `pending` to `paid` and decrement stock. RLS has nothing to authorise against,
 * and no policy can express "trust this because the HMAC checked out", because
 * verifying the HMAC needs the merchant secret, which Postgres cannot decrypt.
 *
 * ## The boundary
 *
 *  - `import "server-only"` makes the build fail if this module is ever pulled
 *    into a Client Component, so the key cannot reach a browser bundle.
 *  - The variable is `SUPABASE_SERVICE_ROLE_KEY`, deliberately *without* the
 *    `NEXT_PUBLIC_` prefix, so Next.js will not inline it either.
 *  - Two callers import this. The Redsys callback route, for the reason above,
 *    and `lib/db/notifications.ts`, which reads the one admin-only column holding
 *    the address the shop is notified at — a read that has to work during a
 *    shopper's checkout and during a bank's callback, where no administrator is
 *    present to read it under their own session. The storefront, the account area
 *    and the admin panel all use the caller's own session, and everything they do
 *    is still enforced by RLS.
 *  - The callback verifies the signature *before* touching this client, and the
 *    status transition is idempotent.
 *
 * If you find yourself reaching for this anywhere else, the answer is almost
 * certainly an RLS policy instead.
 *
 * An alternative worth knowing about: move the callback into a Supabase Edge
 * Function, so the service key never lives in the web app at all. That splits
 * payment logic across two runtimes, which is why it is not the default here.
 */
export function createElevatedClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. The payment callback cannot record " +
        "results without it — see app/README.md (Security model).",
    );
  }

  return createSupabaseClient(SUPABASE_URL, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-application-name": "guille-outes-payment-callback" } },
  });
}
