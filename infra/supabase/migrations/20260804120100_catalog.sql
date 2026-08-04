-- ============================================================================
-- Catalogue: categories, collections, products, stock, images, authors
--
-- Every human-readable string is stored as JSONB keyed by locale
-- ({"es": "...", "gl": "...", "en": "..."}). Spanish is required; the other
-- locales fall back to it in the application layer when missing.
--
-- Reads are public (anon) but only for published rows. Every write requires
-- public.is_admin().
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Domains and enums
-- ----------------------------------------------------------------------------

create domain public.i18n_text as jsonb
  check (value ? 'es' and jsonb_typeof(value) = 'object');

comment on domain public.i18n_text is
  'Localised string: {"es": "...", "gl": "...", "en": "..."}. "es" is required.';

create domain public.i18n_list as jsonb
  check (jsonb_typeof(value) = 'object');

comment on domain public.i18n_list is
  'Localised array of strings, e.g. {"es": ["a","b"], "en": ["a"]}.';

create type public.audience as enum ('hombre', 'mujer', 'ninos', 'unisex');

create type public.art_shape as enum (
  'tee', 'hoodie', 'jersey', 'jacket', 'shorts',
  'cap', 'beanie', 'tote', 'ball', 'bottle', 'poster'
);

create type public.art_print as enum ('wordmark', 'monogram', 'number', 'none');

-- ----------------------------------------------------------------------------
-- Categories
-- ----------------------------------------------------------------------------

create table public.categories (
  id          text primary key,
  slug        public.i18n_text not null,
  name        public.i18n_text not null,
  heading     public.i18n_text not null,
  blurb       public.i18n_text not null,
  keywords    public.i18n_list not null default '{}'::jsonb,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Collections
-- ----------------------------------------------------------------------------

create table public.collections (
  id          text primary key,
  slug        public.i18n_text not null,
  name        public.i18n_text not null,
  tagline     public.i18n_text not null,
  blurb       public.i18n_text not null,
  keywords    public.i18n_list not null default '{}'::jsonb,
  accent      text not null default '#141414',
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Authors — the people credited on each product
-- ----------------------------------------------------------------------------

create table public.authors (
  id          uuid primary key default gen_random_uuid(),
  slug        public.i18n_text not null,
  name        text not null,
  role        public.i18n_text not null,
  bio         public.i18n_text not null,
  -- Longer biography / statement shown on the bibliography page.
  statement   public.i18n_text,
  photo_path  text,
  -- [{ "label": "Instagram", "url": "https://…" }]
  links       jsonb not null default '[]'::jsonb,
  keywords    public.i18n_list not null default '{}'::jsonb,
  published   boolean not null default true,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint authors_links_is_array check (jsonb_typeof(links) = 'array')
);

-- Bibliography entries belonging to an author.
create table public.author_works (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references public.authors (id) on delete cascade,
  year        integer,
  title       text not null,
  publisher   text,
  -- book | article | zine | catalogue | talk | exhibition | film
  kind        text not null default 'article',
  url         text,
  note        public.i18n_text,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index author_works_author_idx on public.author_works (author_id, year desc nulls last);

-- ----------------------------------------------------------------------------
-- Products
-- ----------------------------------------------------------------------------

create table public.products (
  id                uuid primary key default gen_random_uuid(),
  ref               text not null unique,
  slug              public.i18n_text not null,
  name              public.i18n_text not null,
  description       public.i18n_text not null,
  details           public.i18n_list not null default '{}'::jsonb,
  keywords          public.i18n_list not null default '{}'::jsonb,
  category_id       text not null references public.categories (id) on delete restrict,
  collection_id     text references public.collections (id) on delete set null,
  audience          public.audience not null default 'unisex',
  shape             public.art_shape not null,
  print             public.art_print not null default 'wordmark',
  price_cents       integer not null check (price_cents >= 0),
  compare_at_cents  integer check (compare_at_cents is null or compare_at_cents > price_cents),
  -- Ordered list of colourway ids from the design-system palette.
  colorways         jsonb not null default '[]'::jsonb,
  rating            numeric(2, 1) not null default 0 check (rating >= 0 and rating <= 5),
  reviews           integer not null default 0 check (reviews >= 0),
  bestseller        boolean not null default false,
  exclusive         boolean not null default false,
  published         boolean not null default true,
  -- Sort weight for "novedades"; higher is newer.
  arrived           integer not null default 0,
  search_doc        tsvector,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint products_colorways_is_array check (jsonb_typeof(colorways) = 'array')
);

create index products_category_idx on public.products (category_id);
create index products_collection_idx on public.products (collection_id);
create index products_audience_idx on public.products (audience);
create index products_published_idx on public.products (published);
create index products_search_idx on public.products using gin (search_doc);
-- Slug lookups hit one locale at a time.
create unique index products_slug_es_idx on public.products ((slug ->> 'es'));
create unique index products_slug_gl_idx on public.products ((slug ->> 'gl'));
create unique index products_slug_en_idx on public.products ((slug ->> 'en'));

-- Stock lives per size × colourway.
create table public.product_variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  size        text not null,
  colorway_id text not null,
  sku         text unique,
  stock       integer not null default 0 check (stock >= 0),
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (product_id, size, colorway_id)
);

create index product_variants_product_idx on public.product_variants (product_id);

-- Uploaded photography, layered over the generated vector artwork.
create table public.product_images (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products (id) on delete cascade,
  storage_path  text not null,
  alt           public.i18n_text,
  colorway_id   text,
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index product_images_product_idx on public.product_images (product_id, position);

-- Credits: a product can have several authors, an author several products.
create table public.product_authors (
  product_id  uuid not null references public.products (id) on delete cascade,
  author_id   uuid not null references public.authors (id) on delete cascade,
  -- Contribution for this specific product, e.g. {"es": "Ilustración"}.
  role        public.i18n_text,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  primary key (product_id, author_id)
);

create index product_authors_author_idx on public.product_authors (author_id);

-- ----------------------------------------------------------------------------
-- Search document
-- ----------------------------------------------------------------------------

create or replace function public.products_refresh_search_doc()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parts text := '';
  loc text;
begin
  foreach loc in array array['es', 'gl', 'en'] loop
    parts := parts
      || ' ' || coalesce(new.name ->> loc, '')
      || ' ' || coalesce(new.description ->> loc, '')
      || ' ' || coalesce(
           (select string_agg(value, ' ')
            from jsonb_array_elements_text(coalesce(new.keywords -> loc, '[]'::jsonb))),
           ''
         );
  end loop;

  new.search_doc := to_tsvector('simple', parts);
  return new;
end;
$$;

create trigger products_search_doc
  before insert or update of name, description, keywords on public.products
  for each row execute function public.products_refresh_search_doc();

-- ----------------------------------------------------------------------------
-- updated_at triggers
-- ----------------------------------------------------------------------------

create trigger categories_touch before update on public.categories
  for each row execute function public.touch_updated_at();
create trigger collections_touch before update on public.collections
  for each row execute function public.touch_updated_at();
create trigger authors_touch before update on public.authors
  for each row execute function public.touch_updated_at();
create trigger author_works_touch before update on public.author_works
  for each row execute function public.touch_updated_at();
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();
create trigger product_variants_touch before update on public.product_variants
  for each row execute function public.touch_updated_at();
create trigger product_images_touch before update on public.product_images
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- Atomic stock movement
--
-- SECURITY INVOKER on purpose: the UPDATE still passes through the admin-only
-- RLS policy below, so this helper adds atomicity, not privilege.
-- ----------------------------------------------------------------------------

create or replace function public.adjust_stock(variant_id uuid, delta integer)
returns public.product_variants
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated public.product_variants;
begin
  update public.product_variants
     set stock = greatest(0, stock + delta)
   where id = variant_id
  returning * into updated;

  if updated is null then
    raise exception 'variant % not found or not writable', variant_id
      using errcode = '42501';
  end if;

  return updated;
end;
$$;

revoke all on function public.adjust_stock(uuid, integer) from public;
grant execute on function public.adjust_stock(uuid, integer) to authenticated;

-- ============================================================================
-- Row level security
-- ============================================================================

alter table public.categories        enable row level security;
alter table public.collections       enable row level security;
alter table public.authors           enable row level security;
alter table public.author_works      enable row level security;
alter table public.products          enable row level security;
alter table public.product_variants  enable row level security;
alter table public.product_images    enable row level security;
alter table public.product_authors   enable row level security;

-- Public, read-only storefront access -----------------------------------------

create policy "categories: public read"
  on public.categories for select to anon, authenticated using (true);

create policy "collections: public read"
  on public.collections for select to anon, authenticated using (true);

create policy "authors: public read published"
  on public.authors for select to anon, authenticated
  using (published or public.is_admin());

create policy "author_works: public read"
  on public.author_works for select to anon, authenticated
  using (
    exists (
      select 1 from public.authors a
      where a.id = author_works.author_id
        and (a.published or public.is_admin())
    )
  );

create policy "products: public read published"
  on public.products for select to anon, authenticated
  using (published or public.is_admin());

create policy "product_variants: public read"
  on public.product_variants for select to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_variants.product_id
        and (p.published or public.is_admin())
    )
  );

create policy "product_images: public read"
  on public.product_images for select to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id
        and (p.published or public.is_admin())
    )
  );

create policy "product_authors: public read"
  on public.product_authors for select to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_authors.product_id
        and (p.published or public.is_admin())
    )
  );

-- Admin-only writes ------------------------------------------------------------
-- One FOR ALL policy per table; `using` gates update/delete and `with check`
-- gates insert/update. Both call is_admin(), so nothing else can write.

create policy "categories: admin write"
  on public.categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "collections: admin write"
  on public.collections for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "authors: admin write"
  on public.authors for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "author_works: admin write"
  on public.author_works for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "products: admin write"
  on public.products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "product_variants: admin write"
  on public.product_variants for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "product_images: admin write"
  on public.product_images for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "product_authors: admin write"
  on public.product_authors for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Table privileges. RLS does the authorisation; these grants only make the
-- tables reachable. anon gets SELECT and nothing else.

grant select on
  public.categories, public.collections, public.authors, public.author_works,
  public.products, public.product_variants, public.product_images,
  public.product_authors
to anon, authenticated;

grant insert, update, delete on
  public.categories, public.collections, public.authors, public.author_works,
  public.products, public.product_variants, public.product_images,
  public.product_authors
to authenticated;
