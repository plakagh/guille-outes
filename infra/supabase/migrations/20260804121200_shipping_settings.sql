-- Shipping rates and the free-delivery threshold, editable by the admin.
--
-- These were constants in the code, which meant a price change needed a deploy.
-- They are now one row, and there is deliberately only ever one: a `singleton`
-- primary key fixed to `true` makes a second row impossible, so no code has to
-- decide which row is the real one.
--
-- The rates are **public information** — an anonymous visitor sees them at
-- checkout before signing in — so anon may read them. Only an administrator may
-- write, and only the server prices an order: the browser sends choices, never
-- amounts.

create table public.shipping_settings (
  singleton              boolean primary key default true check (singleton),

  -- Order subtotal (before shipping) at or above which standard delivery is free.
  free_threshold_cents   integer not null default 6000 check (free_threshold_cents >= 0),

  standard_cents         integer not null default 495 check (standard_cents >= 0),
  express_cents          integer not null default 895 check (express_cents >= 0),
  pickup_cents           integer not null default 295 check (pickup_cents >= 0),

  -- A shop may not want to offer every service. Standard has no switch: something
  -- has to be deliverable, and a checkout with no shipping option is a dead end.
  express_enabled        boolean not null default true,
  pickup_enabled         boolean not null default true,

  updated_at             timestamptz not null default now()
);

-- The one row. Its defaults are the values that used to be hard-coded, so
-- applying this migration changes nothing a customer can see.
insert into public.shipping_settings (singleton) values (true);

create trigger shipping_settings_touch
  before update on public.shipping_settings
  for each row execute function public.touch_updated_at();

alter table public.shipping_settings enable row level security;

create policy "anyone reads shipping settings"
  on public.shipping_settings for select
  to anon, authenticated
  using (true);

create policy "admins update shipping settings"
  on public.shipping_settings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No insert or delete policy at all: the singleton row is created here and must
-- not be removed, or the shop would have no rates to price with.
revoke insert, delete on public.shipping_settings from anon, authenticated;

comment on table public.shipping_settings is
  'Single-row shipping configuration. Public read (rates are shown before sign-in), '
  'admin-only write. The server always re-prices an order from this row.';
