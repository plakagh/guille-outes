-- ============================================================================
-- Stock reservations for payment attempts
--
-- Stock used to be decremented only after Redsys confirmed the charge. That left
-- a race where two shoppers could both pay for the last unit. From here on, the
-- stock is reserved when an attempt is started, released on a failed/cancelled
-- callback, and left consumed when the attempt is paid.
-- ============================================================================

alter table public.orders
  add column if not exists stock_reserved boolean not null default false;

comment on column public.orders.stock_reserved is
  'True once order_items have been taken out of product_variants.stock. Failed or '
  'cancelled attempts release the reservation; paid orders keep it consumed.';

create or replace function public.reserve_order_stock(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  the_order public.orders;
  item record;
  moved uuid;
begin
  select * into the_order
    from public.orders
   where id = p_order_id
   for update;

  if the_order.id is null then
    raise exception 'order not found' using errcode = '42501';
  end if;

  if the_order.stock_reserved then
    return false;
  end if;

  for item in
    select variant_id, sum(qty)::integer as qty
      from public.order_items
     where order_id = p_order_id
       and variant_id is not null
     group by variant_id
  loop
    moved := null;

    update public.product_variants
       set stock = stock - item.qty
     where id = item.variant_id
       and stock >= item.qty
    returning id into moved;

    if moved is null then
      raise exception 'out of stock' using errcode = '55000';
    end if;
  end loop;

  update public.orders
     set stock_reserved = true
   where id = p_order_id;

  return true;
end;
$$;

create or replace function public.release_order_stock(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  the_order public.orders;
  item record;
begin
  select * into the_order
    from public.orders
   where id = p_order_id
   for update;

  if the_order.id is null then
    raise exception 'order not found' using errcode = '42501';
  end if;

  if not the_order.stock_reserved or the_order.status = 'paid' then
    return false;
  end if;

  for item in
    select variant_id, sum(qty)::integer as qty
      from public.order_items
     where order_id = p_order_id
       and variant_id is not null
     group by variant_id
  loop
    update public.product_variants
       set stock = stock + item.qty
     where id = item.variant_id;
  end loop;

  update public.orders
     set stock_reserved = false
   where id = p_order_id;

  return true;
end;
$$;

revoke all on function public.reserve_order_stock(uuid) from public;
revoke all on function public.release_order_stock(uuid) from public;
grant execute on function public.release_order_stock(uuid) to service_role;

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
  last_no     integer;
  existing    public.payment_attempts;
  created     public.payment_attempts;
begin
  select * into the_order from public.orders where id = p_order_id;

  if the_order.id is null then
    raise exception 'order not found' using errcode = '42501';
  end if;

  -- Ownership: the caller must own the order, or be an administrator.
  if the_order.user_id is distinct from auth.uid() and not public.is_admin() then
    raise exception 'not your order' using errcode = '42501';
  end if;

  if the_order.status = 'paid' then
    raise exception 'order already paid' using errcode = '55000';
  end if;

  perform public.reserve_order_stock(p_order_id);

  -- Reuse an attempt that was started but never answered, so reloading the
  -- redirect page does not burn a retry.
  select * into existing
    from public.payment_attempts
   where order_id = p_order_id and status = 'pending'
   order by attempt_no desc
   limit 1;

  if existing.id is not null then
    return existing;
  end if;

  select max_attempts into limit_count from public.payment_settings where provider = 'redsys';
  limit_count := coalesce(limit_count, 3);

  select count(*), coalesce(max(attempt_no), 0)
    into used, last_no
    from public.payment_attempts
   where order_id = p_order_id;

  if used >= limit_count then
    perform public.release_order_stock(p_order_id);
    raise exception 'no attempts left' using errcode = '55000';
  end if;

  insert into public.payment_attempts (order_id, attempt_no, gateway_ref, amount_cents)
  values (
    p_order_id,
    last_no + 1,
    lpad(nextval('public.order_ref_seq')::text, 12, '0'),
    the_order.amount_cents
  )
  returning * into created;

  -- A new attempt puts the order back in play.
  update public.orders set status = 'pending' where id = p_order_id and status <> 'paid';

  return created;
end;
$$;

comment on function public.start_payment_attempt(uuid) is
  'Starts the next payment attempt, or returns the one already awaiting the bank. '
  'Checks ownership, reserves stock, and enforces the max_attempts limit.';

revoke all on function public.start_payment_attempt(uuid) from public;
grant execute on function public.start_payment_attempt(uuid) to authenticated, service_role;
