-- Cuadros: a framed-print category, and a "see it framed" preview.
--
-- The preview is drawn in CSS from the product's own artwork — a coloured frame,
-- a white mount, a bevel — rather than composited photographs. That keeps the
-- house rule (no third-party assets, everything drawn in-house) and it means a
-- new colourway or a new print needs no new photography to show framed.
--
-- Which finishes are offered, how wide the mount is, and whether the preview
-- appears at all are per product, because framing is a property of the piece and
-- not of the shop: a numbered serigraph may only be sold in black, and a poster
-- may not be sold framed at all.

-- Note there is no new `art_shape`: a cuadro is drawn with the existing `poster`
-- artwork and then *framed* by the preview. The frame is presentation, not a
-- different product silhouette.

-- The category itself. Sits after coleccionismo, and like every other category it
-- carries its own slug, copy and keywords per locale so the listing page is
-- indexable in all three languages.
insert into public.categories (id, slug, name, heading, blurb, keywords, position) values (
  'cuadros',
  '{"es":"cuadros","gl":"cadros","en":"framed-prints"}',
  '{"es":"Cuadros","gl":"Cadros","en":"Framed prints"}',
  '{"es":"Cuadros y láminas enmarcadas","gl":"Cadros e láminas enmarcadas","en":"Framed prints and artwork"}',
  '{"es":"Obra sobre papel de nuestros autores, lista para colgar. Puedes verla enmarcada antes de decidir: marco negro, blanco o madera, siempre con paspartú blanco.","gl":"Obra sobre papel das nosas autoras, lista para colgar. Podes vela enmarcada antes de decidir: marco negro, branco ou madeira, sempre con paspartú branco.","en":"Work on paper by our authors, ready to hang. See it framed before you decide: black, white or wood, always with a white mount."}',
  '{"es":["cuadros","laminas","serigrafia","marco","paspartu","arte","obra grafica","decoracion"],"gl":["cadros","laminas","serigrafia","marco","paspartu","arte","obra grafica","decoracion"],"en":["framed prints","art prints","serigraph","frame","mount","matte","wall art","artwork"]}',
  8
)
on conflict (id) do nothing;

-- Per-product framing configuration.
--
--   {
--     "enabled": true,
--     "finishes": ["black", "white", "wood"],   -- ordered; first is the default
--     "mount": 10                               -- mount width, % of the shorter side
--   }
--
-- An empty object means no preview, which is the right default for a t-shirt.
alter table public.products
  add column if not exists frame_preview jsonb not null default '{}'::jsonb;

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
  );

comment on column public.products.frame_preview is
  'Framing preview for this product: {"enabled":bool,"finishes":["black","white","wood"],"mount":pct}. '
  'Empty object means the product is not shown framed.';

-- The two posters already in the catalogue are exactly what this is for, so they
-- get the preview and move into the new category. Nothing else changes.
update public.products
   set frame_preview = '{"enabled": true, "finishes": ["black", "white", "wood"], "mount": 10}'::jsonb,
       category_id = 'cuadros'
 where shape = 'poster';
