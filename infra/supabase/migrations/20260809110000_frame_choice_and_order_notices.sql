-- The frame stops being a preview and becomes something you buy — or don't.
--
-- Until now `frame_preview` only decided what the shopper *saw*: the product page
-- said in as many words that the price is the print alone and the frame is not
-- included, and then offered no way to order one. Two things change here:
--
--   1. The chosen finish travels with the line, all the way onto the order, so
--      the workshop knows whether to frame the piece and in which colour. "Sin
--      marco" is one of the answers, and it is recorded rather than inferred from
--      a null — an order that simply predates this column is not the same thing
--      as an order for an unframed print.
--   2. Framing costs money, so a cuadro carries a surcharge. It lives in
--      `frame_preview` beside the finishes it applies to, because it is the price
--      of *this piece's* frame and not a shop-wide rate.
--
-- And, unrelated to the frame but arriving with it: the address the shop is
-- notified at when an order comes in.

/* ---------------------------------------------------- the frame surcharge --

   One amount for the three finishes: a black moulding and a wood one cost the
   shop the same, and a per-finish price would be three numbers to keep in step
   for a difference nobody charges for. Absent means zero, which is what every
   row written before today means.

   Capped at 1 000 € for the same reason the measurements are capped: it is a
   typo guard, not a business rule. */

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
  );

comment on column public.products.frame_preview is
  'Framing for this product: {"enabled":bool,"finishes":["black","white","wood"],'
  '"mount":pct,"surcharge":cents,"sizes":{"<size name>":{"width":cm,"height":cm}},'
  '"width":cm,"height":cm}. `surcharge` is what a frame adds to the price of the '
  'print, the same for every finish and absent meaning free. The centimetres are '
  'the printed artwork, not the finished frame, and are what the camera wall view '
  'scales to; `sizes` is keyed by product_variants.size, and the loose width/height '
  'are the fallback for a format nobody has measured. Empty object means the '
  'product is not sold framed.';

/* ------------------------------------------------ the choice, on the order --

   `frame_finish` is null for everything that is not a cuadro — a t-shirt has no
   answer to this question — and one of the three finishes or the literal 'none'
   for one that is. 'none' is a decision the shopper made and the packer has to
   see; null is the absence of the question.

   `frame_surcharge_cents` is already inside `unit_price_cents`, which stays the
   single figure the invoice is built from. It is stored separately so the line
   can be read back as "the print, plus this much for the frame" — on the order
   page, in the shop's notification email, and by anyone reconciling a refund for
   a frame that was never fitted. */

alter table public.order_items
  add column if not exists frame_finish text
    check (frame_finish is null or frame_finish in ('black', 'white', 'wood', 'none')),
  add column if not exists frame_surcharge_cents integer not null default 0
    check (frame_surcharge_cents >= 0);

comment on column public.order_items.frame_finish is
  'The frame this line was ordered with: black, white, wood, or none for a print '
  'bought unframed. Null when the product is not sold framed at all.';

comment on column public.order_items.frame_surcharge_cents is
  'The part of unit_price_cents that is the frame. Zero for an unframed line.';

/* -------------------------------------------------------- who gets told --

   Every order sends the shop a notice — once when it is placed and again when the
   bank confirms it — and the address that notice goes to is a setting rather than
   an environment variable, because it changes when the person reading it changes
   and that must not need a deploy.

   A singleton like `shipping_settings`, and for the same reason: there is one
   shop. Unlike the rates, this row is *not* public. It is an internal mailbox and
   an anonymous visitor has no business reading it, so only an administrator may
   select it; the server reads it through the service role when it actually has a
   notice to send. */

create table public.notification_settings (
  singleton    boolean primary key default true check (singleton),

  -- Null means "do not notify anybody", which is a valid choice and the one a
  -- shop that has not filled this in yet is making by default.
  order_email  text check (order_email is null or order_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),

  updated_at   timestamptz not null default now()
);

insert into public.notification_settings (singleton) values (true);

create trigger notification_settings_touch
  before update on public.notification_settings
  for each row execute function public.touch_updated_at();

alter table public.notification_settings enable row level security;

create policy "admins read notification settings"
  on public.notification_settings for select
  to authenticated
  using (public.is_admin());

create policy "admins update notification settings"
  on public.notification_settings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- As with the shipping row: the singleton is created here and must not be
-- removed, so nothing may insert or delete.
revoke insert, delete on public.notification_settings from anon, authenticated;

comment on table public.notification_settings is
  'Single-row internal notification configuration. Admin-only read and write — '
  'this is the shop''s own mailbox, not public information like the shipping rates.';
