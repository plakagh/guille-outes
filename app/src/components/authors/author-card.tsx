import Link from "next/link";
import { ArrowRight } from "@/components/icons";
import type { Author } from "@/lib/catalog";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { mediaUrl } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";

/** Initials fallback when no photo has been uploaded yet. */
export function AuthorAvatar({
  author,
  className,
}: {
  author: Pick<Author, "name" | "photoPath">;
  className?: string;
}) {
  const initials = author.name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("");

  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full bg-shell-deep font-display font-bold uppercase leading-none",
        className,
      )}
    >
      {author.photoPath ? (
        // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL, sized by CSS
        <img
          src={mediaUrl(author.photoPath)}
          alt={author.name}
          className="size-full object-cover"
        />
      ) : (
        initials
      )}
    </span>
  );
}

export function AuthorCard({
  author,
  t,
  href,
  productCount,
}: {
  author: Author;
  t: Dictionary;
  href: string;
  productCount: number;
}) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col gap-4 border border-line p-6 transition hover:border-ink"
    >
      <AuthorAvatar author={author} className="size-16 text-xl" />

      <div>
        <h2 className="font-display text-2xl font-bold uppercase leading-tight group-hover:text-flame">
          {author.name}
        </h2>
        <p className="eyebrow mt-1 text-flame">{author.role}</p>
      </div>

      <p className="text-[0.875rem] leading-relaxed text-mute">{author.bio}</p>

      <dl className="mt-auto grid grid-cols-2 gap-3 border-t border-line-soft pt-4 text-[0.8125rem]">
        <div>
          <dt className="text-mute">{t.authors.products}</dt>
          <dd className="font-display text-xl font-bold">{productCount}</dd>
        </div>
        <div>
          <dt className="text-mute">{t.authors.bibliographyTitle}</dt>
          <dd className="font-display text-xl font-bold">{author.works.length}</dd>
        </div>
      </dl>

      <span className="inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold">
        {t.pdp.seeBibliography}
        <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-1" />
      </span>
    </Link>
  );
}

/** One bibliography entry, formatted as a citation. */
export function WorkEntry({
  work,
  t,
}: {
  work: Author["works"][number];
  t: Dictionary;
}) {
  const kindLabel =
    t.authors.kinds[work.kind as keyof typeof t.authors.kinds] ?? work.kind;

  return (
    <li className="grid gap-1 border-b border-line-soft py-4 sm:grid-cols-[4rem_1fr]">
      <span className="font-display text-lg font-bold leading-none text-mute">
        {work.year ?? "—"}
      </span>
      <div>
        <p className="text-[0.9375rem] font-semibold leading-snug">
          {work.url ? (
            <a
              href={work.url}
              target="_blank"
              rel="noreferrer noopener"
              className="underline decoration-line hover:decoration-ink"
            >
              {work.title}
            </a>
          ) : (
            work.title
          )}
        </p>
        <p className="mt-0.5 text-[0.8125rem] text-mute">
          <span className="eyebrow mr-2 bg-shell px-1.5 py-0.5 text-ink">{kindLabel}</span>
          {work.publisher}
        </p>
        {work.note && <p className="mt-1.5 text-[0.8125rem] leading-snug text-ink/70">{work.note}</p>}
      </div>
    </li>
  );
}
