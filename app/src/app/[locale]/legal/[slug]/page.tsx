import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DocArticle } from "@/components/content/doc-article";
import { isLocale, LOCALE_META, LOCALES } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";
import { LEGAL_SLUGS, findLegalDoc, helpSlug, legalDocs } from "@/lib/pages";

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => LEGAL_SLUGS.map((slug) => ({ locale, slug })));
}

export async function generateMetadata(
  props: PageProps<"/[locale]/legal/[slug]">,
): Promise<Metadata> {
  const { locale, slug } = await props.params;
  if (!isLocale(locale)) return {};
  const doc = findLegalDoc(slug, locale);
  if (!doc) return {};

  return {
    title: doc.title,
    description: doc.summary,
    alternates: {
      canonical: href(locale, "legal", doc.slugs[locale]),
      languages: Object.fromEntries(
        LOCALES.map((other) => [
          LOCALE_META[other].hrefLang,
          href(other, "legal", doc.slugs[other]),
        ]),
      ),
    },
  };
}

export default async function LegalPage(props: PageProps<"/[locale]/legal/[slug]">) {
  const { locale, slug } = await props.params;
  if (!isLocale(locale)) notFound();

  const t = await getDictionary(locale);
  const doc = findLegalDoc(slug, locale);
  if (!doc) notFound();

  // A slug written in another language resolves, then redirects here, so only one
  // URL per language is ever indexed.
  if (doc.slug !== slug) redirect(href(locale, "legal", doc.slug));

  const siblings = legalDocs(locale).map((candidate) => ({
    slug: candidate.slug,
    title: candidate.title,
    href: href(locale, "legal", candidate.slug),
  }));

  return (
    <DocArticle
      doc={doc}
      t={t}
      contactHref={href(locale, "help", helpSlug("contacto", locale))}
      siblings={siblings}
      trail={[
        { label: t.plp.breadcrumbHome, href: href(locale) },
        { label: t.help.topics.legal, href: href(locale, "help") },
        { label: doc.title },
      ]}
    />
  );
}
