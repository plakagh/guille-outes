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

> **A hydration error describing markup you do not recognise is a stale bundle.**
> Turbopack keeps its dev cache in `app/.next` across checkouts, so switching
> branches (or reloading a tab that is holding older chunks) can leave the browser
> running one revision of a component while the server renders another. React
> reports it as a genuine mismatch — the diff it prints is real, it is just two
> different versions of your own file. It surfaced once as a `product-card.tsx`
> diff whose "client" class list was the outer and inner `<div>` of the colour
> strip spliced into one, which is exactly how that component looked before the
> wall-view change. `pnpm dev:clean` deletes the cache and brings the stack back
> up; a hard reload finishes the job.

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

The account area has five tabs:

- **My details** — edit the display name. The email is shown read-only because it belongs to
  the auth service, and `full_name` is the *only* profile column the `authenticated` role is
  granted UPDATE on.
- **Wishlist** — persisted per account in `wishlist_items`. The heart on any product card or
  PDP writes straight to the database; signed-out visitors are sent to sign in and returned
  to the page they came from. The header heart carries a live count.
- **My drawings** — everything this account has published to the children's gallery,
  including what it has taken back down: hidden rows come back through the "read own"
  policy, so withdrawing a drawing never means losing sight of it.
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
| Entity slugs | `slug` JSONB column per row | `/es/producto/camiseta-archivo-94` · `/en/product/archive-94-tee` |

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
| Link clicked | `confirmed`, timestamp, **a discount code for that address** | the welcome email with the code, once |
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

### The welcome discount

The footer has promised *un 10 % en tu primer pedido* since the first build. It is
now true: confirming a subscription mints a discount code for that address alone
and the welcome email carries it.

**It is issued by the click, not by the form.** Minting on submission would hand
10 % to whoever typed an address into the footer — which is exactly what the double
opt-in exists to prevent, and it would turn the newsletter box into a way to farm
discounts. The click on the link in the inbox is the first moment the offer has an
owner, so that is when it is created ([welcome-code.ts](src/lib/newsletter/welcome-code.ts)).

**One use, and one owner.** The code is an ordinary row in `discount_codes` with
`max_redemptions = 1` and `issued_to_email` set. Neither limit is enforced in the
application: the redemption is counted from `discount_redemptions`, which only the
payment callback writes, and ownership is decided by `discount_lookup` against
`auth.users.email` — and only when `email_confirmed_at` is set, so an account that
has not proved it owns an address cannot claim a code issued to it. A forwarded
welcome email is therefore worth nothing to whoever receives it, and a refusal says
so in its own sentence rather than as *invalid*.

**Confirming twice does not mint twice.** A partial unique index on
`(campaign, issued_to_email)` is what guarantees it — one welcome code per address,
ever. Someone who unsubscribed and came back finds the code they already have, with
its window pushed out if it had lapsed in the meantime; someone who has already
*spent* it gets the welcome email without an offer in it, because they have had
their welcome discount.

**`CLUB10-XXXXXXXX`**, eight characters from an alphabet with no `I`, `L`, `O`, `U`,
`0` or `1` in it — about 40 bits, and nothing in it that gets misread off a phone
screen. The prefix is built from the percentage rather than typed, so changing the
offer cannot leave `CLUB10` codes worth 15 %. It lapses after 90 days: an unclaimed
code should not sit there for years, and a discount with a date on it is a discount
somebody uses.

**Not `first_order_only`, deliberately.** That limit counts paid orders on the
*account*, and most people subscribe from the footer long before they have one — so
it would refuse existing customers the very code we had just emailed them. Personal
and single-use is what stops the offer being farmed; who has bought before is not
what it turns on.

These codes are reported in `/{locale}/admin/newsletter`, next to the subscriber
they belong to and with whether the offer was taken up, and are **left out of**
`/{locale}/admin/discounts`: there is one per confirmed address, the shop wrote none
of them, and listing them would bury the campaigns it actually runs.

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

## Discount codes

The cart has had a "código promocional" box since the first build, and until now it
always answered *that code is not valid*. It works: `/{locale}/admin/discounts`
creates them, the box in the cart and at the checkout applies them, and the payment
callback is what counts them as spent.

**What a code can be.** A percentage (with an optional ceiling — "20 %, up to 15 €"),
a fixed amount, or free delivery. Scoped to the whole catalogue, to one collection or
to one category. With a minimum order, a start, an end, a total number of uses, a
number of uses per customer, first-order-only, and a switch to keep it from stacking
on top of the outlet. Every limit is optional, and blank means unlimited: a permanent
"students get 10 %" is expressed by leaving the boxes empty rather than by typing a
big number. **One code per order** — the `UNIQUE` on `discount_redemptions.order_id`
is what enforces it.

**A code can also belong to one person.** `issued_to_email` makes it personal, and
then holding the string is not enough to spend it: `discount_lookup` claims it only
for a signed-in caller whose *confirmed* account address matches, so a forwarded code
is worth nothing. The newsletter welcome discount is the first of these — see
[The welcome discount](#the-welcome-discount) — and the shop does not write them by
hand, which is why they are reported next to the subscriber rather than in the
discounts panel. An unlimited personal code is refused by a `CHECK`: the point of
issuing one per person is that it runs out.

**Nobody may read the codes.** `discount_codes` has no select policy for the
storefront at all — not for `anon`, not for a signed-in customer. A shop's live
campaigns are commercially sensitive, and a readable table is a listing endpoint for
anyone holding the public key. Instead there is one `SECURITY DEFINER` function,
`discount_lookup(text)`, which answers about **one exact string** and returns nothing
for a code that is unknown, misspelt or switched off. It cannot be used to search, to
enumerate, or to learn that a near-miss exists.

What it returns is the *rules*, plus the three counts only a privileged reader could
compute (uses in total, uses by the caller, whether the caller has ever paid). The
verdict is formed in [discounts.ts](src/lib/discounts.ts), because forming it needs
the basket — which products, at which prices, in which categories.

**One evaluator, three callers.** The cart, the checkout and `placeOrder` all run the
same `evaluateDiscount`, for the same reason `shipping.ts` and `tax.ts` are neutral
modules: if the figure on screen and the figure charged ever disagree, the shop has
either lied to a customer or undercharged itself.

**The code travels; the saving does not.** Only the string is posted at checkout, and
only the string is kept in `localStorage`. `placeOrder` looks the code up and applies
it again from scratch against the basket it is actually charging for — a tab left open
through the end of a campaign is refused at the till rather than honoured on a stale
quote, and a discount invented in the browser is not a discount. A code that has
stopped working **stops the order** rather than quietly charging full price: being
taken to the bank for more than the page said is the one outcome worse than being
told to try again.

**A code is spent when somebody pays with it.** `discount_redemptions` is written by
the Redsys callback, never at checkout, and `service_role` is the only role that may
insert. So an abandoned basket does not take the last slot on a limited campaign, and
"used 47 times" in the admin panel means forty-seven sales. The cost is a small race —
two shoppers can both be told a last-remaining code is valid — and the callback
resolves it by recording both: the limits were checked when the order was placed, the
card has since been charged, and telling the bank otherwise is not on the table.

**Waived delivery is a discount, not a free shipping line.** A free-delivery code
leaves `shipping_cents` at the quoted rate and puts the waived amount into
`discount_cents`, so the summary reads *Envío 4,95 € / Descuento −4,95 €*, the lines
add up to the total exactly, and the shop can see what a free-delivery campaign
actually cost. Zeroing the shipping line instead would make it look free to run.

**The order still has to be payable.** Redsys cannot process a zero charge and there
is no free-order path that skips the bank, so a code generous enough to clear the
basket is applied up to a 50-cent floor and no further (`MIN_PAYABLE_CENTS`). It bites
only in the pathological case — 100 % off with free collection — and the shopper is
always shown the figure that is really coming off.

**Refusals get their own sentence.** "You have already used this one", "that campaign
has ended", "spend 8 € more" and "no such code" send a shopper to very different
places; collapsing them into *invalid* is how a shop generates support mail. The
checks run code-first, basket-second, so nobody is told to spend more on a code that
had expired anyway.

Two columns carry it on the order: `discount_code` and `discount_cents`, snapshotted
like the address and the line prices. The order page, the confirmation email and the
account history read those, so a campaign that is later edited, paused or deleted
never rewrites what a customer was given.

---

## The outlet only exists when it exists

The outlet is not a section anyone switches on: it is whatever happens to be
discounted right now — `compare_at_cents` above `price_cents`, product by product.
So when nothing is discounted there is no outlet, and nothing on the site may claim
otherwise. `hasOutlet(products)` in [catalog.ts](src/lib/catalog.ts) is the single
answer, and everything that talks about an outlet asks it:

- the **hero slide** promising "hasta -50 %" is dropped, the same way a slide for a
  missing collection is
- the **outlet entry in the primary nav** goes, and with it the outlet links inside
  the "destacados" columns. The men's / women's / kids' ones are checked against
  *their own* products, because each of them lands on a listing already filtered by
  audience: no discounted women's product, no women's outlet link
- the **footer** loses its outlet link
- the **announcement bar** drops any message whose link points at the outlet
  listing, so nobody has to switch a promo off in the admin and remember to switch
  it back on
- the **home band** hides itself (it already did — it renders nothing with no
  products)
- the **empty cart** loses its "ver el outlet" button, and says a sentence that does
  not mention one
- the **listing itself** 404s. Every link that led there is already gone, and a page
  headed "Outlet hasta -50 %" over an empty grid is the worst version of the
  promise. The URL comes back on its own the moment something is discounted again.

None of this is a switch an administrator can get wrong: putting one product on sale
brings the whole outlet back, and taking the last one off retires it.

---

## The product video

A product may carry **one video and its own caption**, and most carry neither. With
no video there is no video zone on the product page — not an empty player, not a
heading with nothing under it. The caption disappears on the same terms: written, it
prints under the player; blank, the player stands alone.

Two nullable columns, `products.video_url` and `products.video_caption` (trilingual,
like everything else the shop types). It is an **address, not an upload**: the
`media` bucket takes images only and stops at 8 MB, so the video lives where it is
already published and the shop stores the link. `parseVideoUrl` recognises three
shapes and refuses everything else — the admin panel will not save an address it
cannot make sense of, which is why the storefront never has to render a player that
will not start:

| typed | played as |
| --- | --- |
| `youtube.com/watch?v=…`, `youtu.be/…`, `/shorts/…`, `/embed/…` | `youtube-nocookie.com` embed, `rel=0` |
| `vimeo.com/123456789`, `player.vimeo.com/video/123456789` | Vimeo player, `dnt=1` |
| any `https://…` ending in `.mp4`, `.webm`, `.ogv`, `.mov` | a plain `<video>` element |

`https` only. A video over `http` breaks a page served over `https`, and a
`javascript:` string in a `src` is not a video — the same reasoning the promo-bar
links get, enforced here *and* by a CHECK constraint on the column.

**A platform embed is not mounted until it is asked for.** The iframe appears on the
first click, not on page load: it keeps a third-party player and its cookies off a
page nobody has consented to be tracked on, and keeps the platform's JavaScript out
of a product page that draws its own artwork. A self-hosted file has no third party
to keep out, so it is a `<video>` with `preload="metadata"` — enough for the controls
and the duration, not enough to download the film.

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
finishes are offered, how wide the mount is, and how big each format actually is:

```json
{
  "enabled": true,
  "finishes": ["black", "white", "wood"],
  "mount": 10,
  "sizes": {
    "Pequeño": { "width": 30, "height": 40 },
    "Grande": { "width": 50, "height": 70 }
  },
  "width": 30,
  "height": 40
}
```

The centimetres are the **printed artwork**, mount and moulding excluded — the shop
types what is on the label and the storefront derives the outside dimensions from
the percentages it draws with.

**The measurements are per format, not per product.** A cuadro is sold as a
`Pequeño` and a `Grande` at two prices, and those are two different objects: the
framed view takes its proportions from whichever size button is pressed, and the
camera view hangs that one at that scale. `sizes` is keyed by the product's own
size names — the same strings `product_variants.size` uses, which is what lets the
size button, the price and the wall view agree without a second list to keep in
step. The loose `width` / `height` are the fallback: what a format nobody has
measured uses, and what a listing card shows before anything is chosen (the first
format, so the card and the camera open on the same thing).

`frameSizeFor(frame, size)` resolves one format — what the shop typed, then the
standard size that name means (`Pequeño` 30 × 40, `Grande` 50 × 70), then the
product's fallback pair. Never an average of the two, which is a size no cuadro is.
The size buttons on a cuadro's page print the centimetres under the format name for
the same reason: "Grande" is not a size, 50 × 70 cm is.

Per product, not per shop, because framing is a property of the piece: a numbered
serigraph may only be sold in black. Enabled with every finish removed is stored
and read as **off** rather than as a frame with no colour — a preview the shop did
not choose is worse than no preview.

**Cuadros open framed.** It is how the piece is meant to be seen and what the
shopper is judging, so it should not take a click to get there. Picking a gallery
thumbnail drops back out of it: a thumbnail is a picture of the *unframed*
rendering, so tapping one gives exactly that instead of quietly ignoring the
choice behind the glass. While framed, no thumbnail is marked current.

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

### "Ve cómo queda en tu casa" — the camera wall view

Every cuadro carries a second call to action: on the product page under the framing
controls, and on the tile of every cuadro card in the home rails and the listings.
It opens the camera full screen and hangs the piece on the shopper's own wall —
drag to move it, pinch to walk towards the wall, shutter to photograph it. Format,
finish and colourway can be changed without leaving the camera.
[wall-view.tsx](src/components/product/wall-view.tsx).

**The button is not offered where it cannot work.** `useWallViewSupport` checks the
secure context, `getUserMedia`, and whether `enumerateDevices` reports a
`videoinput` — no permission needed for that last one; before one is granted the
entries simply carry no labels. Both calls to action stay hidden until it says yes,
so a desktop without a webcam never gets a button that opens a panel explaining
itself. It resolves to false on the server and until the check returns, which means
the button appears a moment late on the devices that do have a camera — better than
flashing on every device that does not. An *empty* device list is read as "the
browser is withholding its inventory", not as "no camera", so a hardened browser
keeps the button rather than losing it. For the same reason the `cuadros` category
copy says nothing about the camera: that text is read on desktops.

The `unavailable` panel still exists, for the cases the check cannot see — a camera
that is present but busy, or that fails to open.

**Why not WebXR.** Anchoring to a real wall needs `immersive-ar` with hit testing,
which today means Android Chrome and nothing else — no iOS Safari, no desktop. Half
the shop's visitors would get a button that apologises. An overlay placed by hand
works wherever there is a camera, and answers the question actually being asked:
*is a 50 × 70 too big for that space?*

**Only sizes that exist are on offer.** The formats in the camera are the ones the
product is sold in, opened on the one the shopper selected on the product page (the
first, from a listing card) and switchable there — so comparing a 30 × 40 with a
50 × 70 on the same wall does not mean closing the camera in between. There is no
free size control: a slider from 20 to 200 cm would answer *would a picture fit*
rather than *would this one*.

**Scale is honest; distance is a guess.** The centimetres come from the format being
bought. No browser reports the camera's field of view, so the scale rests on one assumption
(65° horizontal) and on the distance the shopper states — which is why distance is a
control and not a readout, corrected by pinching until the room looks right. The
conversion works from the *scaled* video width rather than the viewport, because
`object-fit: cover` on a portrait phone throws away a third of a landscape sensor.

**The photograph is composed locally.** Nothing is uploaded: the frame is repainted
into a `<canvas>` over the video frame, and the artwork is the live SVG serialised
and rasterised, so the print, colourway and any future change to the drawing come
along for free. A canvas cannot read a CSS gradient, so the moulding is painted
twice — once by CSS, once in [wall-photo.ts](src/lib/wall-photo.ts) — from the one
`FRAME_PAINT` table, so the preview and its own photograph cannot drift apart.

`navigator.share` sends the file to the phone's share sheet where it exists, and
falls back to a download. The camera stream is released by unmounting: the dialog is
mounted only once asked for, which is what guarantees the recording light goes out.

---

## La galería de los peques (children's art gallery)

At the fairs the shop goes to, the people who stay longest at the stand are
children. This gives them somewhere to be: they photograph a drawing they
brought, or paint one on a tablet at the stand, sign it with their own name, and
it goes straight up on the site. From the drawing's own page, whoever is paying
can order it printed on a t-shirt.

Three routes: `/{locale}/galeria` · `galeria` · `gallery` is the wall,
`/{locale}/galeria/taller` · `obradoiro` · `studio` is the painting tool, and
`/{locale}/galeria/<slug>` is one drawing.

### The author is a child; the publisher is an adult

They are different people and they are different columns. `artworks.user_id` is
the grown-up who pressed publish and who answers for the consent;
`author_name` / `author_age` are the credit line.

**Painting needs no account. Publishing does.** That is the single decision the
rest of the design hangs off. A child at a stand should be drawing one tap after
arriving, and nobody is going to fill in a sign-up form to do that — but putting
a child's drawing and first name on a public, indexable page is not something an
anonymous tablet gets to do on its own. So the studio is open to everybody, and
the account is asked for at the moment the drawing would become public.

The drawing is kept in `localStorage` across that round trip, and `?next=` brings
the browser back to the studio. A child who loses their drawing to a login form
does not make a second one.

### Only a first name, and at most an age

"Martina, 7 años" gives credit and lets a child find their own drawing again. It
does not identify a particular child on a page Google will index. No surnames, no
school, no contact details; the publisher's email is stored as evidence of the
permission and is shown nowhere.

The check on the name is a **word count, not a ban on spaces**. Refusing spaces
would be the obvious rule and it would be wrong: "Ana María" and "José Luis" are
single first names here, and a form that rejects them insults the child it is
trying to credit. Three or more words is what gets refused — and refused, not
truncated, because silently publishing "Martina García López" as "Martina" would
be guessing at what a parent meant about their own child.

### The consent travels with the drawing

Not a boolean on the profile, and not a pointer at today's privacy notice. Each
row in `artworks` carries the **exact wording that was on screen**, the document
version and the locale, because Art. 7(1) puts the burden of proof on us and
today's policy does not show what somebody agreed to on the day. It is recorded
per drawing rather than once per account: consent to publish one drawing is not
consent to publish the next one.

`guardian_confirmed` is a column that can only ever be true — `not null`, a CHECK
with no false branch, and no default to fall through. A drawing published without
the box being ticked cannot exist as a row, and reading a `pg_dump` shows that
about every drawing in the table.

A matching row also goes into `user_consents` under a third kind, `gallery`,
which is the trail that survives the drawing being deleted. It is a separate kind
because consent must be specific and unbundled: agreeing to the conditions of
sale is not agreeing to this.

Withdrawal is one click on the drawing itself, and deletion is next to it —
Art. 7(3) says withdrawing has to be as easy as consenting was.

**The privacy notice covers this**, in its own section: that the gallery is
public and indexable, that painting stores nothing server-side while publishing
needs an adult's account, that under art. 7 LOPDGDD a child under fourteen
consents through whoever holds parental authority, exactly which four things get
published and which never do, how to withdraw, and the one carve-out — an image
kept to print a shirt somebody paid for is contract performance, not continued
publication. The processing table gained a row for it, and the terms of sale now
name a printed drawing among the art. 103(c) exceptions to the right of
withdrawal, since each one is made for that order. `LEGAL_VERSION` was bumped to
`2026-08-05`, so consents recorded before and after are distinguishable — which
is the whole reason that string exists.

### Published immediately, retired afterwards

There is no approval queue. A child who is told "it will appear in a few days"
has been told nothing, and the account requirement is a far higher bar than an
open upload box: every drawing has an identified adult behind it.

Moderation is therefore retirement after the fact, at `/{locale}/admin/gallery`.
Retiring sets `hidden_by_admin`, and the **owner's update policy refuses any row
where that is true** — without it, "hide" would be a button the moderated party
could press straight back. Deleting, on the other hand, stays available to the
family whatever the shop has done: erasure is not moderation.

Three states, and the admin counters keep them apart, because a family taking
their own drawing down is not a moderation event:

| | `status` | `hidden_by_admin` |
|---|---|---|
| On the wall | `published` | false |
| Taken down by the family | `hidden` | false |
| Withdrawn by the shop | `hidden` | true |

A hidden drawing is not merely absent from the grid — it is unreadable with the
anon key, the same rule the disabled promo messages get.

### The studio

A canvas, six tools (rotulador, lápiz, cera, spray, cubo, goma), four
thicknesses, the palette, and five papers. No third-party library: the shop draws
its own artwork everywhere else and this is no different.

**The palette is the classic one, and the ordering is the point.** Columns are
hues, rows are shades — light, full, dark — with a fourth row of neutrals that
carries the greys, the browns and the skin tones, because children draw tree
trunks, hair and their own faces. Finding "a darker green" means looking one row
down from the green you already found. The first version was twenty-four colours
in no particular order, which is fine for choosing *a* colour and useless for
choosing *the* colour. Swatches sit flush so it reads as one palette rather than
forty-odd buttons, the marker is drawn inside the chosen square in whichever of
black or white shows up on it, and the colour in hand is shown beside the
browser's own picker — a palette this size needs somewhere to answer "which one
am I painting with?" without hunting for the marked square.

A drawing is stored as **the list of things that were done to it**, never as a
bitmap ([paint.ts](src/lib/gallery/paint.ts)). That one decision pays for itself
three times:

- **Undo is exact and free.** It drops the last operation and replays the rest.
  The obvious alternative — a stack of `ImageData` snapshots — is 9 MB per step
  on a 1500² canvas, which is a tablet running out of memory mid-drawing.
- **The draft fits in `localStorage`.** A few hundred operations encode to
  kilobytes; a PNG data URL does not reliably fit. Points go out as a flat
  `[x, y, p, …]` array rounded to whole pixels — about a quarter of the bytes of
  the obvious `{x, y, p}` objects, since the keys outweigh the numbers.
- **Textured brushes stay put.** Crayon grain and spray mist are scattered
  randomly, so replaying them needs the *same* random numbers. Hence a seed per
  stroke and `mulberry32` rather than `Math.random()`, and hence
  `strokePainter` being **resumable**: one implementation of what a crayon looks
  like, called per pointer event while drawing and once per stroke on a redraw,
  so the live drawing and the redraw cannot disagree.

The fill tool is a scanline flood fill with a tolerance. The tolerance is not
optional: every brush draws anti-aliased edges, so an exact-match fill would stop
a pixel short everywhere and leave a halo around everything a child fills in.

Details that are about a six-year-old at a table, not about canvas APIs:

- **`touch-action: none`.** Without it the first stroke scrolls the drawing off
  the screen, and there is no recovering that with a finger.
- **Palm rejection.** Once a stylus has been seen, touches are ignored; children
  rest their whole hand on the glass.
- **Coalesced pointer events.** A stylus fires faster than the display refreshes
  and the browser hands back what it skipped — the difference between a curve and
  a polygon on a fast diagonal.
- **A tap is a dot.** Children make a lot of them, and a stroke with one point has
  no segment to draw.
- **"Empezar de nuevo" is undoable**, because history is snapshots of the
  operation *list* — cheap arrays of references. So it needs no confirmation
  dialog, which a six-year-old would dismiss anyway.
- **The draft is cleared when a drawing is published**, so the next child at the
  stand does not find the previous one's work on the sheet.

**Full screen is the sheet and the tools, and nothing else.** A button hands the
studio the whole viewport: the masthead, the nav, the breadcrumbs, the footer and
the page's own heading all go. Two mechanisms, and both are needed — a fixed
overlay does the actual work, because `requestFullscreen` on an element still is
not available on iPhone Safari, and the native call goes on top where it *is*
supported, because on a tablet the browser's address bar is a third of the
screen. So the overlay is the feature and native fullscreen is a bonus allowed to
fail silently.

The split follows how the device is **held**, not how wide it is: `landscape:`
puts the tools down the side, `portrait:` along the bottom where a thumb reaches.
A `lg:` breakpoint would get a tablet stood upright wrong. Leaving works through
all three doors — the button, Escape, and whatever gesture the browser offers —
because a `fullscreenchange` listener syncs the overlay back; without it, exiting
native fullscreen any other way would leave a fixed layer covering the site.

It is **one component tree for both modes**, and that is load-bearing rather than
tidy: a `<canvas>` keeps its bitmap in the element, so rendering a different tree
for full screen would unmount it and take the drawing along. Only the classes
change. Resizing the CSS box is safe on its own — the backing store is fixed at
`CANVAS_SIZE` and does not care how large it is drawn.

### Finishing with a drawing nobody published

"Terminar" is a separate act from "publicar", and it is the one that asks the
question. With something on the sheet that never went to the gallery, leaving
offers three answers, each labelled with what it costs:

| | |
|---|---|
| **Guardarlo para la próxima vez** | the draft stays in this browser — what it always did, and what a family on their own phone wants |
| **Espera, quiero publicarlo** | back to the studio with the publish form open |
| **Borrarlo** | gone from this device, and the label says it cannot be undone |

Keeping it is offered first, and deleting carries its warning on the label rather
than behind a second confirmation — the person reading it is the one who drew the
thing. The reason the question exists at all is the device this was built for: on
a stand, silently keeping the draft means the next child finds somebody else's
drawing on the sheet, and silently deleting it destroys the only copy. Neither is
ours to decide.

Closing the tab is closing too, and it is the one exit that cannot carry three
buttons: the platform allows only the browser's own "leave site?" prompt, in its
own words. A `beforeunload` guard arms it whenever there is an unpublished
drawing. Worth having even so — it is the difference between losing a drawing to
a stray gesture and being asked first.

The sheet is square: it tiles the wall evenly, it prints, and it means no
orientation to choose before drawing. The canvas is opaque — the eraser paints
paper rather than cutting holes, because "put the paper back" is what a child
means by rubbing something out.

### No SVG from the public

The `media` bucket allows `image/svg+xml` because the shop draws its own artwork.
An SVG uploaded by the *public* is a different animal: it is a script container,
and a public-read one served from our own origin is stored XSS the moment
somebody opens the file URL directly. The bucket configuration cannot say "except
in this folder", so the storage policy for `gallery/` refuses the extension and
the Server Action refuses the MIME type.

Uploads land in `gallery/<user_id>/<hash>.<ext>` — a path built on the server from
the session and a hash of the bytes, never from the uploaded filename, with the
folder enforced by the policy as well.

### The t-shirt

The call to action is on the **drawing**, not on the home page. Nobody arrives
wanting a shirt with a child's drawing on it; they arrive having just made a
drawing. So the home band invites you to draw, and the shirt is what the drawing
offers you once it exists.

Which garments can carry one is `products.artwork_printable`, ticked per product
in the admin editor — the print area, the process and the price are not the same
on a cap as on a tee. With none ticked there is no shirt section at all, the same
rule the video and the framed preview follow.

The mock-up is drawn by `ProductArt` itself, at the same `PRINT_ANCHOR` the
shop's own chest prints use, so the preview and the real print cannot drift apart
when somebody adjusts a garment drawing.

The cart line carries the artwork id, and `lineKey` includes it: the same tee in
the same size and colour with two different drawings is two things to make, and
without the id in the key one of them would never be printed. As everywhere else,
the browser sends choices and `placeOrder` re-reads the price *and the drawing*
from the database — a drawing that is not published takes the order down rather
than quietly printing a plain shirt.

**It cannot be exchanged or returned, and that is said before the sale.** A
printed drawing is made for one order and never goes back into the catalogue, so
it has no right of withdrawal (art. 103(c) RDL 1/2007) and the shop's voluntary
30-day returns policy does not reach it either — that policy rests on being able
to sell the garment to somebody else. The law wants this said *before* the
contract, not in a document nobody opens after paying, so it appears next to the
button that commits to it, and again on every line of the bag, the drawer and the
checkout summary. The warranty for a faulty or badly printed garment is untouched
and says so.

Legal documents carry the same term set apart from the prose around it. That is
what the `note` block in [pages.ts](src/lib/pages.ts) is for: "this one cannot be
returned" as the fourth paragraph of a page about returning things is a sentence
a reader skims past. It gets a frame and an accent rule instead, in the terms of
sale, in the returns article, and in the same visual language at the point of
sale — so a shopper can tell at a glance that this line's terms are not the
others'.

`order_items` keeps `artwork_id` as a soft reference plus a snapshot of the title
and the path. That is what lets a guardian delete a drawing without cancelling a
shirt somebody has paid for: the gallery row goes, and the image survives only
for as long as an order needs it. `artwork_in_use()` is `SECURITY DEFINER`
because "has this been ordered" is a question about rows the asker cannot see —
anybody may order a shirt with any published drawing.

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
  finishes, how wide the mount is, and the centimetres of **each size the product is
  sold in** (the scale the camera wall view hangs that format at) — one row per size,
  pre-filled with the standard paper size for its name, with a live preview
- **Video** — an optional address (YouTube, Vimeo or a hosted file) and an optional
  trilingual caption, saved with the rest of the product so a brand-new one can
  arrive with its video already on it. An address that cannot be played is refused
  rather than stored; removing the link removes the caption with it
- **Gallery** — the children's drawings, with the counts kept apart (published, taken
  down by the family, withdrawn by the shop) and the three moderation actions. A
  withdrawn drawing cannot be re-published by its owner
- **Discounts** — promotional codes: percentage, fixed amount or free delivery;
  scoped to everything, a collection or a category; with a minimum order, a window,
  a total and a per-customer ceiling, first-order-only, and a switch against stacking
  on the outlet. Each row shows what it has done — uses, customers, euros given away,
  last used — and can be paused in one click without losing that history. The codes
  issued to one person (the newsletter welcome discount) are left out: the shop wrote
  none of them, and they are reported next to the subscriber they belong to
- **Shop settings** — shipping rates, the free-delivery threshold, which services are
  offered, and the promo-bar messages
- **Newsletter** — subscriber counts and state, read-only, each row with the welcome
  code that address was issued and whether it has been used

Every mutation is a Server Action in [src/lib/admin/actions.ts](src/lib/admin/actions.ts),
with the shop-wide ones in [settings-actions.ts](src/lib/admin/settings-actions.ts),
[gallery-actions.ts](src/lib/admin/gallery-actions.ts) and
[discount-actions.ts](src/lib/admin/discount-actions.ts).

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
   reference, checks the amount matches, applies the status once, decrements
   stock, and — if the order carried a discount code — records the redemption
   that makes the code count as used.

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

**4. Two privileged code paths, and both are fenced in.**
The storefront, the account area and the admin panel all act as the visitor, and
everything they do is enforced by RLS. The first exception is the Redsys callback:
the caller is a bank, there is no user session to authorise against, and no policy
can express "trust this because the HMAC checked out" — verifying the HMAC needs a
secret Postgres cannot decrypt.

The second is `src/lib/db/notifications.ts`, which reads one admin-only column:
the address the shop is notified at when an order arrives. Both places that send
that notice — a shopper's checkout and the bank's callback — have no administrator
present, and the alternative would be a policy letting every signed-in customer
read the shop's internal mailbox. So it is a single-column, read-only query that
depends on nothing the caller sent.

So `src/lib/supabase/elevated.ts` holds a service-role client, fenced by:

- `import "server-only"`, so the build fails if it is ever pulled into a client
  bundle;
- a variable **without** the `NEXT_PUBLIC_` prefix, so Next never inlines it;
- two importers only — the callback route, which verifies the signature *before*
  touching it and whose status transition is idempotent, and the notice-address
  read above.

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
| Confirmation link clicked twice | confirmed once, one welcome email, one code |
| Unsubscribing and confirming again | same welcome code, never a second 10 % |
| Confirming again after the code was spent | welcome email with no offer in it |
| A welcome code typed by anyone but its owner | refused: `not_yours` |
| A welcome code used a second time by its owner | refused: `already_used` |
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
| Anonymous publishes a drawing to the gallery | 401 — `anon` has no insert policy |
| Publishing under another account's `user_id` | RLS violation |
| Publishing with the consent box defeated in the DOM | refused; nothing written |
| The owner rewrites a stored consent record | permission denied — the column is not granted |
| The owner repoints a published drawing at another image | permission denied |
| A stranger retitles somebody else's drawing | 0 rows |
| The owner marks their own drawing as shop-retired | refused |
| A drawing the family hid, read with the anon key | invisible; its own family still sees it |
| The owner re-publishes a drawing the shop retired | 0 rows |
| The family deletes a drawing the shop retired | allowed — erasure is not moderation |
| An adult uploads outside their own gallery folder | refused |
| An adult uploads into the shop's `products/` folder | refused |
| An SVG uploaded to the gallery folder | refused |

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
  endpoints; the app adds nothing). The gallery leans on the account requirement
  rather than on a rate limit; if one account ever floods the wall, a per-account
  ceiling on drawings per day is the missing piece.
- **An ordered drawing surviving its own deletion.** The columns and the
  `artwork_in_use()` guard are in place and the function was checked, but the full
  path — buy a shirt, delete the drawing, confirm the image is still there to
  print — needs a payment to run end to end, which needs a real terminal.
- **A discount code counted as used.** Everything up to the till is exercised — the
  lookup, the evaluator (22 tests), the refusals, the snapshot on the order — but the
  redemption row is written by the payment callback, so confirming that "used 1 / 100"
  ticks over needs a payment to run end to end, which needs a real terminal.
- **Reviews.** Ratings are seeded aggregates; the PDP shows the distribution but never
  invents review text. Wire a real provider before showing testimonials.
- **HTTPS for the camera.** `getUserMedia` only runs in a secure context. `localhost`
  counts, so the wall view works in development, but testing it from a phone on the
  LAN needs a tunnel or a certificate — otherwise it reports the camera as
  unavailable, correctly but confusingly.

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
│   ├── gallery/                 children's art: the wall, the studio, one drawing
│   ├── bibliography/           combined bibliography
│   ├── search/ cart/ help/ legal/ login/ account/
│   └── admin/                  guarded panel
├── components/
│   ├── brand/                  wordmark, monogram, generated product artwork
│   ├── layout/ home/ product/ catalog/ cart/ authors/ admin/ ui/
│   └── i18n/provider.tsx
└── lib/
    ├── catalog.ts              types, palette, filtering/sorting/facets (pure)
    ├── shipping.ts tax.ts discounts.ts
    │                           the three neutral pricing modules: what delivery
    │                           costs, how IVA splits, what a code takes off. No
    │                           "use client", no "server-only" — the browser and
    │                           the server must reach the same total
    ├── gallery/                 artwork rules, the paint model and its renderer
    ├── db/catalog.ts           Supabase reads, flattened per locale
    ├── db/admin.ts             raw localised bundles for the editor
    ├── db/discounts.ts         the one-code lookup, and the admin listing
    ├── orders/                  line parsing, placeOrder, the code-checking action
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
