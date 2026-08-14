"use client";

import { useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { CheckIcon, CloseIcon, ShieldIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { saveRedsysSettings, type SaveState } from "@/lib/payments/admin-actions";
import type { PaymentSettingsView } from "@/lib/payments/settings";
import { cn } from "@/lib/utils";

export type GatewayCheck = { label: string; passed: boolean };

export function PaymentForm({
  settings,
  urls,
  checks,
}: {
  settings: PaymentSettingsView;
  urls: { notify: string; returnExample: string; reachable: boolean };
  checks: GatewayCheck[];
}) {
  const { t } = useI18n();
  const [status, setStatus] = useState<SaveState>({});
  const [saving, setSaving] = useState(false);

  const allPassed = checks.every((check) => check.passed);

  const message =
    status.error === "no_encryption_key"
      ? t.payments.noEncryptionKey
      : status.error === "bad_secret"
        ? t.payments.badSecret
        : status.error === "incomplete"
          ? t.payments.incompleteToEnable
          : status.error
            ? t.admin.error
            : null;

  return (
    <div className="shell grid gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <form
        action={async (form) => {
          setSaving(true);
          setStatus(await saveRedsysSettings(form));
          setSaving(false);
        }}
        className="space-y-6 border border-line bg-white p-6"
      >
        <p className="max-w-2xl text-[0.9375rem] leading-relaxed text-mute">
          {t.payments.intro}
        </p>

        <label className="flex items-start gap-3 border border-line bg-shell p-4">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={settings.enabled}
            className="mt-0.5 size-4 accent-black"
          />
          <span>
            <span className="block font-display text-[1.0625rem] font-bold uppercase">
              {t.payments.enabled}
            </span>
            <span className="mt-1 block text-[0.8125rem] text-mute">
              {t.payments.enabledHint}
            </span>
          </span>
        </label>

        <fieldset>
          <legend className="eyebrow mb-2 text-mute">{t.payments.environment}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(["test", "live"] as const).map((value) => (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-2.5 border border-line px-3 py-3 text-[0.875rem] has-checked:border-ink"
              >
                <input
                  type="radio"
                  name="environment"
                  value={value}
                  defaultChecked={settings.environment === value}
                  className="size-4 accent-black"
                />
                {value === "test" ? t.payments.environmentTest : t.payments.environmentLive}
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-[0.75rem] text-mute">{t.payments.environmentHint}</p>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t.payments.merchantCode}
            name="merchant_code"
            defaultValue={settings.merchantCode}
            hint={t.payments.merchantCodeHint}
            inputMode="numeric"
            required
          />
          <Field
            label={t.payments.terminal}
            name="terminal"
            defaultValue={settings.terminal}
            hint={t.payments.terminalHint}
            inputMode="numeric"
            required
          />
          <Field
            label={t.payments.maxAttempts}
            name="max_attempts"
            defaultValue={String(settings.maxAttempts)}
            hint={t.payments.maxAttemptsHint}
            inputMode="numeric"
            span
          />
          <Field
            label={t.payments.merchantName}
            name="merchant_name"
            defaultValue={settings.merchantName}
            hint={t.payments.merchantNameHint}
            span
          />
        </div>

        {/* The secret is write-only: it is never sent back to the browser. */}
        <div className="border-t border-line pt-5">
          <label className="block">
            <span className="eyebrow mb-1.5 block text-mute">{t.payments.secretKey}</span>
            <input
              name="secret_key"
              type="password"
              autoComplete="off"
              placeholder={settings.hasSecret ? "••••••••••••••••••••••••" : ""}
              disabled={!settings.canStoreSecrets}
              className="h-12 w-full border border-line px-3 font-mono text-[0.875rem] outline-none transition focus:border-ink disabled:bg-shell"
            />
            <span className="mt-1 block text-[0.75rem] text-mute">
              {t.payments.secretKeyHint} {settings.hasSecret && t.payments.secretReplace}
            </span>
          </label>

          <p className="mt-3 flex items-start gap-2 text-[0.8125rem]">
            {settings.hasSecret ? (
              <>
                <CheckIcon className="mt-0.5 size-4 shrink-0 text-pine" />
                <span className="font-semibold text-pine">{t.payments.secretStored}</span>
              </>
            ) : settings.secretUnreadable ? (
              <>
                <ShieldIcon className="mt-0.5 size-4 shrink-0 text-rust" />
                <span className="text-ink/80">{t.payments.secretUnreadable}</span>
              </>
            ) : (
              <>
                <CloseIcon className="mt-0.5 size-4 shrink-0 text-flame" />
                <span className="font-semibold text-flame">{t.payments.secretMissing}</span>
              </>
            )}
          </p>

          {!settings.canStoreSecrets && (
            <p className="mt-3 border-l-2 border-flame bg-shell p-3 text-[0.8125rem] leading-relaxed">
              {t.payments.noEncryptionKey}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t border-line pt-5">
          <Button type="submit" size="lg" disabled={saving}>
            {saving ? t.admin.saving : t.admin.save}
          </Button>
          {status.ok && (
            <p className="flex items-center gap-1.5 text-[0.875rem] font-semibold text-pine">
              <CheckIcon className="size-4" />
              {t.payments.saved}
            </p>
          )}
          {message && (
            <p role="alert" className="text-[0.875rem] font-semibold text-flame">
              {message}
            </p>
          )}
        </div>
      </form>

      {/* ------------------------------------------------------------- aside */}
      <aside className="space-y-4">
        <div
          className={cn(
            "border p-5",
            allPassed ? "border-pine bg-pine/5" : "border-rust bg-rust/5",
          )}
        >
          <p className="eyebrow text-mute">{t.payments.status}</p>
          <p className="mt-1 font-display text-xl font-bold uppercase leading-tight">
            {allPassed ? t.payments.statusReady : t.payments.statusIncomplete}
          </p>

          <p className="eyebrow mt-4 text-mute">{t.payments.checks}</p>
          <ul className="mt-2 space-y-1.5">
            {checks.map((check) => (
              <li key={check.label} className="flex items-start gap-2 text-[0.8125rem]">
                {check.passed ? (
                  <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-pine" />
                ) : (
                  <CloseIcon className="mt-0.5 size-3.5 shrink-0 text-flame" />
                )}
                <span className={check.passed ? "text-ink/80" : "text-ink"}>{check.label}</span>
              </li>
            ))}
          </ul>

          {allPassed && !urls.reachable && (
            <p className="mt-4 border-t border-ink/10 pt-3 text-[0.8125rem] leading-relaxed text-ink/80">
              {t.payments.checkUrl}: {t.payments.urlsLocalWarning}
            </p>
          )}
        </div>

        <div className="border border-line bg-white p-5">
          <p className="font-display text-[1.0625rem] font-bold uppercase leading-tight">
            {t.payments.urlsTitle}
          </p>
          <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-mute">
            {t.payments.urlsHint}
          </p>

          <p className="eyebrow mt-4 text-mute">{t.payments.urlNotify}</p>
          <code className="mt-1 block overflow-x-auto whitespace-nowrap bg-shell p-2.5 font-mono text-[0.75rem]">
            {urls.notify}
          </code>

          <p className="eyebrow mt-3 text-mute">{t.payments.urlReturn}</p>
          <code className="mt-1 block overflow-x-auto whitespace-nowrap bg-shell p-2.5 font-mono text-[0.75rem]">
            {urls.returnExample}
          </code>

          {!urls.reachable && (
            <p className="mt-3 border-l-2 border-rust pl-3 text-[0.8125rem] leading-relaxed text-ink/80">
              {t.payments.urlsLocalWarning}
            </p>
          )}
        </div>

        <div className="border border-line bg-white p-5">
          <p className="font-display text-[1.0625rem] font-bold uppercase leading-tight">
            {t.payments.testCards}
          </p>
          <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-mute">
            {t.payments.testCardsHint}
          </p>
        </div>
      </aside>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  hint,
  required,
  span,
  inputMode,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  hint?: string;
  required?: boolean;
  span?: boolean;
  inputMode?: "numeric" | "text";
}) {
  return (
    <label className={cn("block", span && "sm:col-span-2")}>
      <span className="eyebrow mb-1.5 block text-mute">
        {label}
        {required && <span className="text-flame"> *</span>}
      </span>
      <input
        name={name}
        defaultValue={defaultValue}
        inputMode={inputMode}
        className="h-12 w-full border border-line px-3 text-[0.9375rem] outline-none transition focus:border-ink"
      />
      {hint && <span className="mt-1 block text-[0.75rem] text-mute">{hint}</span>}
    </label>
  );
}
