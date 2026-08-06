import { notFound } from "next/navigation";
import { DiscountEditor } from "@/app/[locale]/admin/discounts/discount-editor";
import { getCatalog } from "@/lib/db/catalog";
import { listDiscountCodes } from "@/lib/db/discounts";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";

/**
 * Discount codes.
 *
 * Read with the administrator's own session: `discount_codes` has no policy for
 * anyone else, so this page is empty for a non-admin even before the layout's
 * guard turns them away.
 *
 * Never cached. A campaign's counters move with every sale, and a stale "3 of
 * 100 used" is worse than no number at all.
 */
export const dynamic = "force-dynamic";

export default async function AdminDiscountsPage(props: PageProps<"/[locale]/admin/discounts">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();

  const [t, codes, catalog] = await Promise.all([
    getDictionary(locale),
    listDiscountCodes(),
    getCatalog(locale),
  ]);

  return (
    <div className="shell py-8">
      <h1 className="text-3xl">{t.admin.discounts.title}</h1>
      <p className="mt-2 max-w-2xl text-[0.9375rem] leading-relaxed text-mute">
        {t.admin.discounts.blurb}
      </p>

      <DiscountEditor
        codes={codes}
        categories={catalog.categories.map((category) => ({
          id: category.id,
          name: category.name,
        }))}
        collections={catalog.collections.map((collection) => ({
          id: collection.id,
          name: collection.name,
        }))}
        locale={locale}
        t={t}
      />
    </div>
  );
}
