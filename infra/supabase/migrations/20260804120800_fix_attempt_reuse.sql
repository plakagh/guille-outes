-- Fix: reloading the payment page burned a retry.
--
-- `start_payment_attempt` meant to hand back an attempt that was started but
-- never answered by the bank, so a refresh (or the customer pressing back)
-- would not cost one of the recobros. It never did.
--
-- The reason is a PL/pgSQL trap: for a composite variable, `rec IS NOT NULL` is
-- true only when EVERY field is non-null — it is not "a row was found". A
-- pending attempt has response_code, auth_code and settled_at still null, so
-- `existing is not null` was always false and the function fell through to
-- allocating a brand new attempt every single time.
--
-- The same trap made `the_order is null` work by luck: an unassigned record has
-- all fields null, so that test happened to be correct. Both are rewritten to
-- test a column that can never be null in a real row, which says what is meant.

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

  -- How many have been used decides whether a retry is allowed; the number to
  -- give the new one comes from the highest so far, not from the count, so a
  -- gap in the sequence cannot collide with an existing attempt_no.
  select count(*), coalesce(max(attempt_no), 0)
    into used, last_no
    from public.payment_attempts
   where order_id = p_order_id;

  if used >= limit_count then
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
  'Checks ownership and the max_attempts limit itself, so a customer cannot grant '
  'themselves an extra retry.';

-- Any order left with more than one pending attempt was hit by the bug above.
-- Keep the newest (it is the reference the customer was actually sent to the
-- bank with) and drop the stale duplicates so the retry count is honest again.
delete from public.payment_attempts a
 where a.status = 'pending'
   and exists (
     select 1
       from public.payment_attempts b
      where b.order_id = a.order_id
        and b.status = 'pending'
        and b.attempt_no > a.attempt_no
   );
