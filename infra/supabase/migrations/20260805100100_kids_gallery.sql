-- ============================================================================
-- La galería de los peques — children's art gallery
--
-- At the fairs the shop goes to, the people who stay longest at the stand are
-- children. This gives them somewhere to be: they photograph a drawing they
-- brought, or paint one on a tablet at the stand, sign it with their name, and
-- it goes up on the site. From its page they (well, whoever pays) can order it
-- printed on a t-shirt.
--
-- Three things shape the schema, and all three are about the fact that the
-- author is a minor and the page is public:
--
--  1. **The publisher is an adult with an account; the author is a child with
--     none.** `user_id` is the grown-up who pressed publish and who answers for
--     the consent. `author_name` / `author_age` are the credit line. They are
--     deliberately different columns for different people.
--
--  2. **Only a first name, and at most an age.** "Martina, 7 años" gives credit
--     and lets a child find their own drawing again; it does not identify a
--     particular child on an indexable page. The CHECK on `author_name` caps the
--     length; the application refuses three words or more, which is the shape a
--     full name typed into the wrong box takes. Not a ban on spaces: "Ana María"
--     is one first name.
--
--  3. **The consent travels with the drawing it authorises.** Not a boolean on
--     the profile and not a pointer at today's privacy notice: the exact wording
--     that was on screen, the document version, the locale, stored on the row.
--     Consent to publish one drawing is not consent to publish the next one, so
--     it is recorded per artwork. A matching row also goes into `user_consents`
--     from the application, which is the trail that survives the artwork being
--     deleted.
--
-- Publication is immediate — a child at a stand who is told "it will appear in a
-- few days" has been told nothing — and moderation is retirement after the fact.
-- See `hidden_by_admin` for what stops that being a revolving door.
-- ============================================================================

create type public.artwork_origin as enum ('upload', 'painted');

comment on type public.artwork_origin is
  'How the drawing got here: a photograph of something made on paper, or painted '
  'in the browser with the studio tool.';

create type public.artwork_status as enum ('published', 'hidden');

-- ----------------------------------------------------------------------------
-- The drawings
-- ----------------------------------------------------------------------------

create table public.artworks (
  id            uuid primary key default gen_random_uuid(),

  -- The adult who published it and who consented. Cascade: closing an account
  -- takes the drawings with it, which is the behaviour a guardian expects when
  -- they ask for their data to be erased.
  user_id       uuid not null references auth.users (id) on delete cascade,

  -- Title-derived plus a random suffix, so two "mi perro" can coexist without
  -- the second child being told their title is taken.
  slug          text not null unique
                  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),

  -- The child's own words. Not localised, and it must not be: it is what they
  -- called it, in the language they called it.
  title         text not null check (char_length(btrim(title)) between 1 and 60),

  -- The credit line. First name only; age optional and never required to
  -- publish, because "how old is your child" is not a question a shop needs an
  -- answer to.
  author_name   text not null check (char_length(btrim(author_name)) between 1 and 24),
  author_age    smallint check (author_age between 1 and 17),

  origin        public.artwork_origin not null,
  status        public.artwork_status not null default 'published',

  -- Object in the `media` bucket, always under gallery/<user_id>/. The path is
  -- built on the server from the id and a hash of the bytes, never from the
  -- uploaded filename — the storage policy below enforces the folder anyway.
  storage_path  text not null unique,
  width         integer not null check (width between 1 and 12000),
  height        integer not null check (height between 1 and 12000),

  -- ---------------------------------------------------------------- consent
  --
  -- The wording that was actually on screen, verbatim. Storing a link to the
  -- privacy notice would show what it says today, not what this person agreed
  -- to on the day, and Art. 7(1) puts the burden of proof on us.
  consent_text    text not null check (char_length(btrim(consent_text)) > 0),
  consent_version text not null,
  consent_locale  text not null default 'es',

  -- Not a flag that can be false: a row where the box was not ticked must not
  -- exist, so the CHECK has no escape and there is no default to fall through.
  -- Reading a dump, every drawing in this table demonstrably had its box ticked.
  guardian_confirmed boolean not null check (guardian_confirmed),

  -- ------------------------------------------------------------- moderation
  --
  -- Who hid it matters. A guardian hiding their own drawing may put it back; a
  -- drawing an administrator retired stays retired, or moderation would be a
  -- button the moderated party can press back. Enforced in the update policies,
  -- not by convention.
  hidden_by_admin boolean not null default false,
  hidden_at       timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- A retired drawing that is somehow still 'published' would be a moderation
  -- decision with no effect, so the two cannot disagree: if the shop retired it,
  -- it is hidden.
  constraint artworks_hidden_state check (
    (status = 'hidden') or (not hidden_by_admin)
  )
);

comment on table public.artworks is
  'Children''s drawings, published by an adult account holder. `user_id` is the '
  'grown-up who consented; `author_name` is the child who drew it.';

comment on column public.artworks.guardian_confirmed is
  'Always true — a CHECK with no default and no false branch, so a drawing that '
  'was published without the guardian ticking the box cannot exist as a row.';

comment on column public.artworks.hidden_by_admin is
  'Set when the shop retires a drawing. The owner''s update policy refuses rows '
  'where it is true, so a retired drawing cannot be re-published by its owner.';

-- The public grid is "published, newest first"; the account tab is "mine".
create index artworks_public_idx
  on public.artworks (created_at desc)
  where status = 'published';

create index artworks_owner_idx on public.artworks (user_id, created_at desc);

create trigger artworks_touch before update on public.artworks
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- Row level security
-- ----------------------------------------------------------------------------

alter table public.artworks enable row level security;

-- Anyone may read a published drawing: that is the point of the gallery. A
-- hidden one is not merely absent from the grid, it is unreadable with the anon
-- key — the same rule the disabled promo messages get.
create policy "artworks: public read published"
  on public.artworks for select
  to anon, authenticated
  using (status = 'published');

create policy "artworks: read own"
  on public.artworks for select
  to authenticated
  using (user_id = auth.uid());

create policy "artworks: admins read all"
  on public.artworks for select
  to authenticated
  using (public.is_admin());

-- `user_id` comes from the validated session in the application, and this is
-- what makes that non-negotiable: a crafted request cannot publish under
-- somebody else's account. A row can only arrive published and un-retired.
create policy "artworks: publish own"
  on public.artworks for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and guardian_confirmed
    and not hidden_by_admin
  );

-- The owner may retitle, re-credit, hide and unhide — but only while the shop
-- has not retired it, which is what `not hidden_by_admin` says on both sides of
-- the policy: in USING against the row as it stands, and in WITH CHECK so the
-- flag cannot be cleared on the way past.
create policy "artworks: owner updates own"
  on public.artworks for update
  to authenticated
  using (user_id = auth.uid() and not hidden_by_admin)
  with check (user_id = auth.uid() and not hidden_by_admin);

create policy "artworks: admin moderates"
  on public.artworks for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Erasure is not moderation, so it survives retirement: a guardian may always
-- delete their child's drawing, including one the shop has hidden.
create policy "artworks: owner deletes own"
  on public.artworks for delete
  to authenticated
  using (user_id = auth.uid());

create policy "artworks: admin deletes"
  on public.artworks for delete
  to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- Column privileges
--
-- Supabase hands `anon` and `authenticated` ALL on every new table in `public`,
-- and a table-level UPDATE grant cannot be clawed back column by column — so the
-- grant is dropped entirely and re-issued per column, exactly as
-- `public.profiles` does for `is_admin`.
--
-- What this buys, on top of RLS: the consent record, the file the row points at
-- and the identity of the publisher are **immutable**. Nobody — owner or
-- administrator — can rewrite what was consented to, or repoint a published
-- drawing at a different image after the fact.
-- ----------------------------------------------------------------------------

revoke all on public.artworks from anon, authenticated;

grant select on public.artworks to anon, authenticated;

grant insert (
  user_id, slug, title, author_name, author_age, origin, status,
  storage_path, width, height,
  consent_text, consent_version, consent_locale, guardian_confirmed
) on public.artworks to authenticated;

-- `hidden_by_admin` and `hidden_at` are granted because privileges are per role
-- and an administrator *is* `authenticated`. The policies above are what stop an
-- ordinary account from setting them.
grant update (
  title, author_name, author_age, status, hidden_by_admin, hidden_at
) on public.artworks to authenticated;

grant delete on public.artworks to authenticated;

-- ============================================================================
-- Ordering a drawing on a t-shirt
-- ============================================================================

-- Which products can carry one. Not every garment can: the print area, the
-- process and the price differ, so this is a property of the product and an
-- administrator ticks it. With none ticked, the drawing page simply has no
-- "put it on a t-shirt" section — the same rule the video and the framed
-- preview follow.
alter table public.products
  add column if not exists artwork_printable boolean not null default false;

comment on column public.products.artwork_printable is
  'This product can be printed with a drawing from the children''s gallery. '
  'False (the default) keeps it out of the picker on an artwork page.';

create index if not exists products_artwork_printable_idx
  on public.products (artwork_printable)
  where artwork_printable;

-- What was actually bought. `artwork_id` is a soft reference for the same reason
-- `product_id` is one — deleting a drawing must not rewrite an order — and the
-- title and path beside it are the snapshot that keeps the line meaningful, and
-- printable, after the reference is gone.
alter table public.order_items
  add column if not exists artwork_id    uuid references public.artworks (id) on delete set null,
  add column if not exists artwork_title text,
  add column if not exists artwork_path  text;

comment on column public.order_items.artwork_path is
  'Copy of the drawing''s storage path at the time of the order. Kept so a shirt '
  'that has been paid for can still be printed after the guardian removes the '
  'drawing from the gallery — completing the sale is contract performance, not '
  'continued publication.';

-- ----------------------------------------------------------------------------
-- Is this drawing part of an order?
--
-- Anyone can order a t-shirt printed with any published drawing, so "has this
-- been ordered" is a question about rows the asker cannot see: their own RLS
-- scope covers their own orders, not everyone's. SECURITY DEFINER answers it
-- without handing out the orders themselves — it returns a boolean and nothing
-- else.
--
-- It exists so that deleting a drawing can keep the one copy the shop needs to
-- print a shirt somebody has already paid for. The gallery row goes; the image
-- stays until the order it belongs to is done.
-- ----------------------------------------------------------------------------

create or replace function public.artwork_in_use(p_artwork uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.order_items i where i.artwork_id = p_artwork
  );
$$;

revoke all on function public.artwork_in_use(uuid) from public;
grant execute on function public.artwork_in_use(uuid) to authenticated;

-- ============================================================================
-- Storage: the gallery folder
--
-- The bucket already exists and is public-read. What is new is that a *customer*
-- may now write to it, which the previous policies allowed nobody but an admin
-- to do. Two constraints make that safe:
--
--   * one folder per account, `gallery/<auth.uid()>/…`, so no account can write
--     over another's file;
--   * **no SVG**. The bucket's MIME list allows `image/svg+xml` because the shop
--     draws its own artwork, and an SVG uploaded by the shop is trusted. One
--     uploaded by the public is not: an SVG is a script container, and a
--     public-read one served from our own origin is stored XSS the moment
--     somebody opens the file URL directly. The bucket configuration cannot
--     express "except in this folder", so the extension is refused here — and
--     the MIME type is checked again in the Server Action.
-- ============================================================================

create policy "media: gallery insert own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'gallery'
    and (storage.foldername(name))[2] = auth.uid()::text
    and name !~* '\.svgz?$'
  );

create policy "media: gallery delete own folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'gallery'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
