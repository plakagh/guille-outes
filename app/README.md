# Guille Outes — tienda

Trilingual (castellano / galego / English) storefront and admin panel for the Guille Outes
shop. Next.js 16 App Router, React 19, Tailwind 4, Supabase (self-hosted via `../infra`).

The visual system is modelled on the layout conventions of large sports-retail sites
(promo bar → masthead with search → mega nav → hero carousel → product shelves → dark
footer with newsletter). **No third-party assets are used**: the wordmark, the icon set,
the payment marks and all product imagery are drawn in-house as SVG in
[src/components/brand/](src/components/brand/) and [src/components/icons.tsx](src/components/icons.tsx).

---

## Quick start

From the **repo root**:

```bash
pnpm dev:all
```

That starts Supabase, applies migrations, seeds the catalogue if empty, writes
`app/.env.local` from the live instance, and runs the dev server on
<http://localhost:3000>. See the [root README](../README.md#quick-start) for the full
script list.

To run only the app against an already-running database:

```bash
pnpm install
pnpm dev
```

The seed (`infra/supabase/seed.sql`) contains 9 categories (including `cuadros`),
5 collections, 33 products, 399 stock variants, 5 authors and 9 bibliography entries —
all in three languages.

> **Local ports.** This project's local Supabase runs on **545xx** (API `54521`,
> DB `54522`, Studio `54523`, Mailpit inbox `54524`, Mailpit SMTP `54525`) because the
> template's default `543xx` range was already taken by another Supabase project on
> the development machine. See `infra/supabase/config.toml`.

> **Always go through `pnpm db:*`.** The Supabase project lives in `infra/`, and the
> root scripts pass `--workdir infra`. Running the CLI by hand from the repo root
> instead resolves the *linked remote* project — `supabase migration up --local` there
> reports a migration-history mismatch against production rather than touching your
> local database.

## Sessions: shoppers and administrators

There is **one account type**. What separates a shopper from an administrator is
`profiles.is_admin`, a column the account itself cannot change — so signing up can never
grant catalogue access.

### Shopper session

| Route | |
|---|---|
| `/{locale}/registro` · `rexistro` · `register` | Self-service sign-up (name, email, password) |
| `/{locale}/acceder` · `login` | Sign in |
| `/{locale}/cuenta` · `conta` · `account` | Account area, tabbed |

The account area has four tabs:

- **My details** — edit the display name. The email is shown read-only because it belongs to
  the auth service, and `full_name` is the *only* profile column the `authenticated` role is
  granted UPDATE on.
- **Wishlist** — persisted per account in `wishlist_items`. The heart on any product card or
  PDP writes straight to the database; signed-out visitors are sent to sign in and returned
  to the page they came from. The header heart carries a live count.
- **Orders** — the account's own orders from `orders` / `order_items`, each linking to its
  summary page with the payment state and the IVA breakdown.
- **Addresses** — `customer_addresses`, with one default enforced by a partial unique index.
  Intended to pre-fill checkout. No payment data is ever stored.

Both tables are **own-rows-only**: `using (user_id = auth.uid())` for reads and deletes, and
`with check (user_id = auth.uid())` so a crafted request cannot insert a row under someone
else's id. `user_id` always comes from the validated session, never from the form.

### Admin session

Same sign-in form. An administrator additionally sees an admin badge and a link to
`/{locale}/admin` on their account page. A shopper who navigates there directly gets a
refusal, not a redirect loop.

### Creating an administrator

`is_admin` is a column on `public.profiles` and is deliberately **not** writable by the
account itself. Create the user, then flip the flag as a trusted role:

```bash
# create the user (service-role key, from `supabase status`)
curl -X POST http://127.0.0.1:54521/auth/v1/admin/users \
  -H "apikey: $SUPABASE_SECRET" -H "Authorization: Bearer $SUPABASE_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"…","email_confirm":true}'

# grant admin
psql "postgresql://postgres:postgres@127.0.0.1:54522/postgres" \
  -c "update public.profiles set is_admin = true where email = 'you@example.com';"
```

Then sign in at `/es/acceder` and open `/es/admin`.

---

## Internationalisation

Three locales: `es` (default), `gl`, `en`.

**Detection.** [src/proxy.ts](src/proxy.ts) redirects an un-prefixed URL to the best match
from `Accept-Language`, and remembers the choice in a `go_locale` cookie. Every public URL
is locale-prefixed, which is what makes each language independently indexable.

**Two layers of localised URL:**

| Layer | Where it lives | Example |
|---|---|---|
| Route segments | [src/lib/i18n/routes.ts](src/lib/i18n/routes.ts) | `/es/tienda` · `/gl/tenda` · `/en/shop` |
| Entity slugs | `slug` JSONB column per row | `/es/producto/camiseta-hardwood-94` · `/en/product/hardwood-94-tee` |

Folder names under `src/app/[locale]/` are canonical English ids (`shop`, `product`, …);
the proxy rewrites the localised public path onto them, so routes stay statically typed
while the address bar keeps the indexable path.

**Canonicalisation.** A slug written in another language still resolves, then redirects to
the current locale's own slug — so a shared `/en/product/<spanish-slug>` link works and only
one URL per language ends up indexed. Every page emits `rel=canonical` plus
`hreflang` alternates for all three locales.

**Copy.** UI strings live in [src/lib/i18n/dictionaries/](src/lib/i18n/dictionaries/). `es.ts`
defines the shape and `gl.ts` / `en.ts` are typed against it, so a missing key is a compile
error rather than a blank string. Server Components call `getDictionary(locale)`; Client
Components read `useI18n()`.

**SEO keywords** are per-locale and per-entity: `keywords` JSONB on products, categories,
collections and authors, surfaced as `<meta name="keywords">` and fed into site search.
Help and legal articles carry their own.

---

## Authors and bibliography

Products are credited to one or more people.

- `authors` — name, role, bio, statement, photo, links, keywords (all localised)
- `author_works` — the bibliography: books, articles, zines, catalogues, talks, exhibitions
- `product_authors` — the join, with a per-product contribution label (`Ilustración`, …)

Surfaces: a credits block on every PDP linking to each author, `/es/autores` and
`/es/autores/<slug>`, a combined `/es/bibliografia`, an authors band on the home page, and
an **author facet** on listing pages. Credits are added and removed from the admin product
editor. Author pages emit `schema.org/Person` JSON-LD.

The seeded authors are **sample records** — replace them before launch.

---

## Size guides

The size guide belongs to the **product**, not to the shop. A size L jersey and a
size L tee are not the same garment, and the measurements that matter differ — a
tee has no inseam — so one shop-wide table per "fit" was the wrong shape for this.

`products.size_guide` holds only numbers, in centimetres:

```json
{ "dimensions": ["chest", "length"], "measurements": { "S": { "chest": 49, "length": 70 } } }
```

The dimension keys are labelled from the dictionaries, which is what keeps the
guide trilingual without asking whoever fills it in to translate "chest" three
times. `measurements` is keyed by that product's own size names, and the PDP only
renders rows for sizes it actually sells.

The PDP opens it in a native `<dialog>` — the browser handles the focus trap, the
backdrop and Escape — with the general "how to measure" advice still on the help
page, linked at the bottom.

**Nothing is ever left without a guide.** Until someone fills a product in, the
storefront falls back to a per-shape baseline in
[src/lib/catalog.ts](src/lib/catalog.ts): the dimensions that make sense for that
garment, graded outwards from the middle size. The admin grid is pre-filled from
the same baseline, so the numbers are corrected rather than typed from nothing.
Shapes where a table would be noise (a ball, a bottle, a poster) declare no
dimensions and show no trigger at all.

---

## Newsletter

Double opt-in, and not as a nicety. Under the RGPD consent must be a freely given,
specific, informed and unambiguous **affirmative act** (Art. 4(11)) and we carry
the burden of proving it (Art. 7(1)); under the LSSI-CE, commercial email needs
prior consent from the person who owns the address. Anyone can type someone else's
address into a footer, so a one-step signup proves nothing — the confirmation
click is what ties the consent to the mailbox.

| Stage | What is stored | What is sent |
|---|---|---|
| Form submitted | `pending`, hashed token, consent record | the confirmation request, nothing else |
| Link clicked | `confirmed`, timestamp | the welcome email, once |
| Unsubscribe clicked | `unsubscribed`, timestamp | nothing |

Details that matter:

- The consent box is **required and never pre-ticked**, enforced in the Server
  Action as well as the browser.
- The **exact wording that was on screen** is stored verbatim alongside the legal
  version, the timestamp and the caller's address. Pointing at today's privacy
  policy would not show what someone agreed to on the day.
- Only the **SHA-256 of the confirmation token** is stored; the token itself
  exists in one place, the email.
- The reply is deliberately uninformative — new, pending or already subscribed all
  get "check your inbox", so the form cannot be used to ask whether an address is
  on the list.
- Clicking the confirmation link twice is **not an error**. Mail clients and link
  scanners prefetch URLs, so the human often clicks second; telling a subscribed
  person "this link is not valid" would be alarming and false. `status` is what
  prevents a re-confirmation.
- Unsubscribing is one click, no login, on GET — mail clients cannot post forms.
  The token is long and random, it only ever *removes* someone, and it keeps
  working for old newsletters. Confirming tokens are cleared on unsubscribe so a
  stale link can never put someone back.
- `newsletter_events` is an **append-only history**, because a mutable row cannot
  answer "when was I unsubscribed?".

The list is not readable with the public anon key **at all**, and only an
administrator can read it as a logged-in user. `/{locale}/admin/newsletter` is
read-only on purpose: adding someone by hand would be a consent record we could
not back up, and deleting them would lose the withdrawal trail.

---

## IVA

Every price shown — product card, cart, the amount the bank charges — is
**tax-inclusive**. Spanish consumer law requires the price shown to a consumer to
be the final price, so there is no "+ VAT" anywhere; the total the customer sees
is the total they pay and the total that gets signed for Redsys.

The **split** appears wherever the sale is recorded — cart, checkout, order page
and the order emails — as base + rate under the total, never added on top of a
running subtotal. [src/lib/tax.ts](src/lib/tax.ts) rounds the base and takes the
tax as the remainder, so the two always add back up to the gross to the cent: an
invoice whose lines do not sum is not a valid invoice. A unit test asserts that
property for every amount from 1 cent to 200 €.

`orders.vat_rate` stores the rate **per order**. If the general rate ever moves, a
past order keeps reporting the tax actually charged — otherwise every historical
invoice silently changes, which is the one thing an invoice exists to prevent.

Shipping is inside the same base: transport charged as part of a sale takes the
rate of what is sold.

---

## Shop settings (admin-configurable)

Two things that used to be constants in the code, and therefore needed a deploy to
change, are now rows an administrator edits at `/{locale}/admin/settings`.

**Shipping.** `shipping_settings` is a single row — a `singleton` primary key fixed
to `true` makes a second one impossible, so no code has to decide which row is
real. It holds the free-delivery threshold, the three rates, and a switch per
optional service. Standard delivery has no switch: a checkout with no shipping
option is a dead end.

The rates are **public** (an anonymous visitor sees them at checkout before signing
in) so `anon` may read them; only an admin may write. They reach the browser as
props through `CartProvider`, and `placeOrder` re-reads the same row on the server —
so the total shown is the total charged, and a method the shop has switched off is
refused even if a stale tab still offers it.

**The promo bar.** `promo_messages` holds the rotating announcements, with the text
*and* the link localised per locale (blank translations fall back to Spanish, the
same rule the product editor uses). A message needs no link — an announcement with
nothing to click is a legitimate thing to want. Disabled messages are drafts: the
select policy is `using (enabled)`, so they are not merely hidden but unreadable
with the anon key.

Links are validated to a site-relative path or an absolute `http(s)` URL. A
`javascript:` string in an anchor the whole shop renders would be stored XSS, and
there is no reason for an admin to need one.

> The fourth message the bar shipped with — "personalise your shirt with a name and
> number" — was **not** carried over. The shop does not offer that, so it was
> promising something it could not deliver.

---

## Cuadros (framed prints)

A `cuadros` category, and a "see it framed" preview on those products.

The frame is **drawn in CSS** — no photographs, no image assets, the same rule the
product artwork follows. A frame is four bevelled edges, a mount and a sheet of
glass, and CSS does all four: the moulding is a gradient with a light outer edge
and a dark inner one (wood adds a repeating gradient for grain), the mount is white
padding with a hairline inner shadow, the bevel is a three-layer `box-shadow`, and
the glass is one faint diagonal highlight.

`products.frame_preview` decides per product whether the preview appears, which
finishes are offered, and how wide the mount is:

```json
{ "enabled": true, "finishes": ["black", "white", "wood"], "mount": 10 }
```

Per product, not per shop, because framing is a property of the piece: a numbered
serigraph may only be sold in black. Enabled with every finish removed is stored
and read as **off** rather than as a frame with no colour — a preview the shop did
not choose is worse than no preview.

Two details worth keeping:

- **The framed view uses a different rendering of the artwork.** The normal one is a
  poster lying on a surface, complete with its own white paper and a drop shadow.
  Inside a frame that reads as a frame around a *photo of a poster* — two mounts and
  a stray shadow behind the glass. `ProductArt` takes a `bare` prop that drops the
  sheet and the ground shadow and crops the viewBox to the printed area.
- **`box-shadow` takes lengths, not percentages.** A single percentage anywhere in
  the declaration invalidates the whole thing, silently dropping every layer —
  which is how the frame first shipped with no depth at all.

The price shown is for the print; the preview says so, because a simulated frame
next to a price is exactly the kind of thing a shopper would otherwise assume is
included.

---

## Admin panel

`/{locale}/admin`, gated on `profiles.is_admin`.

- **Overview** — product and stock counters, plus a low/out-of-stock worklist
- **Products** — search, publish/unpublish inline, per-row stock and credit summary
- **Product editor** — trilingual name / slug / description / keywords / details behind
  language tabs (one submit saves all three), price and sale price, category, collection,
  audience, silhouette, print, colourways, publish state, and a live preview of the
  generated artwork
- **Stock** — editable grid per size × colourway, add/remove variants; relative changes go
  through the `adjust_stock` database function so concurrent edits cannot lose one another
- **Size guide** — measurements for this product's own sizes: pick the dimensions
  that apply, correct the pre-filled numbers, save. Clearing every dimension sends
  the product back to the baseline for its shape
- **Credits** — add/remove authors with a localised contribution label
- **Images** — upload to Supabase Storage, delete; products fall back to the generated
  vector artwork when no photo exists
- **Framed view** — for cuadros: whether the piece is shown framed, in which
  finishes, and how wide the mount is, with a live preview
- **Shop settings** — shipping rates, the free-delivery threshold, which services are
  offered, and the promo-bar messages
- **Newsletter** — subscriber counts and state, read-only

Every mutation is a Server Action in [src/lib/admin/actions.ts](src/lib/admin/actions.ts).

---

## Payments (Redsys)

Redsys is the gateway the Spanish banks sit behind (BBVA, Santander, CaixaBank,
Sabadell…). The admin configures it at `/{locale}/admin/payments`: merchant code
(FUC), terminal, environment, merchant name and the signing key, plus the callback
URLs to paste into the bank's own panel and a **live self-check** that actually
produces a signature rather than just validating field formats.

### How a payment flows

1. Checkout posts the shopper's *choices* — never prices. `placeOrder` re-prices
   every line and the shipping from the database and writes the order. The amount
   we sign is therefore ours, not the browser's.
2. The order page opens a **payment attempt** and renders an auto-submitting form
   to `sis-t.redsys.es` (test) or `sis.redsys.es` (live), signed HMAC-SHA256 over a
   key diversified with that attempt's reference.
3. The shopper pays on the bank's page. We never see a card number.
4. Redsys calls `POST /api/payments/redsys/notify`. That is the **only** thing
   that can mark an order paid — the browser returning to a success URL proves
   nothing. The callback verifies the HMAC, resolves the attempt by its gateway
   reference, checks the amount matches, applies the status once, and decrements
   stock.

### Retries (recobros)

A declined card is not a lost order, so a payment may be attempted more than once.
`payment_settings.max_attempts` sets how many (1–5, default **3** — the first try
plus two recobros) and the admin edits it on the payments page.

Each attempt is a row in `payment_attempts` with **its own gateway reference**,
because Redsys refuses a repeated `Ds_Merchant_Order`. The reference the customer
sees — `orders.order_ref` — never changes; only the bank-facing one does.

Attempts are allocated by `start_payment_attempt`, a SECURITY DEFINER function that
checks ownership and the limit itself. Clients have no INSERT on the table, so a
customer cannot grant themselves an extra retry. It also hands back an attempt that
is still awaiting the bank, so reloading the page — or pressing back — does not
cost one.

> Watch the PL/pgSQL trap that broke this once: for a composite variable
> `rec is not null` means *every field is non-null*, not "a row was found". A
> pending attempt has null `response_code`/`auth_code`/`settled_at`, so the reuse
> branch never ran and every page load burned a retry. Test a column instead
> (`existing.id is not null`), or use `if found`.

After each decline the customer gets an email saying how many tries are left, with
a link that starts the next one. When they run out, the order is left unpaid and a
final "we could not confirm your payment" message goes out — **exactly once**,
guarded by claiming `orders.failure_notified_at` before sending, so a replayed
notification cannot double-send. If that send fails the claim is released, so a
later notification can try again.

### Transactional email

`src/lib/email/` sends the order confirmation, the retry notice and the failure
notice through SMTP (`SMTP_HOST` and friends; locally that is Mailpit, so nothing
leaves the machine). The bodies share the shell used by the Supabase auth
templates, and every message carries a plain-text alternative.

`sendMail` never throws: an order must not fail to settle because the mail server
is down. It reports whether the message went out and the callers act on that.

### Protocol notes

`src/lib/payments/redsys.ts` implements the scheme the banks' own `apiRedsys`
reference uses: the base64 merchant secret decodes to a 24-byte 3DES key, which is
*diversified per order* by encrypting the order reference with 3DES-CBC, a zero IV
and NUL padding; the signature is then HMAC-SHA256 over the base64 parameters.
Notifications are signed over the **raw received string** (re-encoding the parsed
JSON never matches) and may arrive in URL-safe base64.

`pnpm test` covers it, including two cross-checks against **OpenSSL** — an
independent implementation — because there is no way to test against a real
terminal without bank credentials.

### The merchant secret

Stored **encrypted** (AES-256-GCM) with a key that lives only in
`PAYMENTS_ENCRYPTION_KEY`, never in the database. The reason is concrete:
`infra/scripts/backup.sh` ships a nightly `pg_dump` to object storage, and a
plaintext bank credential in a table means a plaintext bank credential in every
backup. The admin UI is write-only — it shows whether a key is present, never the
key. Losing the env var means re-entering the secret, which is recoverable;
leaking the database alone gives an attacker nothing usable.

The gateway also cannot be *switched on* while incomplete: enabling it requires a
nine-digit FUC, a terminal and a readable signing key, so nobody can send shoppers
to a gateway that will reject them.

---

## Accounts, consent and the RGPD

Registration requires accepting the terms of sale and the privacy notice. The box
is **never pre-ticked** — consent has to be an affirmative act (Art. 4(11)) — and
the requirement is enforced server-side, not only in the browser. Marketing is a
**separate, optional** box, because consent must be unbundled and specific.

Every act of consent is a row in `user_consents`, recording the kind, whether it
was granted, the **document version** that was on screen and when. Withdrawal
appends a new row rather than editing the old one: an audit trail you can rewrite
is not an audit trail. There is no UPDATE or DELETE policy on the table, so this is
enforced by Postgres, not by convention.

Consent is written by the `handle_new_user` trigger, in the same transaction as
the account. The first attempt smuggled the choice through the confirmation link
and silently lost it — Supabase URL-encodes `emailRedirectTo`, so the extra
parameter ended up nested inside `next`. Doing it in the trigger also means it
works whether or not email confirmation is enabled, and needs no elevated key.

Customers can withdraw marketing consent in one click from **My account**, which
also shows when they accepted the terms, against which version, and the full
history. Access and erasure requests are spelled out there too.

Bump `LEGAL_VERSION` in `src/lib/legal/version.ts` whenever the documents change
materially; existing records keep their old version.

### Email confirmation

New accounts must confirm their address (`enable_confirmations = true`). Two things
this needed beyond flipping the flag:

- **An honest error.** Supabase returns `email_not_confirmed`, which the first
  implementation mapped to the generic "wrong email or password" — sending the
  customer looking for a typo that was not there. Sign-in now distinguishes it and
  offers to resend.
- **A confirmation route that works with SSR.** The default
  `{{ .ConfirmationURL }}` returns the session in the URL *fragment*, which never
  reaches the server, so it can never become a cookie session. The templates send
  a token hash to `/auth/confirm`, which verifies it and writes the same httpOnly
  cookies as a normal sign-in. Both the token-hash and PKCE `code` shapes are
  handled.

All five auth emails (confirmation, recovery, magic link, invite, email change) use
the store's identity — black masthead, red rule, the wordmark set in type so it
survives images being blocked. The order emails in `src/lib/email/templates.ts`
reuse the same shell, so the two paths look like one shop even though Supabase
sends one set from `infra/supabase/templates/` and the app sends the other.

Locally, Mailpit catches everything: it accepts SMTP on **54525** and its inbox is
on **54524** (`pnpm db:urls` prints the address). `pnpm dev:all` writes the matching
`SMTP_*` values into `.env.local`, so mail works out of the box and never leaves the
machine.

---

## Security model

The brief was explicitly *"sessions must not live on the server, and we must not be
hackable"*. The decisions that follow from that:

**1. Sessions live only in the browser's cookies, never on the server.**
There is no session table, no in-memory session map and no module-level cache of
credentials. [src/lib/supabase/server.ts](src/lib/supabase/server.ts) builds a fresh client
per request from that request's cookies, so one visitor's tokens can never be handed to
another.

**2. Auth cookies are `httpOnly`.**
Set in [src/proxy.ts](src/proxy.ts) with `httpOnly`, `sameSite=lax` and `secure` in
production. Consequence: **no browser Supabase client exists** — page JavaScript cannot
read a token, so an XSS bug cannot exfiltrate a session. All authenticated work happens in
Server Actions, which Next.js also protects against CSRF by checking `Origin` against
`Host`.

**3. `getUser()`, never `getSession()`.**
`getSession()` only decodes the cookie and will happily return a forged payload.
`getUser()` validates the JWT against the auth server. Every authorisation decision goes
through `getViewer()`, which calls `getUser()` and then reads `is_admin` **from the
database** — never from a cookie or a JWT claim the browser could set.

**4. Exactly one privileged code path, and it is fenced in.**
The storefront, the account area and the admin panel all act as the visitor, and
everything they do is enforced by RLS. The one exception is the Redsys callback:
the caller is a bank, there is no user session to authorise against, and no policy
can express "trust this because the HMAC checked out" — verifying the HMAC needs a
secret Postgres cannot decrypt.

So `src/lib/supabase/elevated.ts` holds a service-role client, fenced by:

- `import "server-only"`, so the build fails if it is ever pulled into a client
  bundle;
- a variable **without** the `NEXT_PUBLIC_` prefix, so Next never inlines it;
- one importer only — the callback route, which verifies the signature *before*
  touching it, and whose status transition is idempotent.

An earlier version of this document claimed there was no service-role key at all.
That was true until payments existed; this is the honest statement. If you want it
gone entirely, move the callback into a Supabase Edge Function — noted in the
module's comment.

**5. Postgres is the real authorisation layer.**
Every table has RLS enabled. Reads are public but scoped to `published` rows; **every**
write policy requires `public.is_admin()`. The admin check in the UI is a convenience — if
it were deleted tomorrow, the database would still refuse the write.

**6. Privilege escalation is blocked at two levels.**
`is_admin` is protected by column-level privileges (`authenticated` may `UPDATE` only
`full_name`) *and* by a trigger. Both layers were needed: the first attempt failed because
a table-level `GRANT UPDATE` silently re-granted the column a column-level `REVOKE` cannot
claw back, and because a `SECURITY DEFINER` trigger sees the function owner in
`current_user`, not the caller. See the comments in
`infra/supabase/migrations/20260804120000_profiles_and_roles.sql`.

**7. Untrusted input is never trusted.**
Query parameters are validated against the live catalogue and anything unknown is dropped
([src/lib/query.ts](src/lib/query.ts)). Uploaded files get a server-derived path
(`products/<id>/<content-hash>.<ext>`), never the client's filename, so a crafted name
cannot escape the folder the storage policy allows; MIME type and size are checked in the
action and again by the bucket. The `?next=` parameter on login only accepts same-origin,
locale-prefixed paths, so it cannot be used as an open redirect.

**8. Login failures are deliberately vague** — never "that address does not exist".

### Verified, not assumed

Checked against the running database, both through `psql` and through the public REST API
with real user tokens:

| Check | Result |
|---|---|
| Customer changes stock | RLS filters it out — 0 rows affected |
| Customer calls `adjust_stock` | `42501` permission error |
| Customer sets own `is_admin` | `permission denied for table profiles` |
| Customer updates own `full_name` | allowed |
| Admin sets stock | allowed |
| Anonymous reads an unpublished product | invisible |
| Anonymous opens `/admin` | blocked with an explanation |
| Signed-out visitor opens `/cuenta` | redirected to login with a safe `next` |
| Customer reads another customer's wishlist / consents | 0 rows |
| Customer inserts a row under another user_id | RLS violation |
| Customer edits a consent record | UPDATE affects 0 rows (append-only) |
| Sign-up without ticking the terms | refused; no account created |
| Forged payment notification | rejected, recorded, order untouched |
| Replayed payment notification | status and stock unchanged |
| Notification signed but with a different amount | treated as a mismatch, not a payment |
| Merchant secret in the admin page HTML | absent |
| Customer reads another customer's wishlist | 0 rows |
| Customer inserts a wishlist row under another user_id | RLS violation |
| Fresh sign-up → save item → reload → sign out | count appears, persists, then disappears |
| Fresh sign-up opens `/admin` | refused; no admin badge on their account |
| Customer inserts a `payment_attempts` row directly | RLS violation |
| Customer starts an attempt on someone else's order | `not your order` |
| Reloading the payment page twice | still one attempt — no retry burned |
| Three declines on a 3-attempt order | order left unpaid, stock untouched, no fourth attempt |
| The exhaustion notice, with the last notification replayed | sent exactly once |
| A decline followed by a successful retry | paid, stock decremented once, first attempt still `failed` |
| Anonymous (anon key) reads `newsletter_subscribers` | no access |
| Anonymous inserts a `confirmed` subscriber | rejected; nothing written |
| Newsletter signup with the consent box defeated in the DOM | refused; nothing stored, no email |
| A customer opens `/admin/newsletter` | refused; no addresses in the HTML |
| Confirmation link clicked twice | confirmed once, one welcome email |
| Unsubscribe link reused after unsubscribing | reports it, does not error |
| Bogus confirm/unsubscribe token | rejected in all three locales |
| Base + IVA against the total | adds up to the cent, in shop and email |
| Amount signed for the bank | the gross, never the taxable base |
| An order whose stored rate differs from today's | reports its own rate |
| Anonymous updates `shipping_settings` / `promo_messages` | rejected; rates unchanged |
| A customer opens `/admin/settings` | refused |
| Admin changes a rate → cart, checkout and the charged order | all three agree |
| A service switched off, then forced via an injected field | server refuses; no order created |
| A disabled promo message | not rendered, and unreadable with the anon key |
| `javascript:` in a promo link | refused; nothing stored |
| A cuadro vs a t-shirt | framed view offered / not offered |
| The rendered frame | CSS gradients and shadows; no image request |
| Framing enabled with no finish ticked | treated as off |

### Still to do before taking real money

- **A real terminal.** The gateway is implemented and self-tested, but it has never
  spoken to Redsys: that needs credentials from an acquiring bank, and a **publicly
  reachable** notification URL (the admin page says so when `NEXT_PUBLIC_SITE_URL`
  is localhost). Use a tunnel to test end to end before going live.
- **A production mail sender.** The transactional emails work and are verified
  against Mailpit, but no real SMTP provider is configured, and nothing has been
  done about SPF, DKIM or DMARC — without those, order confirmations land in spam.
- **Password reset.** The `recovery` template and `/auth/confirm?type=recovery`
  exist, but there is no "forgot my password" form yet.
- **Cookie consent banner.** The policy is written and no analytics or marketing
  cookies are loaded at all, so nothing is set without consent today — but the
  banner itself is not built.
- **Legal review.** The four documents under `/{locale}/legal/` are structured for
  the RGPD, LOPDGDD and LSSI-CE and carry the required sections, but they are a
  working basis with `[company details]` placeholders, and they say so. A lawyer
  has to sign them off.
- **Rate limiting** on the login and resend actions (Supabase rate-limits its own
  endpoints; the app adds nothing).
- **Reviews.** Ratings are seeded aggregates; the PDP shows the distribution but never
  invents review text. Wire a real provider before showing testimonials.

---

## Layout

```
src/
├── proxy.ts                    locale detection, localized→canonical rewrite, token refresh
├── app/[locale]/               every route, locale-prefixed
│   ├── layout.tsx              root layout: fonts, metadata, providers, chrome
│   ├── page.tsx                home
│   ├── shop/[section]/         categories, audiences, novedades/outlet/mas-vendido
│   ├── collection/[slug]/      collection listing
│   ├── product/[slug]/         PDP (+ Product JSON-LD)
│   ├── authors/[slug]/         author page (+ Person JSON-LD)
│   ├── bibliography/           combined bibliography
│   ├── search/ cart/ help/ legal/ login/ account/
│   └── admin/                  guarded panel
├── components/
│   ├── brand/                  wordmark, monogram, generated product artwork
│   ├── layout/ home/ product/ catalog/ cart/ authors/ admin/ ui/
│   └── i18n/provider.tsx
└── lib/
    ├── catalog.ts              types, palette, filtering/sorting/facets (pure)
    ├── db/catalog.ts           Supabase reads, flattened per locale
    ├── db/admin.ts             raw localised bundles for the editor
    ├── admin/actions.ts        admin Server Actions
    ├── auth/actions.ts         sign in / sign out
    ├── i18n/                   config, routes, sections, dictionaries
    ├── query.ts                search-param parsing and facet building
    └── pages.ts                help + legal content
```

### Data layer note

`getCatalog(locale)` fetches the published catalogue once per request (wrapped in React's
`cache()`) and filtering/sorting/faceting happen in memory. At this size (tens of products)
that is faster than a query per facet and keeps counts exact. When the catalogue outgrows a
single page of results, move it to SQL — `products.search_doc` (a trigram-free `tsvector`
covering all three languages) and the facet columns are already indexed for it.

---

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build` | Production build (runs `tsc`) |
| `pnpm start` | Serve the build |
| `pnpm lint` | ESLint |

Regenerate the seed after editing the catalogue content:

```bash
cd ../infra && node scripts/generate-seed.mjs && supabase db reset
```
