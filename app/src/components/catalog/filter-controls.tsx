"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { CheckIcon, ChevronDown, CloseIcon, FilterIcon } from "@/components/icons";
import { Swatch } from "@/components/ui/bits";
import { SORT_KEYS } from "@/lib/catalog";
import { QK, type FacetGroup } from "@/lib/query";
import { cn } from "@/lib/utils";

const PRICE_STEPS = [3000, 5000, 8000, 12000];

/** Reads the current multi-value selection for a facet key. */
function useSelection() {
  const params = useSearchParams();
  return useCallback(
    (key: string): string[] => {
      const raw = params.get(key);
      return raw ? raw.split(",").filter(Boolean) : [];
    },
    [params],
  );
}

/** Builds the next URL for a param change, always resetting pagination. */
function useNavigate() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return useCallback(
    (mutate: (next: URLSearchParams) => void, options?: { scroll?: boolean }) => {
      const next = new URLSearchParams(params.toString());
      mutate(next);
      next.delete(QK.page);
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: options?.scroll ?? false });
    },
    [router, pathname, params],
  );
}

/* ------------------------------------------------------------------ toolbar */

export function CatalogToolbar({
  total,
  facets,
  chips,
}: {
  total: number;
  facets: FacetGroup[];
  chips: { key: string; value: string; label: string }[];
}) {
  const { t } = useI18n();
  const params = useSearchParams();
  const navigate = useNavigate();
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const sort = params.get(QK.sort) ?? "destacados";

  const removeChip = (key: string, value: string) =>
    navigate((next) => {
      if (key === QK.maxPrice || key === QK.onSale) {
        next.delete(key);
        return;
      }
      const remaining = (next.get(key) ?? "")
        .split(",")
        .filter((v) => v && v !== value);
      if (remaining.length) next.set(key, remaining.join(","));
      else next.delete(key);
    });

  const clearAll = () => router.push(pathname, { scroll: false });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex h-11 items-center gap-2 border-2 border-ink px-4 font-display text-[0.875rem] font-bold uppercase tracking-wide lg:hidden"
          >
            <FilterIcon className="size-4" />
            {t.plp.filter}
            {chips.length > 0 && (
              <span className="grid size-5 place-items-center rounded-full bg-flame font-sans text-[0.625rem] text-white">
                {chips.length}
              </span>
            )}
          </button>
          <p className="text-[0.8125rem] text-mute">
            <span className="font-semibold text-ink">{total}</span>{" "}
            {total === 1 ? t.plp.item : t.plp.items}
          </p>
        </div>

        <label className="flex items-center gap-2 text-[0.8125rem]">
          <span className="hidden text-mute sm:inline">{t.plp.sortBy}</span>
          <span className="relative">
            <select
              value={sort}
              onChange={(event) =>
                navigate((next) => {
                  if (event.target.value === "destacados") next.delete(QK.sort);
                  else next.set(QK.sort, event.target.value);
                })
              }
              className="h-11 appearance-none border border-line bg-white pl-3 pr-9 text-[0.8125rem] font-semibold outline-none transition hover:border-ink focus:border-ink"
            >
              {SORT_KEYS.map((key) => (
                <option key={key} value={key}>
                  {t.plp.sorts[key]}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2" />
          </span>
        </label>
      </div>

      {chips.length > 0 && (
        <ul className="flex flex-wrap items-center gap-2 pt-4">
          {chips.map((chip) => (
            <li key={`${chip.key}-${chip.value}`}>
              <button
                type="button"
                onClick={() => removeChip(chip.key, chip.value)}
                className="inline-flex h-8 items-center gap-1.5 bg-shell px-3 text-[0.8125rem] transition hover:bg-shell-deep"
              >
                {chip.label}
                <CloseIcon className="size-3.5" />
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={clearAll}
              className="text-[0.8125rem] text-mute underline hover:text-flame"
            >
              {t.plp.clearAll}
            </button>
          </li>
        </ul>
      )}

      {drawerOpen && (
        <FilterDrawer facets={facets} onClose={() => setDrawerOpen(false)} total={total} />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ sidebar */

export function FilterSidebar({ facets }: { facets: FacetGroup[] }) {
  return (
    <aside className="hidden w-56 shrink-0 lg:block xl:w-64">
      <FilterGroups facets={facets} />
    </aside>
  );
}

function FilterGroups({ facets }: { facets: FacetGroup[] }) {
  const { t } = useI18n();
  const params = useSearchParams();
  const navigate = useNavigate();
  const selection = useSelection();

  const toggleValue = (key: string, value: string) =>
    navigate((next) => {
      const current = (next.get(key) ?? "").split(",").filter(Boolean);
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      if (updated.length) next.set(key, updated.join(","));
      else next.delete(key);
    });

  const maxPrice = params.get(QK.maxPrice);
  const onSale = params.get(QK.onSale) === "1";

  return (
    <div className="divide-y divide-line">
      <FilterGroup heading={t.plp.offers} defaultOpen>
        <label className="flex cursor-pointer items-center gap-2.5 py-1 text-[0.875rem]">
          <Checkbox
            checked={onSale}
            onChange={() =>
              navigate((next) => {
                if (onSale) next.delete(QK.onSale);
                else next.set(QK.onSale, "1");
              })
            }
          />
          {t.plp.onSaleOnly}
        </label>
      </FilterGroup>

      {facets.map((group) => (
        <FilterGroup key={group.key} heading={group.heading} defaultOpen>
          {group.kind === "chip" ? (
            <ul className="flex flex-wrap gap-2">
              {group.options.map((option) => {
                const active = selection(group.key).includes(option.value);
                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      onClick={() => toggleValue(group.key, option.value)}
                      aria-pressed={active}
                      className={cn(
                        "grid h-9 min-w-11 place-items-center border px-2 text-[0.8125rem] font-semibold transition",
                        active
                          ? "border-ink bg-ink text-white"
                          : "border-line hover:border-ink",
                      )}
                    >
                      {option.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : group.kind === "swatch" ? (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-2">
              {group.options.map((option) => {
                const active = selection(group.key).includes(option.value);
                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      onClick={() => toggleValue(group.key, option.value)}
                      aria-pressed={active}
                      title={`${option.label} (${option.count})`}
                      className={cn(
                        "grid size-9 place-items-center border transition",
                        active ? "border-ink" : "border-transparent hover:border-line",
                      )}
                    >
                      <Swatch
                        base={option.base ?? "#000"}
                        trim={option.trim ?? "#fff"}
                        className="size-6"
                      />
                      <span className="sr-only">{option.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <ul className="space-y-1">
              {group.options.map((option) => {
                const active = selection(group.key).includes(option.value);
                const empty = option.count === 0 && !active;
                return (
                  <li key={option.value}>
                    <label
                      className={cn(
                        "flex items-center gap-2.5 py-1 text-[0.875rem]",
                        empty ? "cursor-not-allowed text-mute-soft" : "cursor-pointer",
                      )}
                    >
                      <Checkbox
                        checked={active}
                        disabled={empty}
                        onChange={() => toggleValue(group.key, option.value)}
                      />
                      <span className="flex-1">{option.label}</span>
                      <span className="text-[0.75rem] text-mute">{option.count}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </FilterGroup>
      ))}

      <FilterGroup heading={t.plp.price} defaultOpen>
        <ul className="space-y-1">
          {PRICE_STEPS.map((step) => {
            const active = maxPrice === String(step);
            return (
              <li key={step}>
                <label className="flex cursor-pointer items-center gap-2.5 py-1 text-[0.875rem]">
                  <Checkbox
                    checked={active}
                    onChange={() =>
                      navigate((next) => {
                        if (active) next.delete(QK.maxPrice);
                        else next.set(QK.maxPrice, String(step));
                      })
                    }
                  />
                  {t.plp.upTo} {step / 100} €
                </label>
              </li>
            );
          })}
        </ul>
      </FilterGroup>
    </div>
  );
}

function FilterGroup({
  heading,
  defaultOpen,
  children,
}: {
  heading: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <section className="py-4">
      <h3>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-2 font-display text-[0.9375rem] font-bold uppercase tracking-wide"
        >
          {heading}
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      </h3>
      {open && <div className="pt-3">{children}</div>}
    </section>
  );
}

function Checkbox({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <span className="relative grid size-[1.15rem] shrink-0 place-items-center">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="peer size-full cursor-pointer appearance-none border border-line transition checked:border-ink checked:bg-ink disabled:cursor-not-allowed disabled:opacity-40"
      />
      <CheckIcon className="pointer-events-none absolute size-3.5 text-white opacity-0 peer-checked:opacity-100" />
    </span>
  );
}

/* ------------------------------------------------------------ mobile drawer */

function FilterDrawer({
  facets,
  onClose,
  total,
}: {
  facets: FacetGroup[];
  onClose: () => void;
  total: number;
}) {
  const { t } = useI18n();

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={t.plp.filters}
    >
      <button
        type="button"
        aria-label={t.common.close}
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />
      <div className="absolute inset-y-0 right-0 flex w-[min(24rem,92vw)] flex-col bg-white">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-lg">{t.plp.filter}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.common.close}
            className="grid size-9 place-items-center"
          >
            <CloseIcon className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4">
          <FilterGroups facets={facets} />
        </div>

        <div className="border-t border-line p-4">
          <button
            type="button"
            onClick={onClose}
            className="h-12 w-full bg-ink font-display text-[0.9375rem] font-bold uppercase tracking-wide text-white"
          >
            {t.plp.show} {total} {total === 1 ? t.plp.item : t.plp.items}
          </button>
        </div>
      </div>
    </div>
  );
}
