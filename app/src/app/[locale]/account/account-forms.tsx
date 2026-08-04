"use client";

import { useState, useTransition } from "react";
import { useI18n } from "@/components/i18n/provider";
import { CheckIcon, CloseIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  deleteAddress,
  saveAddress,
  updateProfile,
  type AccountResult,
} from "@/lib/account/actions";
import type { CustomerAddress } from "@/lib/db/account";
import { cn } from "@/lib/utils";

/* --------------------------------------------------------------- profile */

export function ProfileForm({ fullName, email }: { fullName: string | null; email: string }) {
  const { t } = useI18n();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  return (
    <form
      action={async (form) => {
        const result = await updateProfile(form);
        setStatus(result.ok ? "saved" : "error");
      }}
    >
      {/*
        Two short fields and a button laid out in a row from `sm` up. Stacked in a
        `max-w-sm` column they left most of the account panel empty on a desktop,
        which read as a broken page rather than a deliberately narrow form.

        The button is a grid item rather than a trailing block so it lines up with
        the inputs; `items-end` keeps it on their baseline even though the labels
        above make the field cells taller.
      */}
      <div className="grid gap-4 sm:grid-cols-[minmax(12rem,1fr)_minmax(14rem,1.25fr)_auto] sm:items-end">
        <label className="block">
          <span className="eyebrow mb-1.5 block text-mute">{t.auth.fullName}</span>
          <input
            name="full_name"
            defaultValue={fullName ?? ""}
            autoComplete="name"
            onChange={() => setStatus("idle")}
            className="h-12 w-full border border-line px-3 text-[0.9375rem] outline-none transition focus:border-ink"
          />
        </label>

        <div className="block min-w-0">
          <span className="eyebrow mb-1.5 block text-mute">{t.auth.email}</span>
          {/* The address is managed by the auth service, not by this form. */}
          <p className="flex h-12 items-center overflow-hidden border border-line-soft bg-shell px-3 text-[0.9375rem] text-mute">
            <span className="truncate">{email}</span>
          </p>
        </div>

        <Button type="submit" className="h-12">
          {t.account.saveChanges}
        </Button>
      </div>

      {status === "saved" && (
        <p className="mt-3 flex items-center gap-1.5 text-[0.875rem] font-semibold text-pine">
          <CheckIcon className="size-4" />
          {t.account.savedChanges}
        </p>
      )}
      {status === "error" && (
        <p role="alert" className="mt-3 text-[0.875rem] font-semibold text-flame">
          {t.admin.error}
        </p>
      )}
    </form>
  );
}

/* ------------------------------------------------------------- addresses */

export function AddressBook({ addresses }: { addresses: CustomerAddress[] }) {
  const { t } = useI18n();
  const [adding, setAdding] = useState(addresses.length === 0);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = async (action: (form: FormData) => Promise<AccountResult>, form: FormData) => {
    const result = await action(form);
    setError(result.ok ? null : result.error);
    if (result.ok) setAdding(false);
  };

  return (
    <div className="space-y-6">
      {addresses.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2">
          {addresses.map((address) => (
            <li key={address.id} className="relative border border-line p-5">
              {address.isDefault && (
                <span className="eyebrow absolute right-4 top-4 bg-ink px-2 py-1 text-white">
                  {t.account.defaultAddress}
                </span>
              )}
              {address.label && <p className="eyebrow mb-2 text-flame">{address.label}</p>}
              <p className="text-[0.9375rem] font-semibold">{address.fullName}</p>
              <p className="mt-1 text-[0.875rem] leading-relaxed text-mute">
                {address.line1}
                {address.line2 && <>, {address.line2}</>}
                <br />
                {address.postcode} {address.city}
                <br />
                {address.province}
                {address.phone && (
                  <>
                    <br />
                    {address.phone}
                  </>
                )}
              </p>

              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const form = new FormData();
                    form.set("id", address.id);
                    await run(deleteAddress, form);
                  })
                }
                aria-label={t.common.remove}
                className="mt-3 inline-flex items-center gap-1.5 text-[0.8125rem] text-mute underline hover:text-flame"
              >
                <CloseIcon className="size-3.5" />
                {t.common.remove}
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form
          action={(form) => run(saveAddress, form)}
          className="grid max-w-2xl gap-4 border border-line p-5 sm:grid-cols-2"
        >
          <Field label={t.account.addressLabel} name="label" hint={t.account.addressLabelHint} />
          <Field label={t.checkout.firstName} name="full_name" required />
          <Field label={t.checkout.address} name="line1" required span />
          <Field label={t.checkout.addressExtra} name="line2" span />
          <Field label={t.checkout.postcode} name="postcode" required />
          <Field label={t.checkout.city} name="city" required />
          <Field label={t.checkout.province} name="province" required />
          <Field label={t.checkout.phone} name="phone" type="tel" />

          <label className="flex items-center gap-2.5 text-[0.875rem] sm:col-span-2">
            <input
              type="checkbox"
              name="is_default"
              defaultChecked={addresses.length === 0}
              className="size-4 accent-black"
            />
            {t.account.makeDefault}
          </label>

          {error && (
            <p role="alert" className="text-[0.875rem] font-semibold text-flame sm:col-span-2">
              {t.admin.error}
            </p>
          )}

          <div className="flex gap-3 sm:col-span-2">
            <Button type="submit">{t.account.saveChanges}</Button>
            {addresses.length > 0 && (
              <Button type="button" variant="outline" onClick={() => setAdding(false)}>
                {t.admin.cancel}
              </Button>
            )}
          </div>
        </form>
      ) : (
        <Button variant="outline" onClick={() => setAdding(true)}>
          {t.account.addAddress}
        </Button>
      )}
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  hint,
  span,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  hint?: string;
  span?: boolean;
}) {
  return (
    <label className={cn("block", span && "sm:col-span-2")}>
      <span className="eyebrow mb-1.5 block text-mute">
        {label}
        {required && <span className="text-flame"> *</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        className="h-12 w-full border border-line px-3 text-[0.9375rem] outline-none transition focus:border-ink"
      />
      {hint && <span className="mt-1 block text-[0.75rem] text-mute">{hint}</span>}
    </label>
  );
}
