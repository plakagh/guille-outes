import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaymentForm, type GatewayCheck } from "@/app/[locale]/admin/payments/payment-form";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { buildRedsysForm } from "@/lib/payments/redsys";
import { gatewayUrls, getPaymentSettingsView } from "@/lib/payments/settings";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminPaymentsPage(props: PageProps<"/[locale]/admin/payments">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();

  const [t, settings] = await Promise.all([getDictionary(locale), getPaymentSettingsView()]);

  // The layout already refuses non-admins; a null here means the same thing.
  if (!settings) notFound();

  const urls = gatewayUrls();

  // A real end-to-end signature attempt is the only check that proves the
  // credentials actually work together, so it runs for real with a throwaway
  // order reference. Nothing is sent anywhere.
  let canSign = false;
  if (settings.hasSecret && settings.merchantCode) {
    try {
      const { getRedsysCredentials } = await import("@/lib/payments/settings");
      const credentials = await getRedsysCredentials();
      if (credentials) {
        buildRedsysForm(credentials, {
          orderRef: "0000TESTSIGN",
          amountCents: 100,
          locale,
          notifyUrl: urls.notify,
          successUrl: urls.returnExample,
          failureUrl: urls.returnExample,
        });
        canSign = true;
      }
    } catch {
      canSign = false;
    }
  }

  const checks: GatewayCheck[] = [
    { label: t.payments.checkMerchant, passed: /^\d{9}$/.test(settings.merchantCode) },
    { label: t.payments.checkTerminal, passed: /^\d{1,3}$/.test(settings.terminal) },
    { label: t.payments.checkSecret, passed: settings.hasSecret },
    { label: t.payments.checkSignature, passed: canSign },
    { label: t.payments.checkEnabled, passed: settings.enabled },
  ];

  return (
    <>
      <div className="border-b border-line bg-white">
        <div className="shell py-6">
          <p className="eyebrow text-flame">{t.payments.eyebrow}</p>
          <h1 className="mt-1 text-3xl">{t.payments.title}</h1>
        </div>
      </div>

      <PaymentForm settings={settings} urls={urls} checks={checks} />
    </>
  );
}
