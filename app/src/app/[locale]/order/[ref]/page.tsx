import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RedsysRedirect } from "@/app/[locale]/order/[ref]/redsys-redirect";
import { ProductArt } from "@/components/brand/product-art";
import { ProductShot } from "@/components/product/product-shot";
import { Badge, Breadcrumbs } from "@/components/ui/bits";
import { ButtonLink } from "@/components/ui/button";
import { colorway, frameLabel } from "@/lib/catalog";
import { getCatalog } from "@/lib/db/catalog";
import { getOrderByRef } from "@/lib/db/orders";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";
import { helpSlug } from "@/lib/pages";
import { attemptState, startAttempt } from "@/lib/payments/attempts";
import { buildRedsysForm } from "@/lib/payments/redsys";
import { getRedsysCredentials } from "@/lib/payments/settings";
import { SITE_URL } from "@/lib/supabase/env";
import { formatVatRate, vatBreakdown } from "@/lib/tax";
import { formatPrice } from "@/lib/utils";

export async function generateMetadata(
  props: PageProps<"/[locale]/order/[ref]">,
): Promise<Metadata> {
  const { locale } = await props.params;
  if (!isLocale(locale)) return {};
  const t = await getDictionary(locale);
  return { title: t.order.title, robots: { index: false, follow: false } };
}

const STATUS_TONE = {
  pending: "neutral",
  paid: "new",
  failed: "sale",
  cancelled: "soldout",
  refunded: "limited",
} as const;

function statusLabel(status: string, t: Dictionary): string {
  switch (status) {
    case "paid":
      return t.order.statusPaid;
    case "failed":
      return t.order.statusFailed;
    case "cancelled":
      return t.order.statusCancelled;
    case "refunded":
      return t.order.statusRefunded;
    default:
      return t.order.statusPending;
  }
}

export default async function OrderPage(props: PageProps<"/[locale]/order/[ref]">) {
  const [{ locale, ref }, searchParams] = await Promise.all([props.params, props.searchParams]);
  if (!isLocale(locale)) notFound();

  const [t, order, catalog] = await Promise.all([
    getDictionary(locale),
    getOrderByRef(ref),
    getCatalog(locale),
  ]);

  // Lines are matched to the catalogue by reference — see the item list below.
  const productsByRef = new Map(catalog.products.map((product) => [product.ref, product]));

  // RLS means a customer can only ever load their own order, so "not found" and
  // "not yours" look the same from here — which is what we want.
  if (!order) {
    return (
      <div className="shell flex flex-col items-start gap-4 py-20">
        <h1 className="text-3xl">{t.order.notFound}</h1>
        <p className="max-w-md text-[0.9375rem] text-mute">{t.order.notFoundBody}</p>
        <ButtonLink href={href(locale, "account")} variant="outline">
          {t.account.orders}
        </ButtonLink>
      </div>
    );
  }

  const attempts = await attemptState(order.id);

  // A pending order with a configured gateway goes straight to the bank, unless
  // the shopper explicitly came back (?fallo=1) or asked to see the summary.
  const returning = searchParams.fallo === "1" || searchParams.ver === "1";

  if (order.status !== "paid" && !returning) {
    const credentials = await getRedsysCredentials();

    if (credentials) {
      // Each attempt needs its own gateway reference: Redsys rejects a repeated
      // Ds_Merchant_Order, so a retry cannot reuse the order's own.
      const started = await startAttempt(order.id);

      if (started.ok) {
        const orderUrl = `${SITE_URL}${href(locale, "order", order.orderRef)}`;
        const form = buildRedsysForm(credentials, {
          orderRef: started.attempt.gatewayRef,
          amountCents: started.attempt.amountCents,
          description: `${t.meta.siteName} · ${order.orderRef}`,
          cardHolder: order.shipName,
          locale,
          notifyUrl: `${SITE_URL}/api/payments/redsys/notify`,
          successUrl: orderUrl,
          failureUrl: `${orderUrl}?fallo=1`,
        });

        return <RedsysRedirect endpoint={form.endpoint} fields={form.fields} />;
      }
      // Exhausted or already paid: fall through to the summary below.
    }
  }

  const gatewayMissing = order.status === "pending" && !(await getRedsysCredentials());
  const tax = vatBreakdown(order.amountCents, order.vatRate);
  const exhausted = attempts.left === 0 && order.status !== "paid";

  // The "failed" copy invites another card, which would contradict the panel
  // below once the attempts are gone — so exhaustion gets its own headline.
  const headline =
    order.status === "paid"
      ? { title: t.order.paidThanksTitle, body: t.order.paidThanksBody }
      : exhausted
        ? { title: t.order.noAttemptsLeft, body: t.order.noAttemptsLeftBody }
        : order.status === "failed"
          ? { title: t.order.failedTitle, body: t.order.failedBody }
          : order.status === "cancelled"
            ? { title: t.order.cancelledTitle, body: t.order.cancelledBody }
            : { title: t.order.pendingTitle, body: t.order.pendingBody };

  return (
    <div className="shell py-6 lg:py-10">
      <Breadcrumbs
        label={t.plp.breadcrumbHome}
        trail={[
          { label: t.plp.breadcrumbHome, href: href(locale) },
          { label: t.account.orders, href: `${href(locale, "account")}?tab=orders` },
          { label: order.orderRef },
        ]}
        className="mb-5"
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[clamp(2rem,5vw,3.25rem)] leading-[0.9]">{headline.title}</h1>
          <p className="mt-3 max-w-lg text-[0.9375rem] leading-relaxed text-mute">
            {headline.body}
          </p>
        </div>
        <Badge tone={STATUS_TONE[order.status]}>{statusLabel(order.status, t)}</Badge>
      </div>

      {gatewayMissing && (
        <div className="mt-6 max-w-2xl border-l-2 border-gold bg-shell p-4">
          <p className="font-semibold">{t.order.gatewayNotReady}</p>
          <p className="mt-1 text-[0.875rem] text-mute">{t.order.gatewayNotReadyBody}</p>
        </div>
      )}

      {(order.status === "failed" || order.status === "cancelled") && !exhausted && (
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <ButtonLink href={href(locale, "order", order.orderRef)}>{t.order.retry}</ButtonLink>
          <p className="text-[0.875rem] font-semibold text-mute">
            {attempts.left === 1
              ? t.order.attemptsLeftOne
              : t.order.attemptsLeftMany.replace("{{left}}", String(attempts.left))}
          </p>
        </div>
      )}

      {exhausted && (
        <div className="mt-6 max-w-2xl border-l-2 border-flame bg-shell p-4">
          <p className="font-semibold">{t.order.noAttemptsLeftHelp}</p>
          <Link
            href={href(locale, "help", helpSlug("contacto", locale))}
            className="mt-3 inline-block text-[0.875rem] font-semibold underline hover:text-flame"
          >
            {t.order.contactUs}
          </Link>
        </div>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14">
        <section>
          <h2 className="mb-4 text-2xl">{t.order.items}</h2>
          <ul className="divide-y divide-line border-y border-line">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center gap-4 py-4">
                <span className="size-16 shrink-0 bg-shell">
                  {(() => {
                    /*
                      The line snapshots what was bought, not what it looked
                      like, so the picture is found by reference in today's
                      catalogue. A product that has since been withdrawn — or
                      never photographed — falls back to the drawing, which is
                      the only thing a line without a match can show.
                    */
                    const product = item.ref ? productsByRef.get(item.ref) : undefined;
                    return product ? (
                      <ProductShot
                        product={product}
                        colorway={colorway(item.colorwayId, locale)}
                        print="none"
                      />
                    ) : (
                      <ProductArt
                        shape="tee"
                        colorway={colorway(item.colorwayId, locale)}
                        print="none"
                      />
                    );
                  })()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.9375rem] font-semibold">{item.name}</span>
                  <span className="block text-[0.8125rem] text-mute">
                    {colorway(item.colorwayId, locale).name} · {t.cart.size} {item.size} · ×
                    {item.qty}
                  </span>
                  {/*
                    Which drawing is printed on it. Read from the order's own
                    snapshot, so it still says the right thing after the family
                    has taken the drawing off the gallery.
                  */}
                  {/* Which frame was ordered, and what it cost. Read from the
                      order's own snapshot: what the product page offers today
                      has no say over what this parcel contains. */}
                  {item.frameFinish && (
                    <span className="block text-[0.8125rem]">
                      {frameLabel(item.frameFinish, t.pdp)}
                      {item.frameSurchargeCents > 0 && (
                        <span className="text-mute">
                          {" "}
                          (+{formatPrice(item.frameSurchargeCents)})
                        </span>
                      )}
                    </span>
                  )}
                  {item.artworkTitle && (
                    <span className="block text-[0.8125rem] text-mute">
                      {t.gallery.printedWith} «{item.artworkTitle}»
                    </span>
                  )}
                </span>
                <span className="text-[0.9375rem] font-semibold">
                  {formatPrice(item.unitPriceCents * item.qty)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <aside className="space-y-5">
          <dl className="border border-line p-5 text-[0.875rem]">
            <dt className="eyebrow text-mute">{t.order.reference}</dt>
            <dd className="mt-1 font-mono text-[0.9375rem] font-semibold">{order.orderRef}</dd>

            <dt className="eyebrow mt-4 text-mute">{t.order.placedOn}</dt>
            <dd className="mt-1">{new Date(order.createdAt).toLocaleString(locale)}</dd>

            {order.gatewayResponse && (
              <>
                <dt className="eyebrow mt-4 text-mute">{t.order.gatewayCode}</dt>
                <dd className="mt-1 font-mono">{order.gatewayResponse}</dd>
              </>
            )}

            {attempts.used > 1 && (
              <>
                <dt className="eyebrow mt-4 text-mute">{t.order.attemptNumber}</dt>
                <dd className="mt-1">
                  {attempts.used} / {attempts.max}
                </dd>
              </>
            )}

            <dt className="eyebrow mt-4 border-t border-line pt-4 text-mute">{t.cart.shipping}</dt>
            <dd className="mt-1">
              {order.shippingCents === 0 ? t.cart.free : formatPrice(order.shippingCents)}
            </dd>

            {/*
              Read from the order's own snapshot, not from the code: the campaign
              may since have ended, changed or been deleted, and what this order
              was given does not change with it.
            */}
            {order.discountCents > 0 && (
              <>
                <dt className="eyebrow mt-3 text-mute">
                  {t.cart.discount}{" "}
                  {order.discountCode && <span className="font-mono">{order.discountCode}</span>}
                </dt>
                <dd className="mt-1 text-pine">−{formatPrice(order.discountCents)}</dd>
              </>
            )}

            <dt className="eyebrow mt-3 text-mute">{t.cart.total}</dt>
            <dd className="mt-1 font-display text-2xl font-bold">
              {formatPrice(order.amountCents)}
            </dd>

            {/*
              The split of that total, at the rate stored on this order — not
              today's rate, so the figures here match what was charged.
            */}
            <dt className="eyebrow mt-3 border-t border-line pt-3 text-mute">{t.cart.taxBase}</dt>
            <dd className="mt-1">{formatPrice(tax.netCents)}</dd>

            <dt className="eyebrow mt-2 text-mute">
              {t.cart.vat} ({formatVatRate(tax.rate)})
            </dt>
            <dd className="mt-1">{formatPrice(tax.vatCents)}</dd>
          </dl>

          <div className="border border-line p-5 text-[0.875rem]">
            <p className="eyebrow mb-2 text-mute">{t.order.shippingTo}</p>
            <p className="font-semibold">{order.shipName}</p>
            <p className="mt-1 leading-relaxed text-mute">
              {order.shipLine1}
              {order.shipLine2 && <>, {order.shipLine2}</>}
              <br />
              {order.shipPostcode} {order.shipCity}
              <br />
              {order.shipProvince}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
