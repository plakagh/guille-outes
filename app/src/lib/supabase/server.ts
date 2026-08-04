import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * The session is read from — and written back to — the request cookies. Nothing
 * about the session is stored on the server: there is no session table, no
 * in-memory map and no module-level cache. Every request re-reads the cookie,
 * so one visitor's tokens can never be served to another.
 *
 * Never cache or memoise the returned client across requests.
 */
export async function createClient() {
  const store = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            store.set(name, value, options);
          }
        } catch {
          // Server Components get a read-only cookie store. Token refresh is
          // handled in `proxy.ts`, which can write, so swallowing this is safe.
        }
      },
    },
  });
}

/**
 * The signed-in user, or null.
 *
 * Uses `getUser()`, never `getSession()`: `getSession()` only decodes the cookie
 * and will happily return a forged or expired payload, while `getUser()`
 * validates the JWT against the auth server. Any authorisation decision must
 * come from this function.
 */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) return null;
  return user;
}

export type Viewer = {
  id: string;
  email: string | null;
  fullName: string | null;
  isAdmin: boolean;
};

/**
 * The signed-in user plus their profile row, or null when signed out.
 *
 * `is_admin` is read from the database under the caller's own RLS context — the
 * flag is never taken from a cookie, a JWT claim or a client-supplied value, so
 * it cannot be spoofed by the browser.
 */
export async function getViewer(): Promise<Viewer | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? null,
    fullName: profile?.full_name ?? null,
    isAdmin: profile?.is_admin === true,
  };
}
