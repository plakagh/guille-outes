import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/bits";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { createClient } from "@/lib/supabase/server";

/**
 * The newsletter list.
 *
 * Read with the administrator's own session, so Row Level Security is what grants
 * access — not this page. The list is unreachable with the public anon key at all,
 * because a subscriber list is a list of people's email addresses.
 *
 * Deliberately read-only: adding someone by hand would be a consent record we
 * cannot back up, and removing them from here would lose the withdrawal trail. A
 * subscriber leaves through their own unsubscribe link.
 */
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  email: string;
  status: "pending" | "confirmed" | "unsubscribed";
  locale: string;
  source: string;
  consent_version: string;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
  created_at: string;
};

const TONE = {
  confirmed: "new",
  pending: "limited",
  unsubscribed: "soldout",
} as const;

export default async function AdminNewsletterPage(
  props: PageProps<"/[locale]/admin/newsletter">,
) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();

  const t = await getDictionary(locale);
  const supabase = await createClient();

  const { data } = await supabase
    .from("newsletter_subscribers")
    .select(
      "id, email, status, locale, source, consent_version, confirmed_at, unsubscribed_at, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = (data ?? []) as Row[];
  const counts = {
    confirmed: rows.filter((row) => row.status === "confirmed").length,
    pending: rows.filter((row) => row.status === "pending").length,
    unsubscribed: rows.filter((row) => row.status === "unsubscribed").length,
  };

  const label = t.admin.newsletter;

  return (
    <div className="shell space-y-8 py-8">
      <header>
        <h1 className="text-3xl">{label.title}</h1>
        <p className="mt-2 max-w-2xl text-[0.9375rem] text-mute">{label.blurb}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        {(["confirmed", "pending", "unsubscribed"] as const).map((status) => (
          <div key={status} className="border border-line bg-white p-5">
            <p className="eyebrow text-mute">{label.status[status]}</p>
            <p className="mt-1 font-display text-4xl font-bold leading-none">{counts[status]}</p>
          </div>
        ))}
      </div>

      <section className="border border-line bg-white p-6">
        <h2 className="mb-4 text-2xl">{label.list}</h2>

        {rows.length === 0 ? (
          <p className="text-[0.9375rem] text-mute">{label.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-[0.875rem]">
              <thead className="border-b border-line bg-shell">
                <tr>
                  <th className="p-2.5 text-left font-display uppercase">{label.email}</th>
                  <th className="p-2.5 text-left font-display uppercase">{label.state}</th>
                  <th className="p-2.5 text-left font-display uppercase">{t.common.language}</th>
                  <th className="p-2.5 text-left font-display uppercase">{label.source}</th>
                  <th className="p-2.5 text-left font-display uppercase">{label.since}</th>
                  <th className="p-2.5 text-left font-display uppercase">{label.consent}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-line-soft">
                    <td className="p-2.5 font-semibold">{row.email}</td>
                    <td className="p-2.5">
                      <Badge tone={TONE[row.status]}>{label.status[row.status]}</Badge>
                    </td>
                    <td className="p-2.5 uppercase text-mute">{row.locale}</td>
                    <td className="p-2.5 text-mute">{row.source}</td>
                    <td className="p-2.5 text-mute">
                      {new Date(
                        row.status === "unsubscribed"
                          ? (row.unsubscribed_at ?? row.created_at)
                          : (row.confirmed_at ?? row.created_at),
                      ).toLocaleDateString(locale)}
                    </td>
                    <td className="p-2.5 tabular-nums text-mute">{row.consent_version}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
