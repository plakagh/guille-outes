import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";

/**
 * `not-found.tsx` cannot read route params, so it renders in the default
 * locale. The proxy guarantees a locale prefix on every real URL, so this only
 * shows for genuinely missing pages.
 */
export default async function NotFound() {
  const locale = DEFAULT_LOCALE;
  const t = await getDictionary(locale);

  return (
    <div className="shell flex flex-col items-start gap-5 py-24">
      <p className="font-display text-[clamp(5rem,18vw,12rem)] font-bold leading-none text-shell-deep">
        {t.notFound.code}
      </p>
      <h1 className="text-[clamp(2rem,5vw,3.25rem)] leading-[0.9]">{t.notFound.title}</h1>
      <p className="text-[0.9375rem] leading-relaxed text-mute">{t.notFound.blurb}</p>
      <div className="flex flex-wrap gap-3">
        <ButtonLink href={href(locale, "shop")}>{t.notFound.cta}</ButtonLink>
        <Link
          href={href(locale)}
          className="inline-flex h-12 items-center px-2 text-[0.875rem] underline hover:decoration-2"
        >
          {t.notFound.home}
        </Link>
      </div>
    </div>
  );
}
