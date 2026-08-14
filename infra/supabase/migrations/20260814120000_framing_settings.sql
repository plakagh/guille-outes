-- What a frame costs, said once for the whole shop.
--
-- The surcharge became per format in the migration before this one, which fixed
-- the price but not the typing: the figure lives inside each product's
-- `frame_preview`, so a catalogue of thirty cuadros sold in two formats is sixty
-- amounts to fill in by hand — and sixty to revisit when the framer raises his
-- prices. Predictably, none of them were filled in at all: every cuadro in the
-- shop had a free frame, so the choice on the ficha changed the picture and never
-- the price.
--
-- So the price of a frame becomes a shop setting with a per-product exception,
-- exactly like the shipping rates it sits beside: one row, admin-writable,
-- publicly readable because the storefront quotes it before anybody signs in.
--
-- Resolution order for one line, dearest-to-cheapest specificity:
--
--   1. `frame_preview.surcharges[size]`  — what this obra costs in this format
--   2. `frame_preview.surcharge`         — what this obra costs, any format
--   3. `framing_settings.surcharges[size]` — the shop's price for this format
--   4. `framing_settings.surcharge_cents`  — the shop's price for anything else
--
-- A product says nothing by *omitting* the key, which is why the two steps above
-- must be absent-not-zero. Zero typed into the form is a decision — this piece is
-- framed for free — and it still wins over the shop's price.

create table public.framing_settings (
  singleton        boolean primary key default true check (singleton),

  -- Size name → cents, keyed by `product_variants.size` like the per-product map.
  -- Not columns named after the two formats: a shop that starts selling a third
  -- would need a migration to price it.
  surcharges       jsonb not null default '{}',

  -- What a format the map says nothing about costs to frame.
  surcharge_cents  integer not null default 0
    check (surcharge_cents >= 0 and surcharge_cents <= 100000),

  updated_at       timestamptz not null default now()
);

alter table public.framing_settings
  add constraint framing_settings_surcharges_well_formed
  check (public.frame_surcharges_well_formed(jsonb_build_object('surcharges', surcharges)));

/* --------------------------------------------------------------- the row --

   The prices the shop gave when this was built: 15 € to frame a pequeño, 25 € a
   grande. They are data, not defaults — from here on they change in Ajustes de la
   tienda without a deploy, which is the whole point of the row existing. */

insert into public.framing_settings (singleton, surcharges, surcharge_cents)
values (true, '{"Pequeño": 1500, "Grande": 2500}'::jsonb, 1500);

create trigger framing_settings_touch
  before update on public.framing_settings
  for each row execute function public.touch_updated_at();

alter table public.framing_settings enable row level security;

create policy "anyone reads framing settings"
  on public.framing_settings for select
  to anon, authenticated
  using (true);

create policy "admins update framing settings"
  on public.framing_settings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- As with the shipping row: created here, and never inserted or deleted, or the
-- shop would have no frame price to quote.
revoke insert, delete on public.framing_settings from anon, authenticated;

comment on table public.framing_settings is
  'Single-row framing configuration: what a frame adds to the price of a print, per '
  'format. Public read (the price is quoted on every ficha before sign-in), admin-only '
  'write. A product overrides it in products.frame_preview.surcharges; the server always '
  're-prices an order from these two places and never from the browser.';

/* ----------------------------------------------- the zero nobody chose ----

   `{"surcharge": 0}` has to stop meaning "free" on the products where nobody
   decided it.

   Two things wrote that zero. The framing form always submitted its box, blank or
   not, and a blank one saved as 0; and `20260814100000` backfilled `"surcharge": 0`
   onto every cuadro it switched framing on for, with the note that a frame is
   included "until the shop says what it costs". Neither is a shop saying a frame
   is free — and both would now shadow the price above and keep every cuadro's
   frame free for ever.

   So a zero is cleared wherever it is the *only* thing said about the price: no
   per-format amounts alongside it. A product with real amounts in `surcharges`
   keeps everything it has, and any piece the shop genuinely wants framed for
   nothing can be set back to 0 in the form, which from today records it. */

update public.products
   set frame_preview = frame_preview - 'surcharge'
 where frame_preview ? 'surcharge'
   and (frame_preview ->> 'surcharge')::numeric = 0
   and coalesce(frame_preview -> 'surcharges', '{}'::jsonb) = '{}'::jsonb;
