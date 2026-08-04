import { ProductCard } from "@/components/product/product-card";
import { SectionHead } from "@/components/ui/bits";
import { Rail } from "@/components/ui/rail";
import type { Catalog, Product } from "@/lib/catalog";
import { cn } from "@/lib/utils";

/** Collection names, resolved once so cards never query the catalogue. */
function collectionNames(catalog: Catalog): Map<string, string> {
  return new Map(catalog.collections.map((collection) => [collection.id, collection.name]));
}

/** A titled shelf of products that scrolls horizontally, five-up on desktop. */
export function ProductRail({
  title,
  eyebrow,
  href,
  linkLabel,
  products,
  catalog,
  className,
}: {
  title: string;
  eyebrow?: string;
  href?: string;
  linkLabel: string;
  products: Product[];
  catalog: Catalog;
  className?: string;
}) {
  if (products.length === 0) return null;
  const names = collectionNames(catalog);

  return (
    <section className={cn("shell py-10 lg:py-14", className)}>
      <SectionHead title={title} eyebrow={eyebrow} href={href} linkLabel={linkLabel} />
      <Rail label={title}>
        {products.map((product) => (
          <div
            key={product.id}
            className="w-[68%] shrink-0 sm:w-[44%] md:w-[30%] lg:w-[23%] xl:w-[18.6%]"
          >
            <ProductCard
              product={product}
              collectionName={
                product.collectionId ? names.get(product.collectionId) : undefined
              }
            />
          </div>
        ))}
      </Rail>
    </section>
  );
}

/** Static responsive grid used by listing pages. */
export function ProductGrid({
  products,
  catalog,
  className,
}: {
  products: Product[];
  catalog: Catalog;
  className?: string;
}) {
  const names = collectionNames(catalog);

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-4 md:grid-cols-3 xl:grid-cols-4",
        className,
      )}
    >
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          collectionName={product.collectionId ? names.get(product.collectionId) : undefined}
        />
      ))}
    </div>
  );
}
