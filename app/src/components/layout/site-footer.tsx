import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { InstagramIcon, ReturnIcon, ShieldIcon, StoreIcon, TruckIcon } from "@/components/icons";
import { Newsletter } from "@/components/layout/newsletter";
import { hasOutlet } from "@/lib/catalog";
import { getCatalog } from "@/lib/db/catalog";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";
import { legalSlug } from "@/lib/pages";
import { buildFooterColumns, buildLegalLinks } from "@/lib/nav";

/*
  Instagram, and nothing else — the row used to carry five icons pointing at
  tiktok.com, x.com, youtube.com and facebook.com, which are the platforms'
  front doors rather than accounts. A shopper who clicked one landed on a login
  wall having been told the shop was there, and none of those accounts exist.

  One link that goes somewhere beats five that do not, and it is now wide enough
  to say where it goes: a single 40px square in an otherwise empty row reads as
  four icons that failed to load.
*/
const INSTAGRAM = { handle: "@guilleoutes", url: "https://www.instagram.com/guilleoutes/" };

export async function SiteFooter({ locale }: { locale: Locale }) {
  // The catalogue is only read to know whether there is an outlet to link to.
  // `getCatalog` is request-cached, so this shares the header's round trip.
  const [t, catalog] = await Promise.all([getDictionary(locale), getCatalog(locale)]);
  const columns = buildFooterColumns(locale, t, { outlet: hasOutlet(catalog.products) });
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
      {/*
        Pure black, matching the header.

        This was #1C1C1C, which is the kind of nearly-black that reads as a choice
        nobody made — and with the masthead now at #000 the two ends of the page
        would have disagreed by a shade. `--color-ink-soft` has been repurposed as
        the body-copy grey (`--text-secondary`) that `design.md` actually asks for,
        which this was the only caller of.
      */}
      <div data-chrome="dark" className="bg-black text-white">
        <div className="shell grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <Logo className="h-6 text-white" />
            <p className="mt-4 text-[0.8125rem] leading-relaxed text-white/60">
              {t.footer.about}
            </p>
            <a
              href={INSTAGRAM.url}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-5 inline-flex items-center gap-2.5 border border-white/20 py-2 pl-2.5 pr-4 transition hover:border-white hover:bg-white hover:text-ink"
            >
              <InstagramIcon className="size-[1.15rem]" />
              <span className="font-display text-[0.875rem] font-bold uppercase tracking-wide">
                {INSTAGRAM.handle}
              </span>
            </a>
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

        {/* Legal */}
        <div className="border-t border-white/10">
          <div className="shell flex flex-col gap-5 py-6 lg:flex-row lg:items-center lg:justify-between">
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

            {/* Studio credit */}
            <a
              href="https://www.plakastudio.com"
              target="_blank"
              rel="noreferrer noopener"
              className="group inline-flex shrink-0 items-center gap-2 self-start text-[0.75rem] text-white/35 transition-colors hover:text-white/60 lg:self-auto"
            >
              {t.footer.legal.credit}
              <span className="relative font-display font-bold uppercase tracking-[0.14em] text-white/70 transition-colors group-hover:text-white">
                Plaka Studio
                <span
                  aria-hidden
                  className="absolute -bottom-1 left-0 h-px w-full origin-right scale-x-0 bg-current transition-transform duration-300 ease-out group-hover:origin-left group-hover:scale-x-100"
                />
              </span>
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-3 transition-transform duration-300 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              >
                <path d="M7 17 17 7M9 7h8v8" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
