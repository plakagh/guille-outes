/**
 * Supabase connection details.
 *
 * Both values are public by design: the URL and the publishable ("anon") key
 * are shipped to the browser, and Row Level Security is what actually protects
 * the data. The secret / service-role key is deliberately absent from this
 * application — see README ("Security model"). If you ever find yourself
 * wanting it here, the correct fix is an RLS policy or a database function.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy app/.env.example to app/.env.local and fill it in ` +
        `with the values printed by \`supabase status\` in infra/.`,
    );
  }
  return value;
}

export const SUPABASE_URL = required(
  "NEXT_PUBLIC_SUPABASE_URL",
  process.env.NEXT_PUBLIC_SUPABASE_URL,
);

export const SUPABASE_ANON_KEY = required(
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Public URL of an object in the `media` bucket. */
export function mediaUrl(storagePath: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/media/${storagePath}`;
}
