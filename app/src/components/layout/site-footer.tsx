import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import {
  FacebookIcon,
  InstagramIcon,
  PaymentMark,
  ReturnIcon,
  ShieldIcon,
  StoreIcon,
  TiktokIcon,
  TruckIcon,
  XIcon,
  YoutubeIcon,
} from "@/components/icons";
import { Newsletter } from "@/components/layout/newsletter";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";
import { legalSlug } from "@/lib/pages";
import { buildFooterColumns, buildLegalLinks } from "@/lib/nav";

const SOCIALS = [
  { label: "Instagram", url: "https://instagram.com", Icon: InstagramIcon },
  { label: "TikTok", url: "https://tiktok.com", Icon: TiktokIcon },
  { label: "X", url: "https://x.com", Icon: XIcon },
  { label: "YouTube", url: "https://youtube.com", Icon: YoutubeIcon },
  { label: "Facebook", url: "https://facebook.com", Icon: FacebookIcon },
];

const PAYMENTS = ["Visa", "Mastercard", "Amex", "PayPal", "Bizum", "Apple Pay", "Klarna"];

export async function SiteFooter({ locale }: { locale: Locale }) {
  const t = await getDictionary(locale);
  const columns = buildFooterColumns(locale, t);
  const legal = buildLegalLinks(locale, t);

  const guarantees = [
    { Icon: TruckIcon, title: t.footer.guarantees.shippingTitle, body: t.footer.guarantees.shippingBody },
    { Icon: ReturnIcon, title: t.footer.guarantees.returnsTitle, body: t.footer.guarantees.returnsBody },
    { Icon: ShieldIcon, title: t.footer.guarantees.paymentTitle, body: t.footer.guarantees.paymentBody },
    { Icon: StoreIcon, title: t.footer.guarantees.madeTitle, body: t.footer.guarantees.madeBody },
  ];

  return (
    <footer>
      {/* Guarantee strip */}
      <div className="border-y border-line bg-shell">
        <ul className="shell grid gap-6 py-8 sm:grid-cols-2 lg:grid-cols-4">
          {guarantees.map(({ Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <Icon className="size-7 shrink-0" />
              <div>
                <p className="font-display text-[1.0625rem] font-bold uppercase leading-tight">
                  {title}
                </p>
                <p className="mt-1 text-[0.8125rem] leading-snug text-mute">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <Newsletter
        t={t}
        locale={locale}
        privacyHref={href(locale, "legal", legalSlug("privacidad", locale))}
      />

      {/* Link columns */}
      <div className="bg-ink-soft text-white">
        <div className="shell grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <Logo className="h-6 text-white" />
            <p className="mt-4 max-w-xs text-[0.8125rem] leading-relaxed text-white/60">
              {t.footer.about}
            </p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {SOCIALS.map(({ label, url, Icon }) => (
                <li key={label}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={label}
                    className="grid size-10 place-items-center border border-white/20 transition hover:border-white hover:bg-white hover:text-ink"
                  >
                    <Icon className="size-[1.15rem]" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {columns.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <p className="eyebrow mb-4 text-white/50">{column.heading}</p>
              <ul className="space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="text-[0.875rem] text-white/80 transition hover:text-white hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Payments + legal */}
        <div className="border-t border-white/10">
          <div className="shell flex flex-col gap-5 py-6 lg:flex-row lg:items-center lg:justify-between">
            <ul className="flex flex-wrap items-center gap-2">
              {PAYMENTS.map((label) => (
                <li key={label}>
                  <PaymentMark label={label} />
                </li>
              ))}
            </ul>

            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.75rem] text-white/60">
              {legal.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition hover:text-white hover:underline">
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                © {new Date().getFullYear()} {t.meta.siteName}. {t.footer.legal.rights}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
