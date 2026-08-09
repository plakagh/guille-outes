import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/bits";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Block, Doc } from "@/lib/pages";

/** Renders a help or legal article from its resolved content blocks. */
export function DocArticle({
  doc,
  t,
  trail,
  siblings,
  contactHref,
}: {
  doc: Doc;
  t: Dictionary;
  trail: { label: string; href?: string }[];
  /** Other articles in the same group, rendered as an aside nav. */
  siblings: { slug: string; title: string; href: string }[];
  contactHref: string;
}) {
  return (
    <div className="shell py-6 lg:py-10">
      <Breadcrumbs trail={trail} className="mb-5" label={t.plp.breadcrumbHome} />

      <div className="grid gap-10 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-16">
        <aside className="lg:sticky lg:top-[calc(var(--spacing-masthead)+var(--spacing-navbar)+1.5rem)] lg:self-start">
          <p className="eyebrow mb-3 border-b border-line pb-2 text-mute">
            {t.help.inThisSection}
          </p>
          <ul className="space-y-1.5">
            {siblings.map((item) => (
              <li key={item.slug}>
                <Link
                  href={item.href}
                  aria-current={item.slug === doc.slug ? "page" : undefined}
                  className={
                    item.slug === doc.slug
                      ? "text-[0.875rem] font-semibold"
                      : "text-[0.875rem] text-mute hover:text-ink hover:underline"
                  }
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </aside>

        <article>
          <h1 className="text-[clamp(2rem,5vw,3.25rem)] leading-[0.9]">{doc.title}</h1>
          <p className="mt-3 max-w-3xl text-[1.0625rem] leading-relaxed text-mute">{doc.summary}</p>

          {/*
            The sections flow into as many columns of ~28rem as the shell can
            fit rather than sitting in a single 42rem strip: on a 1600px page
            that was half the width left empty, and a single column that wide
            would run to unreadable line lengths. Sections never split across a
            column, so each one still reads top to bottom.
          */}
          <div className="mt-8 columns-[28rem] gap-16">
            {doc.sections.map((section, i) => (
              <section key={section.heading ?? i} className="mb-8 break-inside-avoid">
                {section.heading && <h2 className="mb-3 text-xl">{section.heading}</h2>}
                <div className="space-y-4">
                  {section.blocks.map((block, j) => (
                    <BlockView key={j} block={block} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-12 border-t border-line pt-6">
            <p className="text-[0.875rem] text-mute">
              {t.help.notFound}{" "}
              <Link href={contactHref} className="font-semibold text-ink underline">
                {t.help.writeUs}
              </Link>{" "}
              {t.help.replyTime}
            </p>
          </div>
        </article>
      </div>
    </div>
  );
}

function BlockView({ block }: { block: Block }) {
  if (block.type === "p") {
    return <p className="text-[0.9375rem] leading-relaxed text-ink/80">{block.text}</p>;
  }

  /*
    A term that is not the same as the surrounding ones. The frame and the accent
    rule are doing real work here rather than decorating: "this cannot be
    returned" sitting as the fourth paragraph of a page about returning things is
    a sentence a reader skims past, and then finds out about after paying.
  */
  if (block.type === "note") {
    return (
      <p className="border border-line border-l-2 border-l-flame bg-shell p-4 text-[0.9375rem] font-semibold leading-relaxed text-ink">
        {block.text}
      </p>
    );
  }

  if (block.type === "list") {
    return (
      <ul className="space-y-2">
        {block.items.map((item) => (
          <li
            key={item}
            className="relative pl-5 text-[0.9375rem] leading-relaxed text-ink/80 before:absolute before:left-0 before:top-[0.6em] before:size-1.5 before:bg-flame"
          >
            {item}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] border-collapse text-[0.875rem]">
        <thead>
          <tr className="border-b-2 border-ink">
            {block.head.map((cell) => (
              <th key={cell} className="py-2.5 pr-4 text-left font-display font-bold uppercase">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row) => (
            <tr key={row.join("-")} className="border-b border-line-soft">
              {row.map((cell, i) => (
                <td
                  key={i}
                  className={i === 0 ? "py-2.5 pr-4 font-semibold" : "py-2.5 pr-4 text-ink/75"}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
