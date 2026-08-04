import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DocArticle } from "@/components/content/doc-article";
import { isLocale, LOCALE_META, LOCALES } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";
import { HELP_SLUGS, findHelpDoc, helpDocs, helpSlug } from "@/lib/pages";

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => HELP_SLUGS.map((topic) => ({ locale, topic })));
}

export async function generateMetadata(
  props: PageProps<"/[locale]/help/[topic]">,
): Promise<Metadata> {
  const { locale, topic } = await props.params;
  if (!isLocale(locale)) return {};
  const doc = findHelpDoc(topic, locale);
  if (!doc) return {};

  return {
    title: doc.title,
    description: doc.summary,
    keywords: doc.keywords,
    alternates: {
      canonical: href(locale, "help", doc.slugs[locale]),
      languages: Object.fromEntries(
        LOCALES.map((other) => [
          LOCALE_META[other].hrefLang,
          href(other, "help", doc.slugs[other]),
        ]),
      ),
    },
  };
}

export default async function HelpTopicPage(props: PageProps<"/[locale]/help/[topic]">) {
  const { locale, topic } = await props.params;
  if (!isLocale(locale)) notFound();

  const t = await getDictionary(locale);
  const doc = findHelpDoc(topic, locale);
  if (!doc) notFound();

  // A slug written in another language resolves, then redirects here, so only one
  // URL per language is ever indexed.
  if (doc.slug !== topic) redirect(href(locale, "help", doc.slug));

  const siblings = helpDocs(locale)
    .filter((candidate) => candidate.topic === doc.topic)
    .map((candidate) => ({
      slug: candidate.slug,
      title: candidate.title,
      href: href(locale, "help", candidate.slug),
    }));

  return (
    <DocArticle
      doc={doc}
      t={t}
      contactHref={href(locale, "help", helpSlug("contacto", locale))}
      siblings={siblings}
      trail={[
        { label: t.plp.breadcrumbHome, href: href(locale) },
        { label: t.help.title, href: href(locale, "help") },
        { label: doc.title },
      ]}
    />
  );
}
