"use client";

import { useState } from "react";
import { CloseIcon, PlusIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/admin/actions";
import {
  deletePromoMessage,
  saveNotificationSettings,
  savePromoMessage,
  saveShippingSettings,
} from "@/lib/admin/settings-actions";
import type { PromoMessageDraft } from "@/lib/db/settings";
import { LOCALE_META, LOCALES, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { ShippingSettings } from "@/lib/shipping";
import { formatPrice } from "@/lib/utils";

/** Cents in the database, euros in the form. */
const euros = (value: number) => (value / 100).toFixed(2);

export function SettingsEditor({
  shipping,
  promos,
  notifications,
  t,
}: {
  shipping: ShippingSettings;
  promos: PromoMessageDraft[];
  notifications: { orderEmail: string };
  t: Dictionary;
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const run = async (action: (form: FormData) => Promise<ActionResult>, form: FormData) => {
    setStatus("saving");
    const result = await action(form);
    setStatus(result.ok ? "saved" : "error");
    setMessage(result.ok ? null : result.error);
  };

  const label = t.admin.shop;

  return (
    <div className="space-y-8">
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

      <ShippingForm shipping={shipping} t={t} run={run} />

      {/*
        Where the shop hears about an order. First, because it is the one setting
        on this page that somebody notices is missing only by not hearing about a
        sale — and the notice is what says which frame a cuadro was bought with.
      */}
      <section className="border border-line bg-white p-6">
        <h2 className="mb-1 text-2xl">{label.noticeTitle}</h2>
        <p className="mb-5 max-w-2xl text-[0.875rem] text-mute">{label.noticeBlurb}</p>

        <form
          action={(form) => run(saveNotificationSettings, form)}
          className="flex flex-wrap items-end gap-4"
        >
          <label className="block min-w-64 flex-1">
            <span className="eyebrow mb-1.5 block text-mute">{label.noticeEmail}</span>
            <input
              name="order_email"
              type="email"
              defaultValue={notifications.orderEmail}
              placeholder="pedidos@guilleoutes.com"
              className="h-11 w-full border border-line px-3 text-[0.9375rem] outline-none focus:border-ink"
            />
            <span className="mt-1 block text-[0.75rem] text-mute">{label.noticeEmailHint}</span>
          </label>

          <Button type="submit" className="h-11">
            {t.admin.save}
          </Button>
        </form>
      </section>

      <section className="border border-line bg-white p-6">
        <h2 className="mb-1 text-2xl">{label.promoTitle}</h2>
        <p className="mb-5 max-w-2xl text-[0.875rem] text-mute">{label.promoBlurb}</p>

        <ul className="space-y-4">
          {promos.map((promo) => (
            <li key={promo.id}>
              <PromoForm promo={promo} t={t} run={run} />
            </li>
          ))}
        </ul>

        <div className="mt-6 border-t border-line pt-6">
          <PromoForm
            key="new"
            promo={{
              id: "",
              text: { es: "", gl: "", en: "" },
              link: { es: "", gl: "", en: "" },
              // Leaves room to insert between the existing ones without renumbering.
              position: (promos.at(-1)?.position ?? 0) + 10,
              enabled: true,
            }}
            t={t}
            run={run}
            isNew
          />
        </div>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------- shipping */

function ShippingForm({
  shipping,
  t,
  run,
}: {
  shipping: ShippingSettings;
  t: Dictionary;
  run: (action: (form: FormData) => Promise<ActionResult>, form: FormData) => Promise<void>;
}) {
  const label = t.admin.shop;
  const [threshold, setThreshold] = useState(euros(shipping.freeThreshold));

  return (
    <section className="border border-line bg-white p-6">
      <h2 className="mb-1 text-2xl">{label.shippingTitle}</h2>
      <p className="mb-5 max-w-2xl text-[0.875rem] text-mute">{label.shippingBlurb}</p>

      <form action={(form) => run(saveShippingSettings, form)} className="space-y-6">
        <div className="max-w-md">
          <Money
            name="free_threshold"
            label={label.freeThreshold}
            hint={label.freeThresholdHint}
            defaultValue={euros(shipping.freeThreshold)}
            onChange={setThreshold}
          />
          {/* Says out loud what the number means, because "0" reads as free-for-all
              and it is the opposite: free from 0 € up. */}
          <p className="mt-2 text-[0.8125rem] text-mute">
            {Number(threshold.replace(",", ".")) === 0
              ? label.freeAlways
              : label.freeFrom.replace(
                  "{{amount}}",
                  formatPrice(Math.round(Number(threshold.replace(",", ".")) * 100) || 0),
                )}
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <Money name="standard" label={t.checkout.delivery.standard} defaultValue={euros(shipping.rates.standard)} />
          <Money name="express" label={t.checkout.delivery.express} defaultValue={euros(shipping.rates.express)} />
          <Money name="pickup" label={t.checkout.delivery.pickup} defaultValue={euros(shipping.rates.pickup)} />
        </div>

        <fieldset className="space-y-2">
          <legend className="eyebrow mb-2 text-mute">{label.methodsOffered}</legend>
          <p className="text-[0.8125rem] text-mute">{label.standardAlways}</p>
          <Toggle
            name="express_enabled"
            label={t.checkout.delivery.express}
            defaultChecked={shipping.enabled.express}
          />
          <Toggle
            name="pickup_enabled"
            label={t.checkout.delivery.pickup}
            defaultChecked={shipping.enabled.pickup}
          />
        </fieldset>

        <Button type="submit">{t.admin.save}</Button>
      </form>
    </section>
  );
}

/* ------------------------------------------------------------ promo bar */

function PromoForm({
  promo,
  t,
  run,
  isNew = false,
}: {
  promo: PromoMessageDraft;
  t: Dictionary;
  run: (action: (form: FormData) => Promise<ActionResult>, form: FormData) => Promise<void>;
  isNew?: boolean;
}) {
  const label = t.admin.shop;
  const [tab, setTab] = useState<Locale>("es");

  return (
    <div className="border border-line-soft p-5">
      <form action={(form) => run(savePromoMessage, form)} className="space-y-4">
        {promo.id && <input type="hidden" name="id" value={promo.id} />}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1">
            {LOCALES.map((locale) => (
              <button
                key={locale}
                type="button"
                onClick={() => setTab(locale)}
                aria-pressed={tab === locale}
                className={
                  tab === locale
                    ? "border border-ink bg-ink px-3 py-1 text-[0.75rem] font-semibold uppercase text-white"
                    : "border border-line px-3 py-1 text-[0.75rem] uppercase hover:border-ink"
                }
              >
                {LOCALE_META[locale].endonym}
              </button>
            ))}
          </div>
          <Toggle name="enabled" label={label.visible} defaultChecked={promo.enabled} />
        </div>

        {/*
          Every language stays mounted — only the current one is shown. A hidden
          input still posts, so switching tabs cannot quietly drop a translation.
        */}
        {LOCALES.map((locale) => (
          <div key={locale} className={locale === tab ? "grid gap-4 sm:grid-cols-2" : "hidden"}>
            <label className="block">
              <span className="eyebrow mb-1.5 block text-mute">
                {label.promoText} ({LOCALE_META[locale].endonym})
              </span>
              <input
                name={`text_${locale}`}
                defaultValue={promo.text[locale]}
                required={locale === "es"}
                maxLength={120}
                className="h-11 w-full border border-line px-3 text-[0.9375rem] outline-none focus:border-ink"
              />
            </label>
            <label className="block">
              <span className="eyebrow mb-1.5 block text-mute">
                {label.promoLink} ({LOCALE_META[locale].endonym})
              </span>
              <input
                name={`link_${locale}`}
                defaultValue={promo.link[locale]}
                placeholder={locale === "es" ? "/es/ayuda/envios" : ""}
                className="h-11 w-full border border-line px-3 font-mono text-[0.8125rem] outline-none focus:border-ink"
              />
            </label>
          </div>
        ))}

        <p className="text-[0.75rem] text-mute">{label.promoLinkHint}</p>

        <div className="flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="eyebrow mb-1.5 block text-mute">{label.order}</span>
            <input
              name="position"
              type="number"
              defaultValue={promo.position}
              className="h-11 w-24 border border-line px-3 text-[0.9375rem] outline-none focus:border-ink"
            />
          </label>

          <Button type="submit" variant={isNew ? "solid" : "outline"} className="h-11">
            {isNew ? (
              <span className="inline-flex items-center gap-1.5">
                <PlusIcon className="size-4" />
                {label.addPromo}
              </span>
            ) : (
              t.admin.save
            )}
          </Button>
        </div>
      </form>

      {!isNew && (
        <form action={(form) => run(deletePromoMessage, form)} className="mt-3">
          <input type="hidden" name="id" value={promo.id} />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 text-[0.8125rem] text-mute hover:text-flame"
          >
            <CloseIcon className="size-3.5" />
            {t.admin.delete}
          </button>
        </form>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ bits */

function Money({
  name,
  label,
  hint,
  defaultValue,
  onChange,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultValue: string;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="eyebrow mb-1.5 block text-mute">{label}</span>
      <span className="flex h-11 items-center border border-line focus-within:border-ink">
        <input
          name={name}
          type="text"
          inputMode="decimal"
          defaultValue={defaultValue}
          onChange={(event) => onChange?.(event.target.value)}
          className="h-full min-w-0 flex-1 px-3 text-right text-[0.9375rem] outline-none"
        />
        <span className="px-3 text-[0.875rem] text-mute">€</span>
      </span>
      {hint && <span className="mt-1 block text-[0.75rem] text-mute">{hint}</span>}
    </label>
  );
}

function Toggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[0.875rem]">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="size-4 accent-black"
      />
      {label}
    </label>
  );
}
