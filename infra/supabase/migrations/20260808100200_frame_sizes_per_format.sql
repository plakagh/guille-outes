-- A cuadro is not one size: the printed measurements are per format.
--
-- `frame_preview` stored a single width × height, but a cuadro is sold as a
-- "Pequeño" and a "Grande" at two prices, and the camera view ("en tu pared")
-- scales the piece on the shopper's wall by those centimetres. One pair for both
-- formats means the wall view is wrong for at least one of them — and being right
-- about the size is the only reason that view exists.
--
-- So the measurements move into a map keyed by the product's own size names, the
-- same names `product_variants.size` uses:
--
--   {
--     "enabled": true,
--     "finishes": ["black", "white", "wood"],
--     "mount": 10,
--     "sizes": {
--       "Pequeño": { "width": 30, "height": 40 },
--       "Grande":  { "width": 50, "height": 70 }
--     },
--     "width": 30,       -- the fallback pair: the first format, for a listing
--     "height": 40       -- card and for a product page with nothing chosen yet
--   }
--
-- `width` / `height` stay where they were rather than being dropped. They are what
-- a format nobody has measured falls back to, and they keep every reader that
-- predates this migration working instead of silently losing the scale.

/* ----------------------------------------------------------- the constraint --

   The numbers inside `sizes` need the same 5–300 cm sanity check as the pair
   outside it: a typo there is a preview at a wildly wrong scale, which is the
   failure this constraint exists to prevent.

   It goes through a function because a CHECK cannot contain a subquery, and
   walking a jsonb object needs one. IMMUTABLE and STRICT so the planner may use
   it in a check at all, and `search_path` pinned so it cannot be redirected. */

create or replace function public.frame_sizes_well_formed(preview jsonb)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select
    not preview ? 'sizes'
    or (
      jsonb_typeof(preview -> 'sizes') = 'object'
      and not exists (
        select 1
          from jsonb_each(preview -> 'sizes') as entry(size, measurements)
         where jsonb_typeof(entry.measurements) <> 'object'
            or not (entry.measurements ? 'width' and entry.measurements ? 'height')
            or jsonb_typeof(entry.measurements -> 'width') <> 'number'
            or jsonb_typeof(entry.measurements -> 'height') <> 'number'
            or (entry.measurements ->> 'width')::numeric not between 5 and 300
            or (entry.measurements ->> 'height')::numeric not between 5 and 300
      )
    );
$$;

comment on function public.frame_sizes_well_formed(jsonb) is
  'True when frame_preview.sizes is absent, or a map of size name → '
  '{"width":cm,"height":cm} with both measurements between 5 and 300 cm.';

/* ------------------------------------------------------------- the backfill --

   Every framed product that is sold in the two print formats gets their standard
   paper sizes, and its fallback pair becomes the smaller one — the format a
   listing card shows. Done before the constraint is added so the rows it writes
   are the ones being validated.

   Only rows that have no `sizes` yet: a shop that has already typed the real
   measurements of a piece must not have them replaced by the standard ones. */

update public.products as p
   set frame_preview = p.frame_preview
                    || jsonb_build_object('sizes', formats.sizes)
                    || (formats.sizes -> 'Pequeño')
  from (
    select v.product_id,
           jsonb_object_agg(
             v.size,
             case v.size
               when 'Pequeño' then '{"width": 30, "height": 40}'::jsonb
               else '{"width": 50, "height": 70}'::jsonb
             end
           ) as sizes
      from public.product_variants as v
     where v.size in ('Pequeño', 'Grande')
     group by v.product_id
  ) as formats
 where formats.product_id = p.id
   and p.frame_preview ? 'enabled'
   and not p.frame_preview ? 'sizes'
   -- Only where both formats are on sale: filling in one of the two and calling
   -- the small one the default would misreport a product sold only as a large.
   and formats.sizes ? 'Pequeño';

alter table public.products
  drop constraint if exists products_frame_sizes_well_formed;

alter table public.products
  add constraint products_frame_sizes_well_formed
  check (public.frame_sizes_well_formed(frame_preview));

comment on column public.products.frame_preview is
  'Framing preview for this product: {"enabled":bool,"finishes":["black","white","wood"],'
  '"mount":pct,"sizes":{"<size name>":{"width":cm,"height":cm}},"width":cm,"height":cm}. '
  'The centimetres are the printed artwork, not the finished frame, and are what the camera '
  'wall view scales to; `sizes` is keyed by product_variants.size, and the loose width/height '
  'are the fallback for a format nobody has measured. Empty object means the product is not '
  'shown framed.';
