-- ============================================================================
-- The welcome discount
--
-- The footer has promised "un 10 % en tu primer pedido" since the first build.
-- This is what makes it true: when an address *confirms* its subscription — not
-- when somebody types it into the form — the shop mints a code for that person
-- alone, good for one order, and emails it.
--
-- Confirming first is the whole point. A code issued on submission would be a
-- 10 % discount handed to whoever typed the address, which is exactly what the
-- double opt-in exists to prevent (and it would make the newsletter form a way
-- to farm discounts). The click on the link is what ties the offer to a mailbox.
--
-- Two columns are all it takes, because a personal code is an ordinary discount
-- code with an owner:
--
--  * `issued_to_email` is the owner. A code that has one is *personal*, and
--    `discount_lookup` will only claim it for a signed-in caller whose confirmed
--    account address matches. So a code that leaks — a forwarded email, a
--    screenshot in a group chat — cannot be spent by whoever holds the string.
--
--  * `campaign` names why it exists, and is what the partial unique index counts:
--    one welcome code per address, ever. A second confirmation — someone who
--    unsubscribed and came back — finds the code they already have rather than
--    minting another 10 %.
--
-- Single use is not a new mechanism either. It is `max_redemptions = 1`, counted
-- from `discount_redemptions`, which only the payment callback writes: the code
-- is spent when the person actually pays with it, so an abandoned basket does
-- not burn it and a code that was never used stays usable.
-- ============================================================================

alter table public.discount_codes
  -- Lower-cased on the way in, so the unique index below needs no expression and
  -- the comparison against the account address is a plain equality.
  add column issued_to_email text
    check (
      issued_to_email is null
      or (issued_to_email = lower(issued_to_email) and position('@' in issued_to_email) > 1)
    ),

  -- Snake-case slug, not free text: it is a key, and 'newsletter_welcome' typed
  -- two different ways would be two different campaigns.
  add column campaign text
    check (campaign is null or campaign ~ '^[a-z][a-z0-9_]{2,39}$');

comment on column public.discount_codes.issued_to_email is
  'Owner of a personal code, lower-cased. Null on a shared code (a flyer, a '
  'seasonal campaign). When set, discount_lookup only claims the code for a '
  'signed-in caller whose *confirmed* auth address matches — holding the string '
  'is not enough.';

comment on column public.discount_codes.campaign is
  'Why this code exists, e.g. ''newsletter_welcome''. Together with '
  'issued_to_email it is unique, which is what makes issuing idempotent: one '
  'welcome code per address, ever.';

-- An unlimited personal code is a contradiction — the point of issuing one per
-- person is that it runs out. This does not force it to be *one* use, because a
-- "two orders at 10 %" campaign is a reasonable thing to want; it only forbids
-- the ceiling being absent altogether.
alter table public.discount_codes
  add constraint discount_codes_personal_is_limited check (
    issued_to_email is null or max_redemptions is not null
  );

-- Partial, so the millions of shared codes that will never have a campaign do
-- not collide with each other on (null, null).
create unique index discount_codes_campaign_recipient_key
  on public.discount_codes (campaign, issued_to_email)
  where campaign is not null and issued_to_email is not null;

-- ----------------------------------------------------------------------------
-- Who may write one
--
-- The address confirming its subscription is anonymous: it arrives as a GET on a
-- link, with no session. There is no `authenticated` role to hang an RLS policy
-- off, exactly as with the payment callback — so the code is minted through the
-- service-role client (`app/src/lib/newsletter/welcome-code.ts`), which needs the
-- grant. `service_role` already had SELECT for the callback's soft lookup.
-- ----------------------------------------------------------------------------

grant insert, update on public.discount_codes to service_role;

-- ----------------------------------------------------------------------------
-- The lookup, with ownership
--
-- Recreated rather than replaced: `create or replace function` cannot change the
-- return type of a set-returning function, and two columns are being added.
--
--  * `personal` — this code has an owner. The evaluator uses it to ask for a
--    sign-in before accepting the code in the cart, rather than after the address
--    has been filled in.
--
--  * `caller_is_recipient` — the owner is the caller. Matched against
--    `auth.users.email` and only when `email_confirmed_at` is set: an account
--    that has not proved it owns an address must not be able to claim a code
--    issued to it. This is the only reason the function touches `auth`, and it is
--    why it is SECURITY DEFINER.
--
-- What it deliberately does *not* return is the address the code was issued to.
-- A caller who is not the owner learns that the string exists — which they had to
-- know in full to ask — and nothing about whose it is.
-- ----------------------------------------------------------------------------

drop function public.discount_lookup(text);

create function public.discount_lookup(p_code text)
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
  caller_has_paid     boolean,
  personal            boolean,
  caller_is_recipient boolean
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
    ),
    c.issued_to_email is not null,
    -- `u.id = auth.uid()` matches nothing when there is no session, so a
    -- signed-out caller is never the recipient.
    (
      c.issued_to_email is not null
      and exists (
        select 1 from auth.users u
        where u.id = auth.uid()
          and u.email_confirmed_at is not null
          and lower(u.email) = c.issued_to_email
      )
    )
  from public.discount_codes c
  where c.enabled
    and char_length(btrim(p_code)) between 3 and 24
    and c.code = upper(btrim(p_code));
$$;

comment on function public.discount_lookup(text) is
  'One code by its exact string, with the redemption counts needed to apply its '
  'limits and whether the caller owns it. Returns no rows for an unknown or '
  'switched-off code. The only way the storefront may touch discount_codes.';

revoke all on function public.discount_lookup(text) from public;
grant execute on function public.discount_lookup(text) to anon, authenticated;
