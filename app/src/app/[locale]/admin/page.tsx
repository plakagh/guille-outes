import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalog } from "@/lib/db/catalog";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";

export const metadata: Metadata = { robots: { index: false, follow: false } };

const LOW_STOCK = 5;

export default async function AdminOverview(props: PageProps<"/[locale]/admin">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();

  const [t, catalog] = await Promise.all([getDictionary(locale), getCatalog(locale)]);

  const variants = catalog.products.flatMap((product) =>
    product.variants.map((variant) => ({ product, variant })),
  );
  const low = variants.filter(
    ({ variant }) => variant.stock > 0 && variant.stock < LOW_STOCK,
  );
  const out = variants.filter(({ variant }) => variant.stock === 0);

  const stats = [
    { label: t.admin.totalProducts, value: catalog.products.length },
    {
      label: t.admin.totalPublished,
      value: catalog.products.filter((product) => product.published).length,
    },
    { label: t.admin.lowStockUnits, value: low.length },
    { label: t.admin.outOfStockUnits, value: out.length },
  ];

  return (
    <div className="shell py-8">
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <li key={stat.label} className="border border-line bg-white p-5">
            <p className="eyebrow text-mute">{stat.label}</p>
            <p className="mt-2 font-display text-4xl font-bold leading-none">{stat.value}</p>
          </li>
        ))}
      </ul>

      <section className="mt-10">
        <h2 className="mb-4 text-2xl">{t.admin.lowStockUnits}</h2>
        {low.length === 0 && out.length === 0 ? (
          <p className="text-[0.9375rem] text-mute">—</p>
        ) : (
          <div className="overflow-x-auto border border-line bg-white">
            <table className="w-full min-w-[36rem] text-[0.875rem]">
              <thead className="border-b border-line bg-shell">
                <tr>
                  <th className="p-3 text-left font-display uppercase">{t.admin.name}</th>
                  <th className="p-3 text-left font-display uppercase">{t.admin.sku}</th>
                  <th className="p-3 text-right font-display uppercase">{t.admin.units}</th>
                </tr>
              </thead>
              <tbody>
                {[...low, ...out].slice(0, 25).map(({ product, variant }) => (
                  <tr key={variant.id} className="border-b border-line-soft">
                    <td className="p-3">
                      <Link
                        href={`${href(locale, "admin")}/products/${product.id}`}
                        className="font-semibold hover:underline"
                      >
                        {product.name}
                      </Link>
                    </td>
                    <td className="p-3 text-mute">{variant.sku ?? "—"}</td>
                    <td
                      className={
                        variant.stock === 0
                          ? "p-3 text-right font-bold text-flame"
                          : "p-3 text-right font-bold"
                      }
                    >
                      {variant.stock}
                    </td>
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
