-- ============================================================================
-- Two changes the real catalogue needs before it can be loaded.
--
-- 1. A price difference per variant, so one artwork is one listing with a small
--    and a large size rather than two near-identical products.
-- 2. A unique key on product images, so the bulk importer can be re-run without
--    duplicating rows.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Per-variant price difference
--
-- Until now the price lived entirely on the product, which works while every
-- size of a garment costs the same. It does not work for a framed print, where
-- the large is twice the small.
--
-- A *delta* rather than an absolute price, because the product price stays the
-- authoritative "from" figure shown in listings and structured data, and a
-- variant only says how far it moves from it. That also means every existing
-- variant is correct at the default of zero.
--
-- The order line still snapshots what was charged in `order_items`, so changing
-- a delta later never rewrites an order.
-- ----------------------------------------------------------------------------

alter table public.product_variants
  add column if not exists price_delta_cents integer not null default 0;

comment on column public.product_variants.price_delta_cents is
  'Added to products.price_cents for this variant. 0 means the product price. '
  'Surcharge only: a markdown belongs in compare_at_cents or a discount code.';

-- Additive only. A check constraint cannot reach into `products` to verify the
-- sum, and a negative delta is not something this shop needs: a reduced price is
-- either a sale (compare_at_cents) or a discount code, both of which are already
-- modelled and both of which leave an audit trail that a silent negative delta
-- would not.
alter table public.product_variants
  drop constraint if exists product_variants_delta_not_negative;

alter table public.product_variants
  add constraint product_variants_delta_not_negative
  check (price_delta_cents >= 0);

-- ----------------------------------------------------------------------------
-- One row per image
--
-- `import-media.mjs` derives the storage path from a hash of the file contents,
-- so re-running it produces the same path for the same image. Without a unique
-- key that would insert a second row pointing at the same object every time the
-- deploy ran; with one, the import is an upsert.
-- ----------------------------------------------------------------------------

-- Any duplicates from before this index existed would block its creation, and
-- they are by definition redundant: same product, same object.
delete from public.product_images a
 using public.product_images b
 where a.product_id = b.product_id
   and a.storage_path = b.storage_path
   and a.ctid > b.ctid;

create unique index if not exists product_images_product_path_idx
  on public.product_images (product_id, storage_path);
