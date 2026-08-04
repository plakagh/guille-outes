-- ============================================================================
-- Record consent atomically with the account
--
-- The first attempt smuggled the choice through the confirmation link. That was
-- fragile and wrong: Supabase URL-encodes `emailRedirectTo` into `.RedirectTo`,
-- so the parameter ended up nested inside `next` and never arrived.
--
-- Consent is now carried in the sign-up metadata and written by this trigger,
-- which already runs as a SECURITY DEFINER on `auth.users` insert. That means:
--
--   * the record exists from the moment the account does, so there is no window
--     where an account has no consent trail;
--   * it works whether or not email confirmation is enabled;
--   * no service-role key is involved — the trigger is the privileged path that
--     already existed for exactly this kind of bookkeeping.
--
-- The trigger only fires on INSERT, so a customer later editing their own
-- metadata cannot forge or replay a consent record.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta        jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  doc_version text  := coalesce(nullif(meta ->> 'consent_version', ''), 'unversioned');
  consent_loc text  := coalesce(nullif(meta ->> 'consent_locale', ''), 'es');
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(meta ->> 'full_name', '')), '')
  )
  on conflict (id) do update
    set email = excluded.email;

  -- Accepting the terms is required to register, so its absence means the
  -- account was created some other way (Studio, an invite, a seed script) and
  -- there is simply nothing to record.
  if (meta ->> 'consent_terms') = 'true' then
    insert into public.user_consents (user_id, kind, granted, doc_version, source, locale)
    values (new.id, 'terms', true, doc_version, 'signup', consent_loc);
  end if;

  if (meta ->> 'consent_marketing') = 'true' then
    insert into public.user_consents (user_id, kind, granted, doc_version, source, locale)
    values (new.id, 'marketing', true, doc_version, 'signup', consent_loc);
  end if;

  return new;
end;
$$;
