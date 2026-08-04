-- ============================================================================
-- Consent records (RGPD / GDPR)
--
-- Article 7(1) puts the burden of proof on the controller: you must be able to
-- demonstrate that the person consented, to *what*, and *when*. A boolean on the
-- profile cannot do that — it loses the history and the document version — so
-- every act of consent is stored as its own immutable row.
--
-- Two kinds, deliberately separate (consent must be unbundled and specific):
--
--   terms      accepting the terms of sale and the privacy notice. Required to
--              create an account, and therefore a *contractual* necessity rather
--              than consent in the Art. 6(1)(a) sense — recorded all the same.
--   marketing  the newsletter. Genuinely optional, never pre-ticked, and
--              withdrawable at any time (Art. 7(3)).
-- ============================================================================

create type public.consent_kind as enum ('terms', 'marketing');

create table public.user_consents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        public.consent_kind not null,
  -- true = given, false = withdrawn. Withdrawal is a new row, never an update,
  -- so the audit trail survives.
  granted     boolean not null,
  -- Which version of the documents was shown at the time.
  doc_version text not null,
  -- Where it happened: 'signup', 'account', 'newsletter'.
  source      text not null default 'signup',
  locale      text not null default 'es',
  created_at  timestamptz not null default now()
);

create index user_consents_user_idx on public.user_consents (user_id, kind, created_at desc);

alter table public.user_consents enable row level security;

-- Customers may read their own history and add to it. Nothing may edit or
-- delete a record: an audit trail you can rewrite is not an audit trail.
create policy "consents: read own"
  on public.user_consents for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "consents: append own"
  on public.user_consents for insert
  to authenticated
  with check (user_id = auth.uid());

revoke all on public.user_consents from anon;
grant select, insert on public.user_consents to authenticated;

-- ----------------------------------------------------------------------------
-- Current state, derived from the latest row per kind
-- ----------------------------------------------------------------------------

create or replace function public.has_consent(p_user uuid, p_kind public.consent_kind)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select c.granted
      from public.user_consents c
      where c.user_id = p_user and c.kind = p_kind
      order by c.created_at desc
      limit 1
    ),
    false
  );
$$;

revoke all on function public.has_consent(uuid, public.consent_kind) from public;
grant execute on function public.has_consent(uuid, public.consent_kind) to authenticated, service_role;
