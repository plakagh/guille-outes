import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ButtonLink } from "@/components/ui/button";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";
import { unsubscribeByToken } from "@/lib/newsletter/store";

/**
 * One-click withdrawal of consent (RGPD Art. 7(3)).
 *
 * No login, no confirmation step, no "are you sure": the link in the email is
 * the whole flow, and it keeps working for old newsletters — a token that has
 * already been used lands on "you are already off the list" rather than an error.
 *
 * It runs on GET, which is unusual for a mutation, and deliberate: mail clients
 * cannot post forms. That is also why the token is long and random — it is the
 * only thing authorising the change, and it can only ever *remove* someone.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { robots: { index: false, follow: false } };
}

export default async function NewsletterUnsubscribePage(
  props: PageProps<"/[locale]/newsletter/unsubscribe">,
) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();

  const { token } = await props.searchParams;
  const t = await getDictionary(locale);
  const n = t.footer.newsletter;

  const outcome = await unsubscribeByToken(
    typeof token === "string" ? token : "",
    await clientIp(),
  );

  const panel = {
    unsubscribed: { title: n.goneTitle, body: n.goneBody },
    already_unsubscribed: { title: n.goneTitle, body: n.goneAlreadyBody },
    invalid: { title: n.invalidTitle, body: n.invalidBody },
  }[outcome.status];

  return (
    <div className="shell flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <span className="eyebrow mb-3 text-mute">{n.eyebrow}</span>
      <h1 className="max-w-2xl text-[clamp(2rem,5vw,3.5rem)] leading-[0.95]">{panel.title}</h1>
      <p className="mt-4 max-w-md text-[0.9375rem] leading-relaxed text-mute">{panel.body}</p>

      <div className="mt-8">
        <ButtonLink href={href(locale, "shop")} variant="outline">
          {n.keepShopping}
        </ButtonLink>
      </div>
    </div>
  );
}

async function clientIp(): Promise<string | null> {
  const list = await headers();
  const forwarded = list.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || list.get("x-real-ip")?.trim() || null;
}
