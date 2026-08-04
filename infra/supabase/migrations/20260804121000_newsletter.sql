-- Newsletter subscriptions, with double opt-in.
--
-- Confirming by email is not a nicety here. Under the RGPD consent has to be a
-- freely given, specific, informed and unambiguous *affirmative act* (Art. 4(11))
-- and we carry the burden of proving it (Art. 7(1)) — and under the LSSI-CE
-- commercial email needs prior consent from the person who owns the address.
-- Anyone can type someone else's address into a form, so a single-step signup
-- proves nothing. The confirmation click is what ties the consent to the mailbox.
--
-- Therefore:
--
--  * a new address is stored as `pending` and receives nothing but the
--    confirmation request;
--  * `confirmed` is reached only by clicking a link we sent to that address;
--  * withdrawal (Art. 7(3)) is one click, no login, no explanation, and every
--    email we send carries it;
--  * what was agreed to, when, and from which address is stored alongside — a
--    tick in a database is not proof on its own.

create type public.newsletter_status as enum ('pending', 'confirmed', 'unsubscribed');

create table public.newsletter_subscribers (
  id                   uuid primary key default gen_random_uuid(),
  email                text not null,
  status               public.newsletter_status not null default 'pending',
  locale               text not null default 'es' check (locale in ('es', 'gl', 'en')),

  -- Only the SHA-256 of the confirmation token is kept. A leaked database must
  -- not let anyone confirm a subscription on someone else's behalf.
  confirm_token_hash   text,
  confirm_sent_at      timestamptz,
  confirm_expires_at   timestamptz,
  confirmed_at         timestamptz,

  -- Long-lived and unguessable: it goes in every newsletter, and one click has to
  -- work years later without a login.
  unsubscribe_token    text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  unsubscribed_at      timestamptz,

  -- Where the form was, so a complaint can be traced to a page.
  source               text not null default 'footer',

  -- The consent record. `consent_text` is the exact wording that was on screen,
  -- stored verbatim: pointing at today's privacy policy would not show what the
  -- person actually agreed to back then.
  consent_version      text not null,
  consent_text         text not null,
  consent_at           timestamptz not null default now(),
  consent_ip           inet,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Addresses are case-insensitive in practice, so uniqueness has to be too;
-- otherwise Ana@ and ana@ become two subscribers and get two copies.
create unique index newsletter_subscribers_email_key
  on public.newsletter_subscribers (lower(email));

create index newsletter_subscribers_status_idx
  on public.newsletter_subscribers (status, created_at desc);

create trigger newsletter_subscribers_touch
  before update on public.newsletter_subscribers
  for each row execute function public.touch_updated_at();

/**
 * Append-only history, so "the state of people" is not just a mutable row.
 *
 * If someone says they never signed up, or asks when they were unsubscribed, the
 * row alone cannot answer — it only holds the latest state. These events can.
 */
create type public.newsletter_event_kind as enum (
  'requested', 'confirmed', 'unsubscribed', 'resubscribed'
);

create table public.newsletter_events (
  id             bigserial primary key,
  subscriber_id  uuid not null references public.newsletter_subscribers (id) on delete cascade,
  kind           public.newsletter_event_kind not null,
  ip             inet,
  created_at     timestamptz not null default now()
);

create index newsletter_events_subscriber_idx
  on public.newsletter_events (subscriber_id, created_at);

/* -------------------------------------------------------------------- RLS */

alter table public.newsletter_subscribers enable row level security;
alter table public.newsletter_events      enable row level security;

-- Nothing here is client-writable, and nobody but an administrator may read it:
-- a subscriber list is a list of people's email addresses, which is exactly the
-- kind of thing that must not be reachable with the public anon key. Writes go
-- through the server (service role) after the address has been verified.
revoke all on public.newsletter_subscribers from anon, authenticated;
revoke all on public.newsletter_events      from anon, authenticated;

grant select on public.newsletter_subscribers to authenticated;
grant select on public.newsletter_events      to authenticated;

create policy "admins read subscribers"
  on public.newsletter_subscribers for select
  to authenticated
  using (public.is_admin());

create policy "admins read newsletter events"
  on public.newsletter_events for select
  to authenticated
  using (public.is_admin());

comment on table public.newsletter_subscribers is
  'Newsletter list. Double opt-in: pending until the address confirms. Not readable '
  'with the anon key at all, and only administrators can read it as a logged-in user.';

comment on column public.newsletter_subscribers.confirm_token_hash is
  'SHA-256 of the confirmation token. The token itself only ever exists in the email.';
