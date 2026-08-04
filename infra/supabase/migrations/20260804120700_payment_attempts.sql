-- ============================================================================
-- Payment attempts (recobros)
--
-- A declined card should not cost the customer their order. They get a limited
-- number of further attempts, and when those run out we tell them by email.
--
-- Why a separate table instead of a counter on `orders`:
--
--   Redsys requires Ds_Merchant_Order to be unique per merchant, forever. Sending
--   the same reference again after a decline is answered with a duplicate-order
--   error (SIS0051), so a retry needs its *own* gateway reference. The order keeps
--   the reference the customer sees; each attempt carries the one the bank sees.
--
-- The callback therefore resolves an incoming notification by `gateway_ref`, and
-- an attempt is the unit that succeeds or fails.
-- ============================================================================

-- How many times a shopper may try, in total. 3 = the first go plus two recobros.
alter table public.payment_settings
  add column max_attempts integer not null default 3
    check (max_attempts between 1 and 5);

comment on column public.payment_settings.max_attempts is
  'Total payment attempts allowed per order, including the first one.';

-- Set once, when the customer is told the payment could not be confirmed, so the
-- mail is never sent twice.
alter table public.orders
  add column failure_notified_at timestamptz;

create type public.attempt_status as enum ('pending', 'paid', 'failed', 'cancelled');

create table public.payment_attempts (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  -- 1 for the first try, then 2, 3…
  attempt_no    integer not null check (attempt_no > 0),
  -- What the bank sees as Ds_Merchant_Order. Same format rules as orders.
  gateway_ref   text not null unique
                  check (gateway_ref ~ '^[0-9]{4}[0-9a-zA-Z]{0,8}$'),
  status        public.attempt_status not null default 'pending',
  amount_cents  integer not null check (amount_cents > 0),
  response_code text,
  auth_code     text,
  created_at    timestamptz not null default now(),
  settled_at    timestamptz,
  unique (order_id, attempt_no)
);

create index payment_attempts_order_idx on public.payment_attempts (order_id, attempt_no desc);

alter table public.payment_attempts enable row level security;

-- Customers may see their own attempts (the order page counts what is left).
-- Nothing may be written from the API: attempts are created by a database
-- function and settled by the verified gateway callback.
create policy "attempts: read own"
  on public.payment_attempts for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = payment_attempts.order_id
        and (o.user_id = auth.uid() or public.is_admin())
    )
  );

revoke all on public.payment_attempts from anon;
grant select on public.payment_attempts to authenticated;

-- ----------------------------------------------------------------------------
-- Allocating an attempt
--
-- SECURITY DEFINER because the customer must be able to start a retry without
-- being granted INSERT on the table — which would also let them forge one. The
-- function checks ownership itself and enforces the limit, so the only thing a
-- caller can do is legitimately begin the next attempt on their own order.
-- ----------------------------------------------------------------------------

create or replace function public.start_payment_attempt(p_order_id uuid)
returns public.payment_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  the_order   public.orders;
  limit_count integer;
  used        integer;
  existing    public.payment_attempts;
  created     public.payment_attempts;
begin
  select * into the_order from public.orders where id = p_order_id;

  if the_order is null then
    raise exception 'order not found' using errcode = '42501';
  end if;

  -- Ownership: the caller must own the order, or be an administrator.
  if the_order.user_id is distinct from auth.uid() and not public.is_admin() then
    raise exception 'not your order' using errcode = '42501';
  end if;

  if the_order.status = 'paid' then
    raise exception 'order already paid' using errcode = '55000';
  end if;

  -- Reuse an attempt that was started but never answered, so reloading the
  -- redirect page does not burn a retry.
  select * into existing
    from public.payment_attempts
   where order_id = p_order_id and status = 'pending'
   order by attempt_no desc
   limit 1;

  if existing is not null then
    return existing;
  end if;

  select max_attempts into limit_count from public.payment_settings where provider = 'redsys';
  limit_count := coalesce(limit_count, 3);

  select count(*) into used from public.payment_attempts where order_id = p_order_id;

  if used >= limit_count then
    raise exception 'no attempts left' using errcode = '55000';
  end if;

  insert into public.payment_attempts (order_id, attempt_no, gateway_ref, amount_cents)
  values (
    p_order_id,
    used + 1,
    lpad(nextval('public.order_ref_seq')::text, 12, '0'),
    the_order.amount_cents
  )
  returning * into created;

  -- A new attempt puts the order back in play.
  update public.orders set status = 'pending' where id = p_order_id and status <> 'paid';

  return created;
end;
$$;

revoke all on function public.start_payment_attempt(uuid) from public;
grant execute on function public.start_payment_attempt(uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Backfill: existing orders get attempt 1 using their own reference, so nothing
-- placed before this migration is left without a gateway reference.
-- ----------------------------------------------------------------------------

insert into public.payment_attempts (order_id, attempt_no, gateway_ref, amount_cents, status, response_code, auth_code, settled_at)
select
  o.id,
  1,
  o.order_ref,
  o.amount_cents,
  case o.status
    when 'paid' then 'paid'::public.attempt_status
    when 'failed' then 'failed'::public.attempt_status
    when 'cancelled' then 'cancelled'::public.attempt_status
    else 'pending'::public.attempt_status
  end,
  o.gateway_response,
  o.gateway_auth_code,
  o.paid_at
from public.orders o
where not exists (select 1 from public.payment_attempts a where a.order_id = o.id);
