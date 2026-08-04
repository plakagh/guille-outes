import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { RegisterForm } from "@/app/[locale]/register/register-form";
import { Breadcrumbs } from "@/components/ui/bits";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";
import { getViewer } from "@/lib/supabase/server";

export async function generateMetadata(props: PageProps<"/[locale]/register">): Promise<Metadata> {
  const { locale } = await props.params;
  if (!isLocale(locale)) return {};
  const t = await getDictionary(locale);
  return {
    title: t.auth.registerTitle,
    description: t.auth.registerBlurb,
    robots: { index: false, follow: false },
  };
}

export default async function RegisterPage(props: PageProps<"/[locale]/register">) {
  const [{ locale }, searchParams] = await Promise.all([props.params, props.searchParams]);
  if (!isLocale(locale)) notFound();

  const [t, viewer] = await Promise.all([getDictionary(locale), getViewer()]);
  if (viewer) redirect(href(locale, "account"));

  const raw = searchParams.next;
  const next = typeof raw === "string" ? raw : undefined;

  return (
    <div className="shell py-10 lg:py-16">
      <Breadcrumbs
        label={t.plp.breadcrumbHome}
        trail={[
          { label: t.plp.breadcrumbHome, href: href(locale) },
          { label: t.auth.registerTitle },
        ]}
        className="mb-6"
      />
      <h1 className="text-[clamp(2rem,5vw,3.25rem)] leading-[0.9]">{t.auth.registerTitle}</h1>
      <p className="mt-3 max-w-md text-[0.9375rem] text-mute">{t.auth.registerBlurb}</p>
      <RegisterForm next={next} />
    </div>
  );
}
