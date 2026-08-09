import { notFound } from "next/navigation";
import { SettingsEditor } from "@/app/[locale]/admin/settings/settings-editor";
import { getNotificationSettings, getPromoDrafts, getShippingSettings } from "@/lib/db/settings";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";

/**
 * Shop settings: what delivery costs, what the promo bar says, and where the shop
 * is told about an order.
 *
 * Both were constants in the code, which meant a rate change or a campaign line
 * needed a deploy. Reads and writes run under the administrator's own session, so
 * Row Level Security is the gate — this page only decides what to render.
 */
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage(props: PageProps<"/[locale]/admin/settings">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();

  const [t, shipping, promos, notifications] = await Promise.all([
    getDictionary(locale),
    getShippingSettings(),
    getPromoDrafts(),
    getNotificationSettings(),
  ]);

  return (
    <div className="shell space-y-8 py-8">
      <header>
        <h1 className="text-3xl">{t.admin.shop.title}</h1>
        <p className="mt-2 max-w-2xl text-[0.9375rem] text-mute">{t.admin.shop.blurb}</p>
      </header>

      <SettingsEditor
        shipping={shipping}
        promos={promos}
        notifications={notifications}
        t={t}
      />
    </div>
  );
}
