import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ButtonLink } from "@/components/ui/button";
import { canSendMail, sendMail } from "@/lib/email/mailer";
import { newsletterWelcomeEmail } from "@/lib/email/templates";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";
import { confirmSubscription } from "@/lib/newsletter/store";
import { issueWelcomeCode } from "@/lib/newsletter/welcome-code";
import { SITE_URL } from "@/lib/supabase/env";

/**
 * The confirmation click — the moment consent becomes provable.
 *
 * Not indexable and never cached: the URL carries a one-shot token, and a cached
 * copy of "you are subscribed" served to someone else would be nonsense.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { robots: { index: false, follow: false } };
}

export default async function NewsletterConfirmPage(
  props: PageProps<"/[locale]/newsletter/confirm">,
) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();

  const { token } = await props.searchParams;
  const t = await getDictionary(locale);
  const n = t.footer.newsletter;

  const outcome = await confirmSubscription(
    typeof token === "string" ? token : "",
    await clientIp(),
  );

  // The welcome email goes out only on the transition, so a second visit (or a
  // mail client prefetching the link) cannot trigger a duplicate — and neither
  // can it mint a second discount code.
  //
  // The code is issued here, at the click, rather than when the form was
  // submitted: this is the first moment the offer has an owner, because it is the
  // first moment we know the address belongs to whoever asked. Issuing at
  // submission would hand 10 % to anyone who typed a stranger's address into the
  // footer, which is the whole thing double opt-in is for.
  if (outcome.status === "confirmed" && canSendMail()) {
    const offer = await issueWelcomeCode(outcome.email);

    const message = newsletterWelcomeEmail(
      {
        email: outcome.email,
        shopUrl: `${SITE_URL}${href(locale, "shop")}`,
        unsubscribeUrl: `${SITE_URL}${href(
          locale,
          "newsletterUnsubscribe",
        )}?token=${encodeURIComponent(outcome.unsubscribeToken)}`,
        // Null when this address has already spent a welcome code, which is what
        // someone who unsubscribed and came back gets. The email still goes.
        discount: offer && {
          code: offer.code,
          percent: offer.percent,
          expires: new Date(offer.expiresAt).toLocaleDateString(locale, {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
        },
      },
      t,
    );
    await sendMail({ to: outcome.email, ...message });
  }

  const panel = {
    confirmed: { title: n.confirmedTitle, body: n.confirmedBody },
    already_confirmed: { title: n.alreadyTitle, body: n.alreadyBody },
    expired: { title: n.expiredTitle, body: n.expiredBody },
    invalid: { title: n.invalidTitle, body: n.invalidBody },
  }[outcome.status];

  const good = outcome.status === "confirmed" || outcome.status === "already_confirmed";

  return (
    <div className="shell flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <span className={`eyebrow mb-3 ${good ? "text-flame" : "text-mute"}`}>{n.eyebrow}</span>
      <h1 className="max-w-2xl text-[clamp(2rem,5vw,3.5rem)] leading-[0.95]">{panel.title}</h1>
      <p className="mt-4 max-w-md text-[0.9375rem] leading-relaxed text-mute">{panel.body}</p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href={href(locale, "shop")}>{n.keepShopping}</ButtonLink>
        {!good && (
          <ButtonLink href={href(locale)} variant="outline">
            {t.plp.breadcrumbHome}
          </ButtonLink>
        )}
      </div>
    </div>
  );
}

async function clientIp(): Promise<string | null> {
  const list = await headers();
  const forwarded = list.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || list.get("x-real-ip")?.trim() || null;
}
