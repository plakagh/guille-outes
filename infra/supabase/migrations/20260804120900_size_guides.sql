-- Per-product size guide.
--
-- The guide used to be one static help page with a table per "fit", which is
-- wrong: a size L jersey and a size L tee are not the same garment, and the
-- measurements that matter differ (a tee has no inseam). So measurements belong
-- to the product.
--
-- Shape:
--
--   {
--     "dimensions": ["chest", "length"],
--     "measurements": { "S": { "chest": 49, "length": 70 }, ... }
--   }
--
-- `dimensions` is an ordered list of keys the application knows how to label,
-- which is what keeps this trilingual without asking the admin to translate
-- "chest" three times: the labels live in the dictionaries, only the numbers
-- live here. `measurements` is keyed by the product's own size names.
--
-- An empty object means "not filled in yet" — the storefront then falls back to
-- the baseline for the garment shape, so no product is ever left without a guide.

alter table public.products
  add column if not exists size_guide jsonb not null default '{}'::jsonb;

alter table public.products
  drop constraint if exists products_size_guide_is_object;

alter table public.products
  add constraint products_size_guide_is_object
  check (jsonb_typeof(size_guide) = 'object');

-- Guard the inner shape too, so a malformed write fails at the boundary rather
-- than rendering an empty table to a shopper. Both keys are optional (an empty
-- object is valid) but must have the right type when present.
alter table public.products
  drop constraint if exists products_size_guide_well_formed;

alter table public.products
  add constraint products_size_guide_well_formed
  check (
    (
      not size_guide ? 'dimensions'
      or jsonb_typeof(size_guide -> 'dimensions') = 'array'
    )
    and (
      not size_guide ? 'measurements'
      or jsonb_typeof(size_guide -> 'measurements') = 'object'
    )
  );

comment on column public.products.size_guide is
  'Measurements for this product''s own sizes, in centimetres. Keys in "dimensions" '
  'are labelled from the application dictionaries. Empty means fall back to the '
  'baseline for the garment shape.';
