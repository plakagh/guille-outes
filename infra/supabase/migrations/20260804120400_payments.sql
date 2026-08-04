-- ============================================================================
-- Payments: Redsys configuration, orders and the gateway audit trail
--
-- Two things to know about the security model here:
--
--  1. The Redsys merchant secret is stored ENCRYPTED (AES-256-GCM, key held in
--     the server environment, never in the database). Nightly `pg_dump` backups
--     are shipped to object storage, so a plaintext bank credential in a table
--     would mean a plaintext bank credential in every backup.
--
--  2. Customers can read their own orders but can never write an order status.
--     Payment state is only ever set by the gateway callback, which runs
--     server-side after verifying the Redsys HMAC.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Gateway configuration
-- ----------------------------------------------------------------------------

create table public.payment_settings (
  -- One row per provider; only 'redsys' exists today.
  provider              text primary key,
  enabled               boolean not null default false,
  -- 'test' points at sis-t.redsys.es, 'live' at sis.redsys.es
  environment           text not null default 'test'
                          check (environment in ('test', 'live')),
  -- FUC: 9 digits, issued by the acquiring bank.
  merchant_code         text,
  -- Usually '001'.
  terminal              text not null default '1',
  merchant_name         text,
  -- ISO-4217 numeric. 978 = EUR.
  currency              integer not null default 978,
  -- AES-256-GCM blob: iv || authTag || ciphertext, base64. Useless without the
  -- key in the server environment.
  secret_key_encrypted  text,
  updated_at            timestamptz not null default now(),
  updated_by            uuid references auth.users (id) on delete set null
);

comment on column public.payment_settings.secret_key_encrypted is
  'AES-256-GCM(iv||tag||ciphertext) base64. Decryption key lives only in the app environment.';

create trigger payment_settings_touch before update on public.payment_settings
  for each row execute function public.touch_updated_at();

insert into public.payment_settings (provider) values ('redsys')
  on conflict (provider) do nothing;

alter table public.payment_settings enable row level security;

-- Admins only, for reads as well as writes. The storefront never needs this
-- table: the checkout path reads it through a server-side helper.
create policy "payment_settings: admin only"
  on public.payment_settings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.payment_settings from anon;
grant select, insert, update on public.payment_settings to authenticated;

-- ----------------------------------------------------------------------------
-- Orders
-- ----------------------------------------------------------------------------

create type public.order_status as enum (
  'pending',    -- created, sent to the gateway, no answer yet
  'paid',
  'failed',     -- gateway declined
  'cancelled',  -- shopper abandoned the gateway
  'refunded'
);

-- Ds_MERCHANT_ORDER must be 4–12 characters and start with four digits, so a
-- zero-padded sequence is the simplest thing that satisfies the bank. Starting
-- high keeps the shop's real order volume out of the reference.
create sequence public.order_ref_seq start with 100001;

create table public.orders (
  id                uuid primary key default gen_random_uuid(),
  -- What Redsys calls Ds_Merchant_Order. Unique per merchant, forever.
  order_ref         text not null unique
                      default lpad(nextval('public.order_ref_seq')::text, 12, '0')
                      check (order_ref ~ '^[0-9]{4}[0-9a-zA-Z]{0,8}$'),
  user_id           uuid references auth.users (id) on delete set null,
  email             text not null,
  phone             text,
  status            public.order_status not null default 'pending',
  locale            text not null default 'es',

  amount_cents      integer not null check (amount_cents > 0),
  shipping_cents    integer not null default 0 check (shipping_cents >= 0),
  currency          integer not null default 978,

  -- Address snapshot: the order must not change if the customer later edits or
  -- deletes the address it was placed with.
  ship_name         text not null,
  ship_line1        text not null,
  ship_line2        text,
  ship_postcode     text not null,
  ship_city         text not null,
  ship_province     text not null,
  ship_country      text not null default 'ES',
  shipping_method   text not null default 'standard',

  -- Gateway bookkeeping
  provider          text not null default 'redsys',
  gateway_response  text,
  gateway_auth_code text,
  paid_at           timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status);

create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

create table public.order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders (id) on delete cascade,
  -- Kept as a soft reference: deleting a product must not rewrite history.
  product_id        uuid references public.products (id) on delete set null,
  variant_id        uuid references public.product_variants (id) on delete set null,
  -- Snapshot of what was bought, at the price that was shown.
  name              text not null,
  ref               text,
  size              text not null,
  colorway_id       text not null,
  unit_price_cents  integer not null check (unit_price_cents >= 0),
  qty               integer not null check (qty > 0 and qty <= 10),
  created_at        timestamptz not null default now()
);

create index order_items_order_idx on public.order_items (order_id);

-- Every gateway callback, verified or not. This is the audit trail: if a payment
-- is ever disputed, the raw notification is here.
create table public.payment_events (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid references public.orders (id) on delete set null,
  order_ref     text,
  provider      text not null default 'redsys',
  -- False when the HMAC did not match; such an event changes nothing but is
  -- still recorded, because repeated entries mean someone is probing.
  signature_ok  boolean not null,
  response_code text,
  auth_code     text,
  raw           jsonb,
  created_at    timestamptz not null default now()
);

create index payment_events_order_idx on public.payment_events (order_ref, created_at desc);

-- ----------------------------------------------------------------------------
-- Row level security
-- ----------------------------------------------------------------------------

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payment_events enable row level security;

-- Customers: read their own orders, create their own orders, never change them.
create policy "orders: read own"
  on public.orders for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "orders: create own"
  on public.orders for insert
  to authenticated
  with check (user_id = auth.uid());

-- Deliberately no UPDATE or DELETE policy for customers or admins. Status moves
-- only through the verified gateway callback, which runs with elevated rights on
-- the server. An admin who needs to correct an order does it in SQL, and that
-- leaves a trace.

create policy "order_items: read own"
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (o.user_id = auth.uid() or public.is_admin())
    )
  );

create policy "order_items: create with own order"
  on public.order_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = auth.uid()
    )
  );

-- The audit trail is admin-only, and nobody may write it through the API.
create policy "payment_events: admin read"
  on public.payment_events for select
  to authenticated
  using (public.is_admin());

revoke all on public.orders, public.order_items, public.payment_events from anon;
grant select, insert on public.orders, public.order_items to authenticated;
grant select on public.payment_events to authenticated;
grant usage on sequence public.order_ref_seq to authenticated;

-- ----------------------------------------------------------------------------
-- Grants for the payment callback
--
-- `adjust_stock` had EXECUTE revoked from everyone except `authenticated`, but
-- the gateway callback runs as `service_role` (there is no user session on a
-- bank's request) and has to take the sold units out of stock.
-- ----------------------------------------------------------------------------

grant execute on function public.adjust_stock(uuid, integer) to service_role;
grant usage on sequence public.order_ref_seq to service_role;

-- Supabase's default privileges hand EXECUTE on new functions to anon as well.
-- Harmless here (the function is SECURITY INVOKER, so RLS still refuses the
-- write) but there is no reason for the anonymous role to reach it at all.
revoke execute on function public.adjust_stock(uuid, integer) from anon;
