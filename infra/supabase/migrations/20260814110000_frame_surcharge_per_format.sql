-- A frame for the 50 × 70 costs more than a frame for the 30 × 40.
--
-- Two surcharges have always been in play on a cuadro, and until now only one of
-- them knew about the format:
--
--   * the print itself, dearer in the large format — `product_variants
--     .price_delta_cents`, per size since the catalogue was first loaded;
--   * the frame, `frame_preview.surcharge` — one figure for the whole product.
--
-- The second is wrong for at least one format, for exactly the reason the
-- measurements were wrong before they moved into `sizes`: more moulding, more
-- glass, more mount. A shop with one number either loses money on the grande or
-- overcharges the pequeño, and its only escape is to split one listing into two.
--
-- So the surcharge follows the measurements: a map keyed by the product's own size
-- names, with the loose figure kept beside it as the fallback.
--
--   {
--     "enabled": true,
--     "finishes": ["black", "white", "wood"],
--     "mount": 10,
--     "sizes":      { "Pequeño": {"width":30,"height":40}, "Grande": {"width":50,"height":70} },
--     "surcharges": { "Pequeño": 1500,                     "Grande": 2500 },
--     "surcharge": 1500,   -- the fallback: a format nobody has priced, and a
--                          -- product page with no size chosen yet
--     "width": 30,
--     "height": 40
--   }
--
-- `surcharge` stays where it is rather than being dropped, and no row is
-- rewritten: absent `surcharges` means every format costs what the single figure
-- says, which is precisely what every row written before today means. A shop that
-- never opens the framing form keeps charging what it charges.

/* ----------------------------------------------------------- the constraint --

   Same shape of check as `frame_sizes_well_formed`, and a function for the same
   reason: walking a jsonb object needs a subquery and a CHECK cannot hold one.

   The per-format figures get the same 0 – 1 000 € range as the loose one. That
   range is a typo guard — a slipped decimal point is a frame billed at ten times
   its price, and this is the number an order is charged by. */

create or replace function public.frame_surcharges_well_formed(preview jsonb)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select
    not preview ? 'surcharges'
    or (
      jsonb_typeof(preview -> 'surcharges') = 'object'
      and not exists (
        select 1
          from jsonb_each(preview -> 'surcharges') as entry(size, cents)
         where jsonb_typeof(entry.cents) <> 'number'
            -- `#>> '{}'` is how a bare jsonb scalar is read out as text; the
            -- ->> operator only reaches inside an object or an array.
            or (entry.cents #>> '{}')::numeric not between 0 and 100000
      )
    );
$$;

comment on function public.frame_surcharges_well_formed(jsonb) is
  'True when frame_preview.surcharges is absent, or a map of size name → cents '
  'between 0 and 100 000 (0 – 1 000 €).';

alter table public.products
  drop constraint if exists products_frame_preview_well_formed;

alter table public.products
  add constraint products_frame_preview_well_formed
  check (
    jsonb_typeof(frame_preview) = 'object'
    and (not frame_preview ? 'finishes' or jsonb_typeof(frame_preview -> 'finishes') = 'array')
    and (
      not frame_preview ? 'mount'
      or (
        jsonb_typeof(frame_preview -> 'mount') = 'number'
        and (frame_preview ->> 'mount')::numeric between 0 and 30
      )
    )
    and (
      not frame_preview ? 'surcharge'
      or (
        jsonb_typeof(frame_preview -> 'surcharge') = 'number'
        and (frame_preview ->> 'surcharge')::numeric between 0 and 100000
      )
    )
    and public.frame_surcharges_well_formed(frame_preview)
  );

comment on column public.products.frame_preview is
  'Framing for this product: {"enabled":bool,"finishes":["black","white","wood"],'
  '"mount":pct,"surcharges":{"<size name>":cents},"surcharge":cents,'
  '"sizes":{"<size name>":{"width":cm,"height":cm}},"width":cm,"height":cm}. '
  'What a frame adds to the price of the print is per format — a bigger cuadro is a '
  'bigger frame — and the same for every finish; `surcharges` is keyed by '
  'product_variants.size and the loose `surcharge` is the fallback for a format nobody '
  'has priced, absent meaning free. The centimetres are the printed artwork, not the '
  'finished frame, and are what the camera wall view scales to; `sizes` is keyed the same '
  'way, with the loose width/height the fallback for a format nobody has measured. '
  '{"enabled":false} is a preview the shop switched off; an empty object is a product '
  'nobody has configured, which a cuadro is filled in from on its next save.';
