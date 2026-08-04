import type { ProductDraft } from "@/components/admin/product-editor";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Admin reads need the *raw* localized bundles, not the flattened, single-locale
 * shape the storefront uses — otherwise editing in one language would silently
 * discard the other two.
 */

type Bundle = Record<string, unknown> | null;

function textBundle(bundle: Bundle): Record<Locale, string> {
  const fallback =
    bundle && typeof bundle[DEFAULT_LOCALE] === "string"
      ? (bundle[DEFAULT_LOCALE] as string)
      : "";
  return Object.fromEntries(
    LOCALES.map((locale) => {
      const value = bundle?.[locale];
      return [locale, typeof value === "string" ? value : locale === DEFAULT_LOCALE ? fallback : ""];
    }),
  ) as Record<Locale, string>;
}

function listBundle(bundle: Bundle): Record<Locale, string[]> {
  return Object.fromEntries(
    LOCALES.map((locale) => {
      const value = bundle?.[locale];
      return [
        locale,
        Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [],
      ];
    }),
  ) as Record<Locale, string[]>;
}

const EMPTY_TEXT: Record<Locale, string> = { es: "", gl: "", en: "" };
const EMPTY_LIST: Record<Locale, string[]> = { es: [], gl: [], en: [] };

/** A blank draft for the "new product" form. */
export function blankDraft(categoryId: string): ProductDraft {
  return {
    id: null,
    ref: "",
    slug: { ...EMPTY_TEXT },
    name: { ...EMPTY_TEXT },
    description: { ...EMPTY_TEXT },
    keywords: { ...EMPTY_LIST },
    details: { ...EMPTY_LIST },
    categoryId,
    collectionId: null,
    audience: "unisex",
    shape: "tee",
    print: "wordmark",
    priceCents: 0,
    compareAtCents: null,
    colorways: ["negro"],
    published: false,
    arrived: 50,
  };
}

export async function getProductDraft(id: string): Promise<ProductDraft | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(
      "id, ref, slug, name, description, keywords, details, category_id, collection_id, audience, shape, print, price_cents, compare_at_cents, colorways, published, arrived",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as {
    id: string;
    ref: string;
    slug: Bundle;
    name: Bundle;
    description: Bundle;
    keywords: Bundle;
    details: Bundle;
    category_id: string;
    collection_id: string | null;
    audience: string;
    shape: string;
    print: string;
    price_cents: number;
    compare_at_cents: number | null;
    colorways: unknown;
    published: boolean;
    arrived: number;
  };

  return {
    id: row.id,
    ref: row.ref,
    slug: textBundle(row.slug),
    name: textBundle(row.name),
    description: textBundle(row.description),
    keywords: listBundle(row.keywords),
    details: listBundle(row.details),
    categoryId: row.category_id,
    collectionId: row.collection_id,
    audience: row.audience,
    shape: row.shape,
    print: row.print,
    priceCents: row.price_cents,
    compareAtCents: row.compare_at_cents,
    colorways: Array.isArray(row.colorways)
      ? row.colorways.filter((value): value is string => typeof value === "string")
      : [],
    published: row.published,
    arrived: row.arrived,
  };
}
