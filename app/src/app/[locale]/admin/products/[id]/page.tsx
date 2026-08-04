import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductEditor } from "@/components/admin/product-editor";
import { getCatalog } from "@/lib/db/catalog";
import { blankDraft, getProductDraft } from "@/lib/db/admin";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { href } from "@/lib/i18n/routes";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminProductPage(
  props: PageProps<"/[locale]/admin/products/[id]">,
) {
  const { locale, id } = await props.params;
  if (!isLocale(locale)) notFound();

  const [t, catalog] = await Promise.all([getDictionary(locale), getCatalog(locale)]);

  const creating = id === "new";
  const draft = creating
    ? blankDraft(catalog.categories[0]?.id ?? "camisetas")
    : await getProductDraft(id);

  // A non-admin cannot read this row at all (RLS), so a missing draft is either
  // a bad id or a permission problem — both are a 404 from the visitor's side.
  if (!draft) notFound();

  const product = creating ? null : (catalog.products.find((p) => p.id === id) ?? null);

  return (
    <>
      <div className="border-b border-line bg-white">
        <div className="shell py-6">
          <p className="eyebrow text-flame">
            {creating ? t.admin.newProduct : t.admin.editProduct}
          </p>
          <h1 className="mt-1 text-3xl">{draft.name.es || t.admin.newProduct}</h1>
          {!creating && <p className="mt-1 text-[0.8125rem] text-mute">{draft.ref}</p>}
        </div>
      </div>

      <ProductEditor
        draft={draft}
        product={product}
        categories={catalog.categories}
        collections={catalog.collections}
        authors={catalog.authors}
        locale={locale}
        t={t}
        onSavedHref={`${href(locale, "admin")}/products`}
      />
    </>
  );
}
