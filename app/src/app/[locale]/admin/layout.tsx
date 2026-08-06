import Link from "next/link";
import { notFound } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Monogram } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";
import { getViewer } from "@/lib/supabase/server";

/**
 * Admin guard.
 *
 * `getViewer()` calls `supabase.auth.getUser()` (which validates the JWT with
 * the auth server) and then reads `profiles.is_admin` from the database under
 * the caller's own RLS context. Nothing here trusts a cookie value, a JWT claim
 * or anything the browser could set. Even so, this is only the *UI* gate: the
 * write policies in Postgres are what make it safe.
 */
export default async function AdminLayout({ children, params }: LayoutProps<"/[locale]/admin">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [t, viewer] = await Promise.all([getDictionary(locale), getViewer()]);

  if (!viewer) {
    return (
      <div className="shell py-20">
        <h1 className="text-3xl">{t.admin.forbidden}</h1>
        <p className="mt-3 max-w-lg text-[0.9375rem] text-mute">{t.auth.signInBlurb}</p>
        <ButtonLink href={`${href(locale, "login")}?next=${encodeURIComponent(href(locale, "admin"))}`} className="mt-6">
          {t.auth.signIn}
        </ButtonLink>
      </div>
    );
  }

  if (!viewer.isAdmin) {
    return (
      <div className="shell py-20">
        <h1 className="text-3xl">{t.admin.forbidden}</h1>
        <p className="mt-3 max-w-lg text-[0.9375rem] text-mute">{t.admin.forbiddenBlurb}</p>
        <ButtonLink href={href(locale)} variant="outline" className="mt-6">
          {t.notFound.home}
        </ButtonLink>
      </div>
    );
  }

  const tabs = [
    { label: t.admin.overview, href: href(locale, "admin") },
    { label: t.admin.products, href: `${href(locale, "admin")}/products` },
    { label: t.gallery.admin.tab, href: `${href(locale, "admin")}/gallery` },
    { label: t.admin.discounts.tab, href: `${href(locale, "admin")}/discounts` },
    { label: t.payments.title, href: `${href(locale, "admin")}/payments` },
    { label: t.admin.shop.tab, href: `${href(locale, "admin")}/settings` },
    { label: t.admin.newsletter.tab, href: `${href(locale, "admin")}/newsletter` },
  ];

  return (
    <div className="bg-shell">
      <div className="border-b border-line bg-white">
        <div className="shell flex flex-wrap items-center gap-4 py-4">
          <Monogram className="size-8" inverted />
          <div className="mr-auto">
            <p className="eyebrow text-flame">{t.admin.eyebrow}</p>
            <p className="font-display text-xl font-bold uppercase leading-none">
              {t.admin.title}
            </p>
          </div>
          <p className="text-[0.8125rem] text-mute">{viewer.email}</p>
          <SignOutButton locale={locale} label={t.auth.signOut} />
        </div>

        <nav className="shell flex gap-1 pb-2" aria-label={t.admin.title}>
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="border-b-2 border-transparent px-3 pb-2 font-display text-[0.9375rem] font-bold uppercase tracking-wide hover:border-ink"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="min-h-[60vh]">{children}</div>
    </div>
  );
}
