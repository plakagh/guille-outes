"use client";

import { useCallback, useState } from "react";
import { CloseIcon, PlusIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/bits";
import type { ActionResult } from "@/lib/admin/actions";
import {
  deleteDiscountCode,
  saveDiscountCode,
  toggleDiscountCode,
} from "@/lib/admin/discount-actions";
import type { DiscountDraft } from "@/lib/db/discounts";
import type { DiscountKind, DiscountScope } from "@/lib/discounts";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { formatPrice } from "@/lib/utils";

type Option = { id: string; name: string };

/** Cents in the database, euros in the form. */
const euros = (value: number | null) => (value === null ? "" : (value / 100).toFixed(2));

const BLANK: DiscountDraft = {
  id: "",
  code: "",
  kind: "percent",
  percent: 10,
  amountCents: null,
  maxDiscountCents: null,
  minSubtotalCents: 0,
  scope: "all",
  collectionId: null,
  categoryId: null,
  excludeDiscounted: true,
  firstOrderOnly: false,
  maxRedemptions: null,
  maxPerCustomer: null,
  startsAt: null,
  endsAt: null,
  enabled: true,
  note: "",
  createdAt: "",
  usedTotal: 0,
  usedByCustomers: 0,
  givenCents: 0,
  lastUsedAt: null,
};

export function DiscountEditor({
  codes,
  categories,
  collections,
  locale,
  t,
}: {
  codes: DiscountDraft[];
  categories: Option[];
  collections: Option[];
  locale: Locale;
  t: Dictionary;
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const label = t.admin.discounts;

  const run = async (action: (form: FormData) => Promise<ActionResult>, form: FormData) => {
    setStatus("saving");
    const result = await action(form);
    setStatus(result.ok ? "saved" : "error");
    setMessage(result.ok ? null : errorMessage(result.error, t));
  };

  return (
    <div className="mt-8 space-y-8">
      {status !== "idle" && (
        <p
          role="status"
          className={
            status === "error"
              ? "border-l-2 border-flame bg-white p-3 text-[0.875rem] font-semibold text-flame"
              : "border-l-2 border-pine bg-white p-3 text-[0.875rem] font-semibold text-pine"
          }
        >
          {status === "saving" ? t.admin.saving : status === "saved" ? t.admin.saved : message}
        </p>
      )}

      <section className="border border-line bg-white p-6">
        <h2 className="mb-1 text-2xl">{label.newCode}</h2>
        <p className="mb-5 max-w-2xl text-[0.875rem] text-mute">{label.newCodeBlurb}</p>
        <CodeForm
          key={`new-${codes.length}`}
          draft={BLANK}
          categories={categories}
          collections={collections}
          locale={locale}
          t={t}
          run={run}
          isNew
        />
      </section>

      <section>
        <h2 className="mb-4 text-2xl">{label.existing}</h2>

        {codes.length === 0 ? (
          <p className="text-[0.9375rem] text-mute">{label.empty}</p>
        ) : (
          <ul className="space-y-3">
            {codes.map((draft) => (
              <li key={draft.id} className="border border-line bg-white">
                <div className="flex flex-wrap items-center gap-4 p-4">
                  <span className="font-mono text-[1.0625rem] font-bold uppercase">
                    {draft.code}
                  </span>
                  <span className="text-[0.875rem] text-mute">
                    {summarise(draft, t, locale, [...categories, ...collections])}
                  </span>

                  <span className="ml-auto flex items-center gap-4">
                    <span className="text-[0.8125rem] text-mute">
                      {label.used}:{" "}
                      <strong className="text-ink">
                        {draft.usedTotal}
                        {draft.maxRedemptions !== null && ` / ${draft.maxRedemptions}`}
                      </strong>
                      {draft.givenCents > 0 && ` · ${formatPrice(draft.givenCents)}`}
                    </span>

                    {draft.enabled ? (
                      <Badge tone="new">{label.active}</Badge>
                    ) : (
                      <Badge tone="soldout">{label.paused}</Badge>
                    )}

                    {/* Its own one-field form: stopping a campaign should not
                        need the whole editor to be valid first. */}
                    <form action={(form) => run(toggleDiscountCode, form)}>
                      <input type="hidden" name="id" value={draft.id} />
                      {draft.enabled ? null : <input type="hidden" name="enabled" value="on" />}
                      <button
                        type="submit"
                        className="text-[0.8125rem] underline hover:text-flame"
                      >
                        {draft.enabled ? label.pause : label.resume}
                      </button>
                    </form>
                  </span>
                </div>

                <details className="border-t border-line-soft">
                  <summary className="cursor-pointer px-4 py-2.5 text-[0.8125rem] font-semibold hover:text-flame">
                    {label.edit}
                  </summary>
                  <div className="border-t border-line-soft p-4">
                    <CodeForm
                      draft={draft}
                      categories={categories}
                      collections={collections}
                      locale={locale}
                      t={t}
                      run={run}
                    />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* -------------------------------------------------------------- the form */

function CodeForm({
  draft,
  categories,
  collections,
  locale,
  t,
  run,
  isNew = false,
}: {
  draft: DiscountDraft;
  categories: Option[];
  collections: Option[];
  locale: Locale;
  t: Dictionary;
  run: (action: (form: FormData) => Promise<ActionResult>, form: FormData) => Promise<void>;
  isNew?: boolean;
}) {
  const label = t.admin.discounts;
  const [kind, setKind] = useState<DiscountKind>(draft.kind);
  const [scope, setScope] = useState<DiscountScope>(draft.scope);

  return (
    <>
      <form action={(form) => run(saveDiscountCode, form)} className="space-y-6">
        {draft.id && <input type="hidden" name="id" value={draft.id} />}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="eyebrow mb-1.5 block text-mute">{label.code}</span>
            <input
              name="code"
              defaultValue={draft.code}
              required
              maxLength={24}
              // The database will not take anything else, and being told so by
              // the browser beats a round trip that comes back "bad_code".
              pattern="[A-Za-z0-9][A-Za-z0-9-]{2,23}"
              autoCapitalize="characters"
              className="h-11 w-full border border-line px-3 font-mono text-[0.9375rem] uppercase outline-none focus:border-ink"
            />
            <span className="mt-1 block text-[0.75rem] text-mute">{label.codeHint}</span>
          </label>

          <label className="block">
            <span className="eyebrow mb-1.5 block text-mute">{label.kind}</span>
            <select
              name="kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as DiscountKind)}
              className="h-11 w-full border border-line px-3 text-[0.9375rem] outline-none focus:border-ink"
            >
              <option value="percent">{label.kindPercent}</option>
              <option value="amount">{label.kindAmount}</option>
              <option value="free_shipping">{label.kindFreeShipping}</option>
            </select>
          </label>

          {kind === "percent" && (
            <label className="block">
              <span className="eyebrow mb-1.5 block text-mute">{label.percent}</span>
              <span className="flex h-11 items-center border border-line focus-within:border-ink">
                <input
                  name="percent"
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  defaultValue={draft.percent ?? 10}
                  required
                  className="h-full min-w-0 flex-1 px-3 text-right text-[0.9375rem] outline-none"
                />
                <span className="px-3 text-[0.875rem] text-mute">%</span>
              </span>
            </label>
          )}

          {kind === "amount" && (
            <Money name="amount" label={label.amount} defaultValue={euros(draft.amountCents)} required />
          )}

          {kind === "percent" && (
            <Money
              name="max_discount"
              label={label.maxDiscount}
              hint={label.maxDiscountHint}
              defaultValue={euros(draft.maxDiscountCents)}
            />
          )}

          <Money
            name="min_subtotal"
            label={label.minSubtotal}
            hint={label.minSubtotalHint}
            defaultValue={euros(draft.minSubtotalCents)}
          />
        </div>

        {/* ------------------------------------------------------------ scope */}
        <fieldset className="grid gap-5 border-t border-line-soft pt-5 sm:grid-cols-2 lg:grid-cols-3">
          <legend className="eyebrow mb-2 text-mute">{label.scope}</legend>

          <label className="block">
            <span className="eyebrow mb-1.5 block text-mute">{label.appliesTo}</span>
            <select
              name="scope"
              value={scope}
              onChange={(event) => setScope(event.target.value as DiscountScope)}
              className="h-11 w-full border border-line px-3 text-[0.9375rem] outline-none focus:border-ink"
            >
              <option value="all">{label.scopeAll}</option>
              <option value="collection">{label.scopeCollection}</option>
              <option value="category">{label.scopeCategory}</option>
            </select>
          </label>

          {scope === "collection" && (
            <label className="block">
              <span className="eyebrow mb-1.5 block text-mute">{label.scopeCollection}</span>
              <select
                name="collection_id"
                defaultValue={draft.collectionId ?? collections[0]?.id ?? ""}
                className="h-11 w-full border border-line px-3 text-[0.9375rem] outline-none focus:border-ink"
              >
                {collections.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {scope === "category" && (
            <label className="block">
              <span className="eyebrow mb-1.5 block text-mute">{label.scopeCategory}</span>
              <select
                name="category_id"
                defaultValue={draft.categoryId ?? categories[0]?.id ?? ""}
                className="h-11 w-full border border-line px-3 text-[0.9375rem] outline-none focus:border-ink"
              >
                {categories.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="space-y-2 self-end">
            <Toggle
              name="exclude_discounted"
              label={label.excludeDiscounted}
              hint={label.excludeDiscountedHint}
              defaultChecked={draft.excludeDiscounted}
            />
          </div>
        </fieldset>

        {/* ------------------------------------------------------- limits */}
        <fieldset className="grid gap-5 border-t border-line-soft pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <legend className="eyebrow mb-2 text-mute">{label.limits}</legend>

          <Count
            name="max_redemptions"
            label={label.maxRedemptions}
            hint={label.unlimitedHint}
            defaultValue={draft.maxRedemptions}
          />
          <Count
            name="max_per_customer"
            label={label.maxPerCustomer}
            hint={label.unlimitedHint}
            defaultValue={draft.maxPerCustomer}
          />
          <DateTimeField name="starts_at" label={label.startsAt} iso={draft.startsAt} locale={locale} />
          <DateTimeField name="ends_at" label={label.endsAt} iso={draft.endsAt} locale={locale} />

          <div className="sm:col-span-2 lg:col-span-4">
            <Toggle
              name="first_order_only"
              label={label.firstOrderOnly}
              hint={label.firstOrderOnlyHint}
              defaultChecked={draft.firstOrderOnly}
            />
          </div>
        </fieldset>

        {/* --------------------------------------------------------- the rest */}
        <div className="grid gap-5 border-t border-line-soft pt-5 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="block">
            <span className="eyebrow mb-1.5 block text-mute">{label.note}</span>
            <input
              name="note"
              defaultValue={draft.note}
              maxLength={200}
              placeholder={label.notePlaceholder}
              className="h-11 w-full border border-line px-3 text-[0.9375rem] outline-none focus:border-ink"
            />
            <span className="mt-1 block text-[0.75rem] text-mute">{label.noteHint}</span>
          </label>

          <Toggle name="enabled" label={label.enabled} defaultChecked={draft.enabled} />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" variant={isNew ? "solid" : "outline"}>
            {isNew ? (
              <span className="inline-flex items-center gap-1.5">
                <PlusIcon className="size-4" />
                {label.add}
              </span>
            ) : (
              t.admin.save
            )}
          </Button>

          {!isNew && draft.lastUsedAt && (
            <p className="text-[0.8125rem] text-mute">
              {label.lastUsed}: {new Date(draft.lastUsedAt).toLocaleString(locale)} ·{" "}
              {label.customers}: {draft.usedByCustomers}
            </p>
          )}
        </div>
      </form>

      {!isNew && (
        <form action={(form) => run(deleteDiscountCode, form)} className="mt-4">
          <input type="hidden" name="id" value={draft.id} />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 text-[0.8125rem] text-mute hover:text-flame"
          >
            <CloseIcon className="size-3.5" />
            {t.admin.delete}
          </button>
          <span className="ml-3 text-[0.75rem] text-mute">{label.deleteHint}</span>
        </form>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ bits */

function Money({
  name,
  label,
  hint,
  defaultValue,
  required,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultValue: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="eyebrow mb-1.5 block text-mute">{label}</span>
      <span className="flex h-11 items-center border border-line focus-within:border-ink">
        <input
          name={name}
          type="text"
          inputMode="decimal"
          required={required}
          defaultValue={defaultValue}
          className="h-full min-w-0 flex-1 px-3 text-right text-[0.9375rem] outline-none"
        />
        <span className="px-3 text-[0.875rem] text-mute">€</span>
      </span>
      {hint && <span className="mt-1 block text-[0.75rem] text-mute">{hint}</span>}
    </label>
  );
}

function Count({
  name,
  label,
  hint,
  defaultValue,
}: {
  name: string;
  label: string;
  hint: string;
  defaultValue: number | null;
}) {
  return (
    <label className="block">
      <span className="eyebrow mb-1.5 block text-mute">{label}</span>
      <input
        name={name}
        type="number"
        min={1}
        step={1}
        defaultValue={defaultValue ?? ""}
        className="h-11 w-full border border-line px-3 text-[0.9375rem] outline-none focus:border-ink"
      />
      <span className="mt-1 block text-[0.75rem] text-mute">{hint}</span>
    </label>
  );
}

/**
 * A moment in time, typed in the shop's own clock.
 *
 * `datetime-local` has no timezone, so the ISO string is built in the browser:
 * "ends at midnight" then means midnight where whoever is typing it lives, not
 * midnight wherever the server happens to be running.
 *
 * That conversion cannot happen during the server render — it would produce a
 * value in the server's zone, and a hydration mismatch — so the box is left
 * uncontrolled and filled in by a ref callback, which runs on the client and
 * only on the client. Until it is edited, the hidden field posts the instant
 * that was already stored, so saving an untouched form changes nothing.
 */
function DateTimeField({
  name,
  label,
  iso,
  locale,
}: {
  name: string;
  label: string;
  iso: string | null;
  locale: Locale;
}) {
  const [edited, setEdited] = useState<string | null>(null);

  // Memoised so React does not tear down and re-run it on every render, which
  // would put the stored value back over whatever is being typed.
  const fill = useCallback(
    (node: HTMLInputElement | null) => {
      if (node) node.value = toLocalInput(iso);
    },
    [iso],
  );

  return (
    <label className="block">
      <span className="eyebrow mb-1.5 block text-mute">{label}</span>
      <input
        ref={fill}
        type="datetime-local"
        onChange={(event) => setEdited(event.target.value)}
        className="h-11 w-full border border-line px-3 text-[0.875rem] outline-none focus:border-ink"
      />
      <input type="hidden" name={name} value={edited === null ? (iso ?? "") : toInstant(edited)} />
      {iso && (
        <span className="mt-1 block text-[0.75rem] text-mute">
          {new Date(iso).toLocaleString(locale)}
        </span>
      )}
    </label>
  );
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function toInstant(local: string): string {
  if (!local) return "";
  const parsed = Date.parse(local);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
}

function Toggle({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="block cursor-pointer">
      <span className="flex items-center gap-2 text-[0.875rem]">
        <input
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked}
          className="size-4 accent-black"
        />
        {label}
      </span>
      {hint && <span className="mt-1 block pl-6 text-[0.75rem] text-mute">{hint}</span>}
    </label>
  );
}

/* --------------------------------------------------------------- wording */

/** One line describing what a code does, for the collapsed row. */
function summarise(
  draft: DiscountDraft,
  t: Dictionary,
  locale: Locale,
  named: Option[],
): string {
  const label = t.admin.discounts;
  const nameOf = (id: string | null) => named.find((option) => option.id === id)?.name ?? id ?? "";

  const what =
    draft.kind === "percent"
      ? `−${draft.percent} %`
      : draft.kind === "amount"
        ? `−${formatPrice(draft.amountCents ?? 0)}`
        : label.kindFreeShipping;

  const where =
    draft.scope === "all"
      ? label.scopeAll.toLowerCase()
      : draft.scope === "collection"
        ? nameOf(draft.collectionId)
        : nameOf(draft.categoryId);

  const parts = [what, where];
  if (draft.minSubtotalCents > 0) {
    parts.push(label.minSubtotalShort.replace("{{amount}}", formatPrice(draft.minSubtotalCents)));
  }
  if (draft.firstOrderOnly) parts.push(label.firstOrderOnly.toLowerCase());
  if (draft.endsAt) parts.push(`→ ${new Date(draft.endsAt).toLocaleDateString(locale)}`);

  return parts.join(" · ");
}

/** Turns an action's error key into a sentence; anything unknown falls through. */
function errorMessage(error: string, t: Dictionary): string {
  const label = t.admin.discounts.errors;

  switch (error) {
    case "bad_code":
      return label.badCode;
    case "bad_percent":
      return label.badPercent;
    case "bad_amount":
      return label.badAmount;
    case "bad_window":
      return label.badWindow;
    case "bad_scope":
      return label.badScope;
    case "code_taken":
      return label.codeTaken;
    case "forbidden":
      return t.admin.forbidden;
    default:
      return error;
  }
}
