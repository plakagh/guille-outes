"use client";

import { useTransition } from "react";
import { useI18n } from "@/components/i18n/provider";
import { CheckIcon, CloseIcon, ShieldIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { setMarketingConsent } from "@/lib/legal/actions";

export type ConsentRecord = {
  id: string;
  kind: "terms" | "marketing";
  granted: boolean;
  docVersion: string;
  createdAt: string;
};

export function PrivacyPanel({
  marketing,
  history,
}: {
  marketing: boolean;
  history: ConsentRecord[];
}) {
  const { t, locale } = useI18n();
  const [pending, start] = useTransition();

  const toggle = () =>
    start(async () => {
      const form = new FormData();
      form.set("locale", locale);
      form.set("granted", String(!marketing));
      await setMarketingConsent(form);
    });

  const termsRecord = history.find(
    (row) => row.kind === "terms" && row.granted,
  );

  return (
    <section className="mt-10 border-t border-line pt-8">
      <h2 className="mb-1 text-2xl">{t.auth.privacyConsent}</h2>

      {/*
        Two columns from `lg` up: consent state and its history on the left, the
        data rights on the right. Capped at one narrow column these blocks left the
        right half of the account panel empty on a desktop.
      */}
      <div className="mt-5 grid items-start gap-5 lg:grid-cols-2 lg:gap-8">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border border-line p-5">
            <p className="flex items-start gap-2 text-[0.9375rem]">
              {marketing ? (
                <CheckIcon className="mt-0.5 size-5 shrink-0 text-pine" />
              ) : (
                <CloseIcon className="mt-0.5 size-5 shrink-0 text-mute" />
              )}
              {marketing ? t.auth.marketingOn : t.auth.marketingOff}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={toggle}
              disabled={pending}
            >
              {marketing ? t.auth.marketingToggleOff : t.auth.marketingToggleOn}
            </Button>
          </div>

          {termsRecord && (
            <p className="text-[0.875rem] text-mute">
              {t.auth.termsAcceptedOn}{" "}
              <span className="font-semibold text-ink">
                {new Date(termsRecord.createdAt).toLocaleDateString(locale)}
              </span>{" "}
              · {t.auth.docVersion} {termsRecord.docVersion}
            </p>
          )}

          {history.length > 0 && (
            <details className="border border-line">
              <summary className="cursor-pointer px-5 py-3 text-[0.875rem] font-semibold">
                {t.auth.consentHistory}
              </summary>
              <ul className="divide-y divide-line-soft border-t border-line">
                {history.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center gap-3 px-5 py-2.5 text-[0.8125rem]"
                  >
                    <span className={row.granted ? "text-pine" : "text-mute"}>
                      {row.granted ? "✓" : "✕"}
                    </span>
                    <span className="flex-1">
                      {row.kind === "marketing"
                        ? t.auth.acceptMarketingLabel
                        : t.checkout.termsLink}
                    </span>
                    <span className="text-mute">{row.docVersion}</span>
                    <span className="text-mute">
                      {new Date(row.createdAt).toLocaleDateString(locale)}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        {/* Rights of access and erasure, spelled out rather than buried. */}
        <div className="space-y-3 border-l-2 border-line bg-shell p-5">
          <p className="flex items-start gap-2 text-[0.875rem] font-semibold">
            <ShieldIcon className="mt-0.5 size-4 shrink-0" />
            {t.auth.downloadMyData}
          </p>
          <p className="text-[0.8125rem] leading-relaxed text-mute">
            {t.auth.downloadMyDataHint}
          </p>
          <p className="pt-2 text-[0.875rem] font-semibold">
            {t.auth.deleteAccount}
          </p>
          <p className="text-[0.8125rem] leading-relaxed text-mute">
            {t.auth.deleteAccountHint}
          </p>
        </div>
      </div>
    </section>
  );
}
