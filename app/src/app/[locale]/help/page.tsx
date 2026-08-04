import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "@/components/icons";
import { Breadcrumbs } from "@/components/ui/bits";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";
import { helpDocs, legalDocs, type Topic } from "@/lib/pages";

export async function generateMetadata(props: PageProps<"/[locale]/help">): Promise<Metadata> {
  const { locale } = await props.params;
  if (!isLocale(locale)) return {};
  const t = await getDictionary(locale);
  return { title: t.help.title, description: t.help.blurb };
}

export default async function HelpHub(props: PageProps<"/[locale]/help">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();

  const t = await getDictionary(locale);
  const help = helpDocs(locale);
  const legal = legalDocs(locale);

  const groups: { id: Topic; heading: string; docs: typeof help; base: "help" | "legal" }[] = [
    { id: "orders", heading: t.help.topics.orders, docs: help.filter((d) => d.topic === "orders"), base: "help" },
    { id: "product", heading: t.help.topics.product, docs: help.filter((d) => d.topic === "product"), base: "help" },
    { id: "brand", heading: t.help.topics.brand, docs: help.filter((d) => d.topic === "brand"), base: "help" },
    { id: "legal", heading: t.help.topics.legal, docs: legal, base: "legal" },
  ];

  return (
    <div className="shell py-6 lg:py-10">
      <Breadcrumbs
        label={t.plp.breadcrumbHome}
        trail={[{ label: t.plp.breadcrumbHome, href: href(locale) }, { label: t.help.title }]}
        className="mb-5"
      />

      <p className="eyebrow mb-3 text-flame">{t.help.eyebrow}</p>
      <h1 className="text-[clamp(2rem,5vw,3.5rem)] leading-[0.9]">{t.help.title}</h1>
      <p className="mt-3 max-w-2xl text-[1.0625rem] leading-relaxed text-mute">{t.help.blurb}</p>

      <div className="mt-10 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
        {groups.map((group) => (
          <section key={group.id}>
            <h2 className="mb-3 border-b border-line pb-2 text-lg">{group.heading}</h2>
            <ul className="space-y-2.5">
              {group.docs.map((doc) => (
                <li key={doc.slug}>
                  <Link
                    href={href(locale, group.base, doc.slug)}
                    className="group inline-flex items-start gap-1.5 text-[0.9375rem]"
                  >
                    <span className="group-hover:underline">{doc.title}</span>
                    <ArrowRight className="mt-1 size-3.5 shrink-0 transition-transform group-hover:translate-x-1" />
                  </Link>
                  <p className="text-[0.8125rem] text-mute">{doc.summary}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
