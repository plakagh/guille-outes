-- The rotating messages in the promo bar.
--
-- They were a hard-coded array reading from the dictionaries, so changing "free
-- shipping over 60 €" — the kind of line that changes with a campaign — needed a
-- deploy, and it could contradict the actual shipping settings sitting one table
-- away. Now they are rows.
--
-- Both the text and the link are localised. The link is stored per locale rather
-- than as a route id plus slug because the admin needs to be able to point a
-- message anywhere — a help article, a curated shop section, an external page —
-- and the localised path is the one thing that expresses all of those. Blank
-- translations fall back to Spanish, the same rule the product editor uses.

create table public.promo_messages (
  id          uuid primary key default gen_random_uuid(),
  text        public.i18n_text not null,
  -- Optional: a message may be an announcement with nothing to click.
  link        jsonb,
  position    integer not null default 0,
  enabled     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint promo_messages_link_is_object
    check (link is null or jsonb_typeof(link) = 'object')
);

create index promo_messages_order_idx on public.promo_messages (enabled, position, created_at);

create trigger promo_messages_touch
  before update on public.promo_messages
  for each row execute function public.touch_updated_at();

alter table public.promo_messages enable row level security;

-- Public read, but only what is switched on: a disabled message is a draft.
create policy "anyone reads enabled promo messages"
  on public.promo_messages for select
  to anon, authenticated
  using (enabled);

create policy "admins read every promo message"
  on public.promo_messages for select
  to authenticated
  using (public.is_admin());

create policy "admins write promo messages"
  on public.promo_messages for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- The three messages the bar shipped with. The fourth — "personalise your shirt
-- with a name and number" — is deliberately not carried over: the shop does not
-- offer that, so it was promising something it could not deliver.
insert into public.promo_messages (text, link, position) values
  (
    '{"es":"Envío gratis en pedidos superiores a 60 €","gl":"Envío gratis en pedidos superiores a 60 €","en":"Free shipping on orders over 60 €"}',
    '{"es":"/es/ayuda/envios","gl":"/gl/axuda/envios","en":"/en/help/shipping"}',
    10
  ),
  (
    '{"es":"Devoluciones gratuitas durante 30 días","gl":"Devolucións gratuítas durante 30 días","en":"Free returns for 30 days"}',
    '{"es":"/es/ayuda/devoluciones","gl":"/gl/axuda/devolucions","en":"/en/help/returns"}',
    20
  ),
  (
    '{"es":"Outlet: hasta -50 % en cientos de referencias","gl":"Outlet: ata -50 % en centos de referencias","en":"Outlet: up to -50 % on hundreds of lines"}',
    '{"es":"/es/tienda/outlet","gl":"/gl/tenda/outlet","en":"/en/shop/outlet"}',
    30
  );

comment on table public.promo_messages is
  'Promo-bar messages. Public read of enabled rows only; admin-only writes. '
  'text and link are localised bundles; blank translations fall back to "es".';
