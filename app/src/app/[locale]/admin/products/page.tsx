import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductArt } from "@/components/brand/product-art";
import { PublishToggle } from "@/components/admin/publish-toggle";
import { Badge } from "@/components/ui/bits";
import { ButtonLink } from "@/components/ui/button";
import { getCatalog } from "@/lib/db/catalog";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminProducts(props: PageProps<"/[locale]/admin/products">) {
  const [{ locale }, searchParams] = await Promise.all([props.params, props.searchParams]);
  if (!isLocale(locale)) notFound();

  const [t, catalog] = await Promise.all([getDictionary(locale), getCatalog(locale)]);

  const rawQuery = searchParams.q;
  const query = (typeof rawQuery === "string" ? rawQuery : "").trim().toLowerCase();

  const products = catalog.products
    .filter(
      (product) =>
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.ref.toLowerCase().includes(query),
    )
    .sort((a, b) => a.ref.localeCompare(b.ref));

  const adminBase = href(locale, "admin");

  return (
    <div className="shell py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">{t.admin.products}</h1>
          <p className="mt-1 text-[0.875rem] text-mute">
            {products.length} {products.length === 1 ? t.plp.item : t.plp.items}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <form method="get" className="flex gap-2">
            <input
              name="q"
              defaultValue={query}
              placeholder={t.admin.searchProducts}
              aria-label={t.admin.searchProducts}
              className="h-11 w-64 border border-line bg-white px-3 text-[0.875rem] outline-none focus:border-ink"
            />
          </form>
          <ButtonLink href={`${adminBase}/products/new`}>{t.admin.newProduct}</ButtonLink>
        </div>
      </div>

      <div className="overflow-x-auto border border-line bg-white">
        <table className="w-full min-w-[52rem] text-[0.875rem]">
          <thead className="border-b border-line bg-shell">
            <tr>
              <th className="p-3 text-left font-display uppercase">{t.admin.name}</th>
              <th className="p-3 text-left font-display uppercase">{t.pdp.ref}</th>
              <th className="p-3 text-left font-display uppercase">{t.admin.category}</th>
              <th className="p-3 text-right font-display uppercase">{t.admin.price}</th>
              <th className="p-3 text-right font-display uppercase">{t.admin.stock}</th>
              <th className="p-3 text-left font-display uppercase">{t.admin.credits}</th>
              <th className="p-3 text-right font-display uppercase">{t.admin.published}</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const stock = product.variants.reduce((total, v) => total + v.stock, 0);
              const category = catalog.categories.find((c) => c.id === product.categoryId);
              return (
                <tr key={product.id} className="border-b border-line-soft align-middle">
                  <td className="p-3">
                    <Link
                      href={`${adminBase}/products/${product.id}`}
                      className="flex items-center gap-3"
                    >
                      <span className="size-10 shrink-0 bg-shell">
                        <ProductArt
                          shape={product.shape}
                          colorway={product.colorways[0]}
                          print="none"
                        />
                      </span>
                      <span className="font-semibold hover:underline">{product.name}</span>
                      {product.exclusive && <Badge tone="limited">{t.card.limited}</Badge>}
                    </Link>
                  </td>
                  <td className="p-3 text-mute">{product.ref}</td>
                  <td className="p-3 text-mute">{category?.name ?? product.categoryId}</td>
                  <td className="p-3 text-right font-semibold">{formatPrice(product.price)}</td>
                  <td
                    className={
                      stock === 0
                        ? "p-3 text-right font-bold text-flame"
                        : "p-3 text-right font-semibold"
                    }
                  >
                    {stock}
                  </td>
                  <td className="p-3 text-[0.8125rem] text-mute">
                    {product.credits.length === 0
                      ? t.admin.noCredits
                      : product.credits.map((credit) => credit.name).join(", ")}
                  </td>
                  <td className="p-3 text-right">
                    <PublishToggle
                      id={product.id}
                      published={product.published}
                      labels={{ publish: t.admin.publish, unpublish: t.admin.unpublish }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
