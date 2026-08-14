import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaintStudio } from "@/components/gallery/paint-studio";
import { Breadcrumbs } from "@/components/ui/bits";
import { isLocale, LOCALE_META, LOCALES } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";
import { legalSlug } from "@/lib/pages";
import { getUser } from "@/lib/supabase/server";

export async function generateMetadata(
  props: PageProps<"/[locale]/gallery/studio">,
): Promise<Metadata> {
  const { locale } = await props.params;
  if (!isLocale(locale)) return {};
  const t = await getDictionary(locale);

  return {
    title: t.gallery.studio.title,
    description: t.gallery.studio.blurb,
    alternates: {
      canonical: href(locale, "studio"),
      languages: Object.fromEntries(
        LOCALES.map((other) => [LOCALE_META[other].hrefLang, href(other, "studio")]),
      ),
    },
  };
}

/**
 * El taller.
 *
 * The page is a thin server shell: it resolves the two things the studio cannot
 * work out for itself — whether anybody is signed in, and where the privacy
 * notice lives in this language — and hands the canvas over to the browser.
 *
 * Note what it does *not* do: there is no sign-in gate. Painting is open to
 * everyone, and the account is only asked for at the moment a drawing would
 * become public. A child at a fair should be drawing within one tap of arriving.
 */
export default async function StudioPage(props: PageProps<"/[locale]/gallery/studio">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();

  const [t, user] = await Promise.all([getDictionary(locale), getUser()]);

  return (
    <div className="shell py-6 lg:py-8">
      <Breadcrumbs
        label={t.plp.breadcrumbHome}
        trail={[
          { label: t.plp.breadcrumbHome, href: href(locale) },
          { label: t.gallery.title, href: href(locale, "gallery") },
          { label: t.gallery.studio.title },
        ]}
        className="mb-4"
      />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2 text-ink-soft">{t.gallery.eyebrow}</p>
          <h1 className="text-[clamp(1.75rem,4vw,2.75rem)] leading-[0.95]">
            {t.gallery.studio.title}
          </h1>
        </div>
        <p className="text-[0.9375rem] leading-relaxed text-mute">
          {t.gallery.studio.blurb}
        </p>
      </div>

      <PaintStudio
        signedIn={user !== null}
        returnTo={href(locale, "studio")}
        privacyHref={href(locale, "legal", legalSlug("privacidad", locale))}
      />
    </div>
  );
}
