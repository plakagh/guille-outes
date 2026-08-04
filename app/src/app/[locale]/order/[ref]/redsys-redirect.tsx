"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";

/**
 * Hands the shopper over to the bank.
 *
 * Redsys expects a normal form POST from the browser, so the fields are rendered
 * server-side (already signed) and submitted on mount. The manual button is the
 * fallback for anyone with JavaScript disabled — and it is what the shopper sees
 * if the auto-submit is blocked.
 *
 * Nothing sensitive is in these fields: the signature is derived from the
 * merchant secret but does not contain it.
 */
export function RedsysRedirect({
  endpoint,
  fields,
}: {
  endpoint: string;
  fields: Record<string, string>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);
  const { t } = useI18n();

  useEffect(() => {
    if (submitted.current) return;
    submitted.current = true;
    formRef.current?.submit();
  }, []);

  return (
    <div className="shell flex flex-col items-start gap-4 py-20">
      <h1 className="text-[clamp(1.75rem,4vw,2.75rem)] leading-[0.95]">{t.order.redirecting}</h1>
      <p className="max-w-md text-[0.9375rem] text-mute">{t.order.redirectingBody}</p>

      <form ref={formRef} method="POST" action={endpoint}>
        {Object.entries(fields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <Button type="submit" size="lg" className="mt-2">
          {t.order.continueToBank}
        </Button>
      </form>
    </div>
  );
}
