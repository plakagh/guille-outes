-- "Ve cómo queda en tu casa": the printed size of a cuadro, in centimetres.
--
-- The framed preview already answers *what it looks like framed*. What it cannot
-- answer is *how big it is on my wall* — and that is the question that stops
-- people buying art online. The wall view puts the piece over the phone camera at
-- real scale, which needs the one thing the catalogue never stored: how large the
-- thing actually is.
--
-- Size lives in `frame_preview` rather than in a column of its own because it is
-- part of the same answer: these are the numbers the preview needs in order to be
-- a preview. A product with no framing has no printed size to speak of.
--
--   {
--     "enabled": true,
--     "finishes": ["black", "white", "wood"],
--     "mount": 10,
--     "width": 50,        -- printed artwork, cm, excluding mount and moulding
--     "height": 70
--   }
--
-- The measurements are of the *artwork*, not of the finished frame: the mount and
-- the moulding are drawn as percentages around it, so the storefront derives the
-- outside dimensions and the shop only has to type what is printed on the label.

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
    -- 5 cm is a postcard and 300 cm will not go through a door: anything outside
    -- that is a typo, and a typo here is a preview at a wildly wrong scale.
    and (
      not frame_preview ? 'width'
      or (
        jsonb_typeof(frame_preview -> 'width') = 'number'
        and (frame_preview ->> 'width')::numeric between 5 and 300
      )
    )
    and (
      not frame_preview ? 'height'
      or (
        jsonb_typeof(frame_preview -> 'height') = 'number'
        and (frame_preview ->> 'height')::numeric between 5 and 300
      )
    )
  );

comment on column public.products.frame_preview is
  'Framing preview for this product: {"enabled":bool,"finishes":["black","white","wood"],'
  '"mount":pct,"width":cm,"height":cm}. The centimetres are the printed artwork, not the '
  'finished frame, and are what the camera wall view scales to. Empty object means the '
  'product is not shown framed.';

-- Both posters in the catalogue are 50 × 70, which is what their own description
-- says. Anything else already framed keeps the storefront default until someone
-- types its real size in the admin.
update public.products
   set frame_preview = frame_preview || '{"width": 50, "height": 70}'::jsonb
 where frame_preview ? 'enabled'
   and not frame_preview ? 'width';
