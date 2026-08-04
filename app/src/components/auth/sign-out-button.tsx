import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/config";

/** Sign-out is a POST via Server Action, so it cannot be triggered by a GET. */
export function SignOutButton({ locale, label }: { locale: Locale; label: string }) {
  return (
    <form action={signOut}>
      <input type="hidden" name="locale" value={locale} />
      <Button type="submit" variant="outline">
        {label}
      </Button>
    </form>
  );
}
