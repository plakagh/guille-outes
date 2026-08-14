-- A cuadro arrives framed.
--
-- Framing has always been per product and switched on by hand: `frame_preview`
-- starts as `{}` — no preview — and only the framing section of the admin panel
-- ever fills it in. Nothing derives it from the category, so a cuadro added to
-- the shop reaches its ficha with no frame chooser at all: not the acabado, not
-- "sin marco". The paper is the only thing on sale, and the shopper is never told
-- there was a choice.
--
-- The admin panel now writes the preview when a product is created in — or moved
-- into — the cuadros category. This migration does the same for the cuadros that
-- are already in the catalogue.

/* ------------------------------------------------- off, said out loud --------

   `{}` used to mean two different things: "nobody has been through this product"
   and "the shop turned the preview off". They read the same to the storefront —
   both are unframed — but not to a backfill, which must leave the second alone.

   So off is recorded as `{"enabled": false}` from now on, and `{}` is kept for
   the untouched case. The rows below are the only ones this migration touches. */

/* --------------------------------------------------------- the backfill ------

   Every cuadro nobody has configured gets the standard preview: the three
   finishes, a 10 % mount, and no surcharge — the frame is included until the shop
   says what it costs, which is the only safe default when this number is what the
   server charges an order by.

   The printed sizes come from the formats the piece is actually sold in, the same
   convention as the per-format migration: Pequeño is 30 × 40 and Grande 50 × 70,
   with the smaller pair repeated outside `sizes` as the fallback a listing card
   draws. A cuadro sold in neither format still gets the pair, so its preview is
   scaled by something rather than hidden.

   Note this re-enables a preview that was switched off by hand *before* today,
   since those rows are indistinguishable from untouched ones — there are a
   handful of cuadros and every one of them is meant to be sold framed, so the
   preview appearing again is the intended outcome and not a surprise. */

with formats as (
  select p.id,
         coalesce(
           (
             select jsonb_object_agg(
                      v.size,
                      case v.size
                        when 'Pequeño' then '{"width": 30, "height": 40}'::jsonb
                        else '{"width": 50, "height": 70}'::jsonb
                      end
                    )
               from public.product_variants as v
              where v.product_id = p.id
                and v.size in ('Pequeño', 'Grande')
           ),
           '{}'::jsonb
         ) as sizes
    from public.products as p
   where p.category_id = 'cuadros'
     and p.frame_preview = '{}'::jsonb
)
update public.products as p
   set frame_preview =
         jsonb_build_object(
           'enabled', true,
           'finishes', '["black", "white", "wood"]'::jsonb,
           'mount', 10,
           'surcharge', 0,
           'sizes', f.sizes
         )
         -- The fallback pair: the smaller format, or the only one on sale, or the
         -- standard sheet for a piece whose formats are still to be filled in.
         || coalesce(
              f.sizes -> 'Pequeño',
              f.sizes -> 'Grande',
              '{"width": 30, "height": 40}'::jsonb
            )
  from formats as f
 where f.id = p.id;

comment on column public.products.frame_preview is
  'Framing preview for this product: {"enabled":bool,"finishes":["black","white","wood"],'
  '"mount":pct,"surcharge":cents,"sizes":{"<size name>":{"width":cm,"height":cm}},'
  '"width":cm,"height":cm}. The centimetres are the printed artwork, not the finished '
  'frame, and are what the camera wall view scales to; `sizes` is keyed by '
  'product_variants.size, and the loose width/height are the fallback for a format nobody '
  'has measured. {"enabled":false} is a preview the shop switched off; an empty object is '
  'a product nobody has configured, which a cuadro is filled in from on its next save.';
