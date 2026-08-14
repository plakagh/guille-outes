"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ProductArt, type ArtShape, type Colorway } from "@/components/brand/product-art";
import { CloseIcon, SearchIcon } from "@/components/icons";
import { Price } from "@/components/ui/bits";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { href, withQuery } from "@/lib/i18n/routes";
import { QK } from "@/lib/query";
import { cn } from "@/lib/utils";

/** Slim projection of a product — just enough to draw a typeahead row. */
export type SearchIndexEntry = {
  slug: string;
  name: string;
  keywords: string[];
  price: number;
  compareAt?: number;
  shape: ArtShape;
  colorway: Colorway;
  /** The product's photograph, when it has one. Absent falls back to the drawing. */
  imageUrl?: string;
};

export function SearchField({
  locale,
  t,
  index,
  categories,
  className,
}: {
  locale: Locale;
  t: Dictionary;
  index: SearchIndexEntry[];
  categories: { label: string; href: string }[];
  className?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const terms = q.split(/\s+/);
    return index
      .map((entry) => {
        const name = entry.name.toLowerCase();
        const haystack = `${name} ${entry.keywords.join(" ")}`.toLowerCase();
        const score = terms.reduce(
          (total, term) =>
            total + (name.includes(term) ? 3 : haystack.includes(term) ? 1 : 0),
          0,
        );
        return { entry, score };
      })
      .filter((hit) => hit.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((hit) => hit.entry);
  }, [query, index]);

  useEffect(() => {
    if (!focused) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setFocused(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFocused(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [focused]);

  const submit = (value: string) => {
    const term = value.trim();
    if (!term) return;
    setFocused(false);
    router.push(
      withQuery(href(locale, "search"), new URLSearchParams({ [QK.query]: term })),
    );
  };

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          submit(query);
        }}
        /*
          The field is white on the black masthead.

          It was a grey well on white, which on black would be a grey well on
          black — the same trick, but now the lighter of the two surfaces, so it
          would read as the primary thing in the header rather than as an input.
          White states plainly that this is where you type, and taking focus is
          then a ring rather than a change of fill, since the fill has nowhere
          lighter to go.
        */
        className="flex h-11 items-center gap-2 bg-white px-3 ring-2 ring-inset ring-transparent transition focus-within:ring-white/70"
      >
        <SearchIcon className="size-[1.15rem] shrink-0 text-mute" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          placeholder={t.header.searchPlaceholder}
          aria-label={t.header.searchAria}
          className="min-w-0 flex-1 bg-transparent text-[0.875rem] text-ink outline-none placeholder:text-mute"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label={t.header.clearSearch}
            className="grid size-6 shrink-0 place-items-center text-mute hover:text-ink"
          >
            <CloseIcon className="size-4" />
          </button>
        )}
      </form>

      {focused && (
        // `text-ink` is not redundant: this panel is a child of the black chrome,
        // which sets `text-white` for its own labels, and a white sheet of results
        // inheriting that renders nothing at all.
        <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-50 max-h-[70vh] overflow-y-auto border border-line bg-white text-ink shadow-[0_18px_40px_rgba(0,0,0,0.16)]">
          {query.length === 0 ? (
            <div className="p-4">
              <p className="eyebrow mb-3 text-mute">{t.header.frequentSearches}</p>
              <ul className="flex flex-wrap gap-2">
                {t.search.suggestions.map((term) => (
                  <li key={term}>
                    <button
                      type="button"
                      onClick={() => submit(term)}
                      className="border border-line px-3 py-1.5 text-[0.8125rem] transition hover:border-ink"
                    >
                      {term}
                    </button>
                  </li>
                ))}
              </ul>

              <p className="eyebrow mb-3 mt-5 text-mute">{t.header.categories}</p>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {categories.map((category) => (
                  <li key={category.href}>
                    <Link
                      href={category.href}
                      onClick={() => setFocused(false)}
                      className="text-[0.8125rem] hover:underline"
                    >
                      {category.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : results.length === 0 ? (
            <p className="p-4 text-[0.875rem] text-mute">
              {t.header.noResultsFor}{" "}
              <span className="font-semibold text-ink">{query}</span>. {t.header.tryAnother}{" "}
              <Link
                href={href(locale, "shop")}
                className="underline"
                onClick={() => setFocused(false)}
              >
                {t.header.browseCatalogue}
              </Link>
              .
            </p>
          ) : (
            <>
              <ul className="divide-y divide-line-soft">
                {results.map((entry) => (
                  <li key={entry.slug}>
                    <Link
                      href={href(locale, "product", entry.slug)}
                      onClick={() => setFocused(false)}
                      className="flex items-center gap-3 p-2.5 transition hover:bg-shell"
                    >
                      <span className="size-14 shrink-0 bg-shell">
                        {entry.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={entry.imageUrl}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <ProductArt shape={entry.shape} colorway={entry.colorway} print="none" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.875rem] font-semibold">
                          {entry.name}
                        </span>
                        <Price price={entry.price} compareAt={entry.compareAt} size="sm" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => submit(query)}
                className="w-full border-t border-line bg-shell px-4 py-3 text-left text-[0.8125rem] font-semibold uppercase tracking-wide transition hover:bg-ink hover:text-white"
              >
                {t.header.viewAllResults}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
