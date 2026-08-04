-- ============================================================================
-- Profiles and the admin role
--
-- Authorisation lives in Postgres, not in the app. Every write policy in later
-- migrations calls public.is_admin(), so a compromised or bypassed UI cannot
-- grant itself write access: the database refuses it.
-- ============================================================================

create extension if not exists pgcrypto;

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  -- The single flag that turns an account into an administrator. Flip it in
  -- Studio (or with SQL as postgres); it is deliberately NOT writable by the
  -- account itself — see the privilege-escalation guard below.
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on column public.profiles.is_admin is
  'Grants write access to the catalogue. Only settable by postgres/service_role.';

alter table public.profiles enable row level security;

-- ----------------------------------------------------------------------------
-- Keep a profile row in step with auth.users
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '')
  )
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- updated_at bookkeeping, reused by every table in the next migration
-- ----------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- Privilege-escalation guard
--
-- Two independent layers, because either one alone has failed before:
--
--   1. Column-level GRANT. A table-level `GRANT UPDATE` implies update on every
--      column and cannot be clawed back per column — revoking a column
--      privilege does nothing while the table-level grant stands. So the table
--      privilege is dropped entirely and UPDATE is re-granted column by column,
--      deliberately excluding is_admin. Supabase's default privileges hand
--      anon/authenticated ALL on new tables in public, which is what the
--      leading REVOKE undoes.
--
--   2. A trigger, in case a later migration widens the grants again. It must be
--      SECURITY INVOKER (the default): under SECURITY DEFINER, `current_user`
--      is the function owner (postgres) and the check would always pass.
-- ----------------------------------------------------------------------------

revoke all on public.profiles from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

create or replace function public.guard_admin_flag()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_admin is distinct from old.is_admin then
    -- Trusted callers only: SQL console, migrations, service-role backends.
    if current_user not in ('postgres', 'supabase_admin', 'service_role') then
      raise exception 'is_admin can only be changed by a trusted role'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_guard_admin_flag
  before update on public.profiles
  for each row execute function public.guard_admin_flag();

-- ----------------------------------------------------------------------------
-- Admin predicate used by every catalogue write policy
--
-- SECURITY DEFINER so that a policy on another table can check the flag even
-- though the caller cannot read other people's profiles. `search_path = ''`
-- and fully-qualified names prevent search-path hijacking.
-- ----------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Policies: a session sees and edits only its own profile
-- ----------------------------------------------------------------------------

create policy "profiles: read own row"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "profiles: admins read all"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

create policy "profiles: update own row"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- No insert or delete policy: rows are created by the auth trigger and removed
-- by the cascade from auth.users. (Table privileges are granted above, before
-- the column-level revoke, so they cannot re-open the is_admin column.)
