import Link from "next/link";
import { CatalogToolbar, FilterSidebar } from "@/components/catalog/filter-controls";
import { ChevronLeft, ChevronRight } from "@/components/icons";
import { ProductGrid } from "@/components/product/product-rail";
import { Breadcrumbs } from "@/components/ui/bits";
import { ButtonLink } from "@/components/ui/button";
import type { Catalog, Product } from "@/lib/catalog";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";
import { PAGE_SIZE, QK, type FacetGroup } from "@/lib/query";
import { cn } from "@/lib/utils";

export type CatalogViewProps = {
  locale: Locale;
  t: Dictionary;
  catalog: Catalog;
  eyebrow?: string;
  title: string;
  blurb?: string;
  trail: { label: string; href?: string }[];
  /** Every product matching the query, before pagination. */
  products: Product[];
  facets: FacetGroup[];
  chips: { key: string; value: string; label: string }[];
  page: number;
  /** Current path, used to build page links. */
  basePath: string;
  searchParams: Record<string, string | string[] | undefined>;
  /** Optional tint behind the page header, e.g. a collection accent. */
  accent?: string;
};

export function CatalogView({
  locale,
  t,
  catalog,
  eyebrow,
  title,
  blurb,
  trail,
  products,
  facets,
  chips,
  page,
  basePath,
  searchParams,
  accent,
}: CatalogViewProps) {
  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const visible = products.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <>
      <header
        className={cn("border-b border-line", accent ? "" : "bg-white")}
        style={accent ? { backgroundColor: `${accent}14` } : undefined}
      >
        <div className="shell py-6 lg:py-10">
          <Breadcrumbs trail={trail} className="mb-4" label={t.plp.breadcrumbHome} />
          {eyebrow && (
            <p className="eyebrow mb-2" style={accent ? { color: accent } : undefined}>
              {eyebrow}
            </p>
          )}
          <h1 className="text-[clamp(2rem,5vw,3.5rem)] leading-[0.9]">{title}</h1>
          {blurb && (
            <p className="mt-3 max-w-2xl text-[0.9375rem] leading-relaxed text-mute">{blurb}</p>
          )}
        </div>
      </header>

      <div className="shell flex gap-8 py-6 lg:py-8">
        <FilterSidebar facets={facets} />

        <div className="min-w-0 flex-1">
          <CatalogToolbar total={products.length} facets={facets} chips={chips} />

          {visible.length === 0 ? (
            <div className="flex flex-col items-start gap-4 py-16">
              <h2 className="text-2xl">{t.plp.noMatch}</h2>
              <p className="text-[0.9375rem] text-mute">{t.plp.noMatchBlurb}</p>
              <ButtonLink href={href(locale, "shop")} variant="outline">
                {t.plp.seeWholeCatalogue}
              </ButtonLink>
            </div>
          ) : (
            <>
              <ProductGrid products={visible} catalog={catalog} className="pt-6" />
              <Pagination
                t={t}
                page={current}
                totalPages={totalPages}
                basePath={basePath}
                searchParams={searchParams}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}

function pageHref(
  basePath: string,
  searchParams: Record<string, string | string[] | undefined>,
  page: number,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === QK.page || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) params.append(key, item);
  }
  if (page > 1) params.set(QK.page, String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function Pagination({
  t,
  page,
  totalPages,
  basePath,
  searchParams,
}: {
  t: Dictionary;
  page: number;
  totalPages: number;
  basePath: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <nav aria-label={t.plp.pagination} className="mt-10 flex items-center justify-center gap-1.5">
      <PageArrow
        direction="prev"
        label={t.plp.previousPage}
        disabled={page === 1}
        href={pageHref(basePath, searchParams, page - 1)}
      />
      {pages.map((value) => (
        <Link
          key={value}
          href={pageHref(basePath, searchParams, value)}
          aria-current={value === page ? "page" : undefined}
          className={cn(
            "grid size-10 place-items-center border text-[0.875rem] font-semibold transition",
            value === page ? "border-ink bg-ink text-white" : "border-line hover:border-ink",
          )}
        >
          {value}
        </Link>
      ))}
      <PageArrow
        direction="next"
        label={t.plp.nextPage}
        disabled={page === totalPages}
        href={pageHref(basePath, searchParams, page + 1)}
      />
    </nav>
  );
}

function PageArrow({
  direction,
  label,
  disabled,
  href: target,
}: {
  direction: "prev" | "next";
  label: string;
  disabled: boolean;
  href: string;
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;

  if (disabled) {
    return (
      <span
        aria-hidden="true"
        className="grid size-10 place-items-center border border-line-soft text-line"
      >
        <Icon className="size-4" />
      </span>
    );
  }

  return (
    <Link
      href={target}
      aria-label={label}
      className="grid size-10 place-items-center border border-line transition hover:border-ink"
    >
      <Icon className="size-4" />
    </Link>
  );
}
