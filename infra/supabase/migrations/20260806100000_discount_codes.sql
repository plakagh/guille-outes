-- ============================================================================
-- Discount codes
--
-- The cart has had a "código promocional" box since the first build; it has
-- always answered "that code is not valid". This is what makes it work.
--
-- Four things shape the schema:
--
--  1. **Nobody may read the codes.** Not `anon`, not an ordinary customer, not
--     even to check one. A shop's live codes are commercially sensitive — a
--     listing endpoint would hand every unannounced campaign to anyone with the
--     public key. So `discount_codes` has no read policy for the storefront at
--     all, and one SECURITY DEFINER function answers the only question a shopper
--     is entitled to ask: *this* string, is it good, and what does it do.
--
--  2. **The amount is not the database's business — the same rule as prices.**
--     `orders.amount_cents` is already whatever the server action computed from
--     the catalogue; the discount is one more term in that arithmetic and lives
--     in the same place (`app/src/lib/discounts.ts`), used by the cart to
--     display and by `placeOrder` to charge. Duplicating the evaluator in SQL
--     would give us two answers that drift.
--
--  3. **A code is used when it is paid for, not when it is typed.** Redemptions
--     are written by the gateway callback, so an abandoned checkout does not
--     burn a slot on a limited campaign, and "used 12 times" in the admin panel
--     means twelve people were actually charged. The cost is a small race: two
--     shoppers can both be told a last-remaining code is valid. The shop would
--     rather honour it twice than refuse someone it had just accepted, so the
--     callback records the redemption regardless — it never rejects a payment
--     that has already gone through.
--
--  4. **Deleting a code must not rewrite an order.** The redemption keeps its
--     own snapshot of the code string and the amount taken off, and the
--     reference is soft — exactly what `order_items` does with products.
-- ============================================================================

create type public.discount_kind as enum (
  'percent',        -- N % off the eligible goods
  'amount',         -- a fixed number of cents off
  'free_shipping'   -- delivery drops to zero, whatever the method
);

create type public.discount_scope as enum (
  'all',            -- the whole catalogue
  'collection',     -- one collection
  'category'        -- one category
);

create table public.discount_codes (
  id                  uuid primary key default gen_random_uuid(),

  -- Stored upper-case so lookups need no case-insensitive index and no citext:
  -- the function upper-cases what the shopper typed before comparing. The shape
  -- is deliberately narrow — a code has to survive being read aloud at a fair
  -- and typed on a phone, so no spaces, no accents, no punctuation but the dash.
  code                text not null unique
                        check (code ~ '^[A-Z0-9][A-Z0-9-]{2,23}$'),

  kind                public.discount_kind not null,

  -- Exactly one of these carries the value, decided by `kind` (see the CHECK
  -- below). Keeping them apart rather than sharing one `value` column means the
  -- database refuses "50 % off" written as 50 cents.
  percent             smallint check (percent between 1 and 100),
  amount_cents        integer  check (amount_cents > 0),

  -- Ceiling for a percentage code: "20 % off, up to 15 €". Meaningless on the
  -- other two kinds, and the CHECK says so.
  max_discount_cents  integer check (max_discount_cents > 0),

  -- Floor for the whole basket, before delivery.
  min_subtotal_cents  integer not null default 0 check (min_subtotal_cents >= 0),

  -- ------------------------------------------------------------------ scope
  scope               public.discount_scope not null default 'all',
  collection_id       text references public.collections (id) on delete cascade,
  category_id         text references public.categories (id) on delete cascade,

  -- Whether the code stacks on top of the outlet. Off by default, because
  -- "20 % off everything" on a line that is already 40 % down is usually an
  -- accident rather than an offer.
  exclude_discounted  boolean not null default false,

  -- ------------------------------------------------------------- who and when
  first_order_only    boolean not null default false,

  -- Null means unlimited, for both. A campaign with no ceiling and no expiry is
  -- a perfectly ordinary thing to want (a permanent "students get 10 %"), so it
  -- is expressed by leaving the boxes empty rather than by typing a big number.
  max_redemptions     integer check (max_redemptions > 0),
  max_per_customer    integer check (max_per_customer > 0),

  starts_at           timestamptz,
  ends_at             timestamptz,

  -- Switched off without being deleted: the redemptions stay attached, so last
  -- year's Black Friday code can be turned back on next year with its history.
  enabled             boolean not null default true,

  -- Internal. Never shown to a customer — it is where the shop writes "for the
  -- Ourense fair, printed on the flyers".
  note                text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references auth.users (id) on delete set null,

  -- The value has to match the kind, or a "free shipping" code with a percent in
  -- it would apply neither reliably.
  constraint discount_codes_value_matches_kind check (
    case kind
      when 'percent'       then percent is not null and amount_cents is null
      when 'amount'        then amount_cents is not null and percent is null
      when 'free_shipping' then percent is null and amount_cents is null
    end
  ),

  -- A cap on a fixed amount is either a no-op or a second, contradictory amount.
  constraint discount_codes_cap_needs_percent check (
    max_discount_cents is null or kind = 'percent'
  ),

  -- A scoped code needs its target, and an unscoped one must not carry a stale
  -- pointer at a collection somebody narrowed it to and then widened again.
  constraint discount_codes_scope_target check (
    case scope
      when 'all'        then collection_id is null and category_id is null
      when 'collection' then collection_id is not null and category_id is null
      when 'category'   then category_id is not null and collection_id is null
    end
  ),

  constraint discount_codes_window check (
    starts_at is null or ends_at is null or ends_at > starts_at
  )
);

comment on table public.discount_codes is
  'Promotional codes. Deliberately unreadable by the storefront: use '
  'public.discount_lookup(text), which answers about one code and nothing else.';

comment on column public.discount_codes.code is
  'Upper-case, A–Z 0–9 and dashes, 3–24 characters. The lookup function '
  'upper-cases and trims what the shopper typed, so the box is case-insensitive '
  'without the column being.';

comment on column public.discount_codes.exclude_discounted is
  'When true, lines whose product has a compare-at price are left out of the '
  'discountable base — the code does not stack on top of the outlet.';

create trigger discount_codes_touch before update on public.discount_codes
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- Redemptions
--
-- One row per order that actually paid with a code. This is the ledger the
-- limits are counted from and the report the shop reads.
-- ----------------------------------------------------------------------------

create table public.discount_redemptions (
  id            uuid primary key default gen_random_uuid(),

  -- Soft, like `order_items.product_id`: deleting a retired code must not erase
  -- the fact that forty people used it.
  discount_id   uuid references public.discount_codes (id) on delete set null,

  -- One code per order — no stacking. The UNIQUE constraint is what enforces
  -- that, and it also makes the callback idempotent: a replayed notification
  -- inserts nothing rather than counting the same sale twice.
  order_id      uuid not null unique references public.orders (id) on delete cascade,

  user_id       uuid references auth.users (id) on delete set null,

  -- Snapshots, for when the code above is gone.
  code          text not null,
  amount_cents  integer not null check (amount_cents >= 0),

  created_at    timestamptz not null default now()
);

create index discount_redemptions_code_idx
  on public.discount_redemptions (discount_id, created_at desc);

create index discount_redemptions_user_idx
  on public.discount_redemptions (discount_id, user_id);

comment on table public.discount_redemptions is
  'Written only by the payment callback, when an order with a code is marked '
  'paid. No role but service_role may insert: a customer who could write here '
  'could tell the shop a campaign was exhausted.';

-- ----------------------------------------------------------------------------
-- Order columns
--
-- `amount_cents` stays what it has always been — the figure that is signed and
-- handed to the bank. These two are the record of how it got there, so the order
-- page, the invoice lines and the confirmation email can show the saving without
-- re-deriving it from a code that may since have changed.
-- ----------------------------------------------------------------------------

alter table public.orders
  add column discount_code  text,
  add column discount_cents integer not null default 0 check (discount_cents >= 0);

comment on column public.orders.discount_code is
  'The code as it was applied, snapshotted. Null on an order placed without one.';

-- ----------------------------------------------------------------------------
-- Row level security
-- ----------------------------------------------------------------------------

alter table public.discount_codes enable row level security;
alter table public.discount_redemptions enable row level security;

-- Administrators, and nobody else. There is deliberately no storefront read
-- policy: see `discount_lookup` below for the one question a shopper may ask.
create policy "discount_codes: admin only"
  on public.discount_codes for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "discount_redemptions: admin read"
  on public.discount_redemptions for select
  to authenticated
  using (public.is_admin());

-- A customer sees their own uses, so the account area can say "you used
-- BIENVENIDA10 on this order". Reading a row here reveals nothing about the code
-- itself beyond what they already typed.
create policy "discount_redemptions: read own"
  on public.discount_redemptions for select
  to authenticated
  using (user_id = auth.uid());

revoke all on public.discount_codes, public.discount_redemptions
  from anon, authenticated;

grant select, insert, update, delete on public.discount_codes to authenticated;
grant select on public.discount_redemptions to authenticated;

-- The callback is the only writer, and it runs as service_role with no session.
grant select, insert on public.discount_redemptions to service_role;
grant select on public.discount_codes to service_role;

-- The two new order columns need no grant of their own: `orders` carries a
-- table-level INSERT for `authenticated`, which covers columns added later, and
-- the `orders: create own` policy is what decides who may use it.

-- ----------------------------------------------------------------------------
-- The lookup
--
-- Answers "is this string a code, and what does it do" — for one string, given
-- in full. It cannot be used to list codes, to search for them, or to discover
-- that a near-miss exists: a wrong string returns no rows, exactly like a
-- disabled one.
--
-- It returns the *rules*, not a verdict, plus the three counts that only a
-- privileged reader could compute. The verdict is formed in the application,
-- because forming it needs the basket — which products, at which prices, in
-- which categories — and that is not something to send to Postgres twice.
--
-- SECURITY DEFINER with an empty `search_path`: the usual precaution, so a
-- crafted `search_path` cannot point `public.orders` at somebody else's table.
--
-- Brute force is the obvious worry with any "check this string" endpoint. Three
-- things blunt it: codes are meant to be published (they go on flyers), a
-- guessed code costs the shop a discount rather than access to anything, and the
-- expensive limits — how many times, by whom — are counted here rather than
-- trusted from the browser. If a campaign is ever secret enough to need more
-- than that, it wants a per-customer code, not a shared one.
-- ----------------------------------------------------------------------------

create or replace function public.discount_lookup(p_code text)
returns table (
  id                  uuid,
  code                text,
  kind                public.discount_kind,
  percent             smallint,
  amount_cents        integer,
  max_discount_cents  integer,
  min_subtotal_cents  integer,
  scope               public.discount_scope,
  collection_id       text,
  category_id         text,
  exclude_discounted  boolean,
  first_order_only    boolean,
  max_redemptions     integer,
  max_per_customer    integer,
  starts_at           timestamptz,
  ends_at             timestamptz,
  used_total          integer,
  used_by_caller      integer,
  caller_has_paid     boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id, c.code, c.kind, c.percent, c.amount_cents, c.max_discount_cents,
    c.min_subtotal_cents, c.scope, c.collection_id, c.category_id,
    c.exclude_discounted, c.first_order_only,
    c.max_redemptions, c.max_per_customer, c.starts_at, c.ends_at,
    (
      select count(*)::integer
      from public.discount_redemptions r
      where r.discount_id = c.id
    ),
    -- Nothing used by nobody: a signed-out visitor has no history to count, and
    -- `auth.uid() is null` must not match the rows whose user was deleted.
    (
      select count(*)::integer
      from public.discount_redemptions r
      where r.discount_id = c.id
        and auth.uid() is not null
        and r.user_id = auth.uid()
    ),
    -- For `first_order_only`. "First order" means the first one that was paid
    -- for: a pending order the shopper never completed did not use up their
    -- welcome offer.
    exists (
      select 1 from public.orders o
      where auth.uid() is not null
        and o.user_id = auth.uid()
        and o.status = 'paid'
    )
  from public.discount_codes c
  where c.enabled
    and char_length(btrim(p_code)) between 3 and 24
    and c.code = upper(btrim(p_code));
$$;

comment on function public.discount_lookup(text) is
  'One code by its exact string, with the redemption counts needed to apply its '
  'limits. Returns no rows for an unknown or switched-off code. The only way the '
  'storefront may touch discount_codes.';

revoke all on function public.discount_lookup(text) from public;
grant execute on function public.discount_lookup(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Admin reporting
--
-- `security_invoker` means the view is read with the caller's own rights, so the
-- admin policies above are still what decides. Without it a view owned by the
-- migration role would be a hole straight through them.
-- ----------------------------------------------------------------------------

create view public.discount_code_stats
with (security_invoker = true) as
  select
    c.id,
    count(r.id)::integer                      as used_total,
    count(distinct r.user_id)::integer        as used_by_customers,
    coalesce(sum(r.amount_cents), 0)::integer as given_cents,
    max(r.created_at)                         as last_used_at
  from public.discount_codes c
  left join public.discount_redemptions r on r.discount_id = c.id
  group by c.id;

comment on view public.discount_code_stats is
  'Per-code totals for the admin panel. security_invoker, so it shows nothing to '
  'a caller who cannot read the underlying tables.';

revoke all on public.discount_code_stats from anon;
grant select on public.discount_code_stats to authenticated;
