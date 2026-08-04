-- The VAT rate that applied to each order.
--
-- `amount_cents` is, and stays, what the customer pays: prices in this shop are
-- tax-inclusive because Spanish consumer law requires the price shown to be the
-- final price. The base and the tax are derived from it.
--
-- The rate is stored rather than assumed. If the general rate ever moves, an
-- order placed today must keep reporting the tax that was actually charged —
-- otherwise every past invoice silently changes, which is exactly what an
-- invoice is supposed to prevent.

alter table public.orders
  add column if not exists vat_rate numeric(5, 4) not null default 0.2100
  check (vat_rate >= 0 and vat_rate < 1);

comment on column public.orders.vat_rate is
  'VAT rate applied to this order, as a fraction. amount_cents is tax-inclusive; '
  'base and tax are derived from it so they always add back up to the cent.';
