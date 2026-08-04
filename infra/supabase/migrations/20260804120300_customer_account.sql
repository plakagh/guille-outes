-- ============================================================================
-- Customer account data
--
-- Everything a signed-in shopper owns. The policies are "own rows only": a
-- customer can never read or write another customer's data, and `with check`
-- stops them inserting a row under someone else's user_id.
--
-- Deliberately separate from the admin surface: nothing here grants catalogue
-- access, and `is_admin` plays no part in these policies.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Wishlist
-- ----------------------------------------------------------------------------

create table public.wishlist_items (
  user_id     uuid not null references auth.users (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, product_id)
);

create index wishlist_items_user_idx on public.wishlist_items (user_id, created_at desc);

alter table public.wishlist_items enable row level security;

create policy "wishlist: own rows"
  on public.wishlist_items for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on public.wishlist_items from anon;
grant select, insert, delete on public.wishlist_items to authenticated;

-- ----------------------------------------------------------------------------
-- Shipping addresses
--
-- Used to pre-fill checkout. Kept minimal on purpose: no payment data is ever
-- stored in this database.
-- ----------------------------------------------------------------------------

create table public.customer_addresses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  label         text,
  full_name     text not null,
  line1         text not null,
  line2         text,
  postcode      text not null,
  city          text not null,
  province      text not null,
  country       text not null default 'ES',
  phone         text,
  is_default    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index customer_addresses_user_idx on public.customer_addresses (user_id);

-- At most one default per customer.
create unique index customer_addresses_one_default_idx
  on public.customer_addresses (user_id)
  where is_default;

create trigger customer_addresses_touch before update on public.customer_addresses
  for each row execute function public.touch_updated_at();

alter table public.customer_addresses enable row level security;

create policy "addresses: own rows"
  on public.customer_addresses for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on public.customer_addresses from anon;
grant select, insert, update, delete on public.customer_addresses to authenticated;
