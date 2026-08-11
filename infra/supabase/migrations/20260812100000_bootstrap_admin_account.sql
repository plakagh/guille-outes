-- ============================================================================
-- Bootstrap the owner's administrator account
--
-- Until now the first admin had to be created by hand: sign up through the
-- storefront, then flip public.profiles.is_admin in Studio. That leaves a fresh
-- deployment (and every `db reset` during development) with no way into the
-- back office, so the account is seeded here instead.
--
-- SECURITY: the password below is in the repository and therefore in the git
-- history. It is a bootstrap credential, not a secret — change it from the
-- account settings after the first login, which rewrites encrypted_password and
-- makes this value useless. Rerunning the migration afterwards (a `db reset`,
-- say) resets it back to the bootstrap value, which is exactly what you want on
-- a throwaway local database and never happens on the VPS, where migrations are
-- only applied forward.
--
-- Writing straight to auth.users is the only option available to a migration:
-- there is no SQL-level "create user" in GoTrue, and the admin REST API needs a
-- service-role key the database does not have. The shape of the rows below
-- mirrors what GoTrue writes on a normal email sign-up:
--
--   * a row in auth.users with a bcrypt hash and email_confirmed_at set, so the
--     account skips the confirmation mail it would never receive;
--   * a matching auth.identities row — GoTrue looks the identity up by
--     (provider, provider_id) on password login and refuses an account without
--     one;
--   * public.profiles is created by the on_auth_user_created trigger, so this
--     migration only has to raise the is_admin flag afterwards.
--
-- The whole thing is idempotent: an account that already exists (someone signed
-- up with this address first) keeps its id and simply has its password reset
-- and the admin flag raised.
-- ============================================================================

do $$
declare
  admin_email    constant text := 'fernando@plakastudio.com';
  admin_password constant text := 'hf90ma3kGuille';
  admin_id       uuid;
begin
  -- pgcrypto's crypt()/gen_salt() live in `extensions` on the Supabase image but
  -- land in `public` when a plain Postgres installs the extension. Putting both
  -- on the path resolves them either way. `true` scopes the change to this
  -- statement's transaction, so no later migration inherits it.
  perform set_config('search_path', 'public, extensions', true);

  select id into admin_id from auth.users where email = admin_email;

  if admin_id is null then
    admin_id := gen_random_uuid();

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      -- GoTrue scans these into Go strings; the column defaults are already ''
      -- but they are spelled out because a NULL here fails the login with an
      -- opaque "converting NULL to string is unsupported".
      confirmation_token,
      recovery_token,
      email_change,
      email_change_token_new
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      admin_id,
      'authenticated',
      'authenticated',
      admin_email,
      crypt(admin_password, gen_salt('bf')),
      now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    );
  else
    update auth.users
       set encrypted_password = crypt(admin_password, gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at         = now()
     where id = admin_id;
  end if;

  -- identity_data must carry `sub` and `email`: GoTrue reads the account back
  -- out of this JSON, not out of auth.users.
  insert into auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    admin_id::text,
    admin_id,
    jsonb_build_object(
      'sub',            admin_id::text,
      'email',          admin_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  )
  on conflict (provider_id, provider) do nothing;

  -- The trigger inserted the profile already; the upsert covers the case where
  -- the account predates this migration. Migrations run as postgres, which is
  -- one of the roles guard_admin_flag() lets change is_admin.
  insert into public.profiles (id, email, is_admin)
  values (admin_id, admin_email, true)
  on conflict (id) do update
    set is_admin = true,
        email    = excluded.email;
end
$$;
