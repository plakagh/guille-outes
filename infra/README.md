# infra

Self-hosted Supabase infrastructure. A Docker Compose stack with Caddy TLS
termination, the Supabase CLI project, deployment scripts, and the server half of
the CI/CD pipeline (the workflow itself lives in `../.github/workflows/deploy.yml`).

## Contents

```
infra/
├── supabase/           # Supabase CLI project (config.toml, migrations, mail templates)
├── docker/
│   ├── .env.example    # Production Docker Compose environment template
│   ├── docker-compose.yml
│   ├── Caddyfile       # TLS + the only two public ports
│   └── volumes/        # Kong routes, db init SQL, mail templates
├── media/              # Product photographs, committed; imported on deploy
├── scripts/            # VPS setup, backup, update, media, security check
├── .env.example        # Local dev environment template
└── package.json        # pnpm scripts wrapping the Supabase CLI
```

## What runs in production

Twelve containers, not the sixteen the stock Supabase self-host compose file
starts. Four are deliberately absent, because the target is a 2 vCPU / 4 GB VPS
and between them they reserved roughly 1–1.4 GB to do nothing this shop needs:

| Dropped | Why |
|---|---|
| `analytics` (Logflare) | 400–700 MB of Elixir aggregating logs nobody reads. `docker compose logs` is enough at this size. |
| `vector` | Existed only to ship logs into `analytics`. |
| `supavisor` (pooler) | A second connection pool nothing dialled: every service talks to `db:5432` directly, and PostgREST keeps its own pool. |
| `functions` (edge runtime) | There are no edge functions in this project. Its `--main-service` directory was empty, so it crash-looped on restart forever. |

The remaining twelve idle at roughly 1.8–2.4 GB, and `setup-vps.sh` adds 2 GB of
swap for the spikes (the 03:00 dump overlapping with image resizing).

The storefront image is **built in GitHub Actions**, never on the server —
`next build` is the one step heavy enough to matter on two cores. See
[../app/Dockerfile](../app/Dockerfile).

### Why two `.env.example` files?

They serve completely different purposes and are used in different environments:

| File | Copied to | Used by | Contains |
|---|---|---|---|
| `infra/.env.example` | `infra/.env.local` | **pnpm scripts** on your local machine | `SUPABASE_DB_URL` (local DB for `pnpm seed`) and `PROD_DB_URL` (for `pnpm db:push:prod`) |
| `infra/docker/.env.example` | `infra/docker/.env` (on the **server**) | **Docker Compose** in production | Postgres password, JWT secret, Kong config, auth settings, SMTP, storage, frontend image, etc. |

`infra/.env.local` is never deployed — it only exists on your development machine.
`infra/docker/.env` is never committed — it is generated and lives only on the server.

Anon keys, API URLs, and other connection details needed by the **app** belong in `app/.env.local`, not here.

---

## Prerequisites

- [pnpm](https://pnpm.io/installation)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started) (`npm i -g supabase` or `brew install supabase/tap/supabase`)

---

## Local Development

> All commands in this section should be run from within the `infra/` directory.

### 1. Set the project ID

`supabase/config.toml` already sets this:

```toml
project_id = "guille-outes"
```

The Supabase CLI uses it to name the local Docker containers and network. It must be set
before the first `supabase start`.

### 2. Install dependencies

```bash
pnpm install
```

### 3. Set up environment

```bash
cp .env.example .env.local
```

Only fill in `PROD_DB_URL` if you need to push migrations to production (`pnpm db:push:prod`). Everything else is pre-filled.

### 4. Start the local Supabase stack

```bash
pnpm supabase:start
```

This starts a full local Supabase instance (PostgreSQL, Auth, Storage, Studio, etc.) using Docker.
On first run it pulls images — this takes a few minutes.

Once running, the CLI prints your local credentials:

```
API URL: http://localhost:54521
DB URL:  postgresql://postgres:postgres@localhost:54522/postgres
Studio:  http://localhost:54523
Publishable key: sb_publishable_...
Secret key:      sb_secret_...
```

> **Ports.** This project uses the **545xx** range, not the template's default 543xx/544xx,
> because another local Supabase project on the development machine already holds those.
> The full range lives in `supabase/config.toml`; local analytics ports were moved too.
> If you clone this onto a clean machine you can move them back.

Copy **only the publishable key** into `app/.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54521
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

> The **secret / service-role key must never reach `app/`**. It bypasses Row Level Security,
> which is the only thing protecting the catalogue. Use it from a terminal for
> administrative one-offs (e.g. creating the first user), and nowhere else.

### 5. Apply migrations

```bash
pnpm db:push
```

### 6. Open Studio

```bash
pnpm studio        # opens http://localhost:54523
```

Or navigate directly to [http://localhost:54523](http://localhost:54523).

### 7. Stop the stack

```bash
pnpm supabase:stop
```

---

## Migration Workflow

```bash
# Create a new migration file
pnpm db:new-migration your-migration-name
# → edit the generated SQL in supabase/migrations/

# Apply pending migrations to the local DB
pnpm db:push          # = supabase migration up --local

# Diff local schema against migrations (useful to check drift)
pnpm db:diff

# Reset local DB — re-applies all migrations + seed.sql from scratch
pnpm db:reset

# Push migrations to production
pnpm db:push:prod   # reads PROD_DB_URL from .env.local
```

---

## Available Commands

| Command | Description |
|---|---|
| `pnpm supabase:start` | Start local Supabase stack |
| `pnpm supabase:stop` | Stop local Supabase stack |
| `pnpm supabase:status` | Show status and local credentials |
| `pnpm db:push` | Apply pending migrations to the local DB (`migration up --local`) |
| `pnpm db:push:prod` | Apply pending migrations (production) |
| `pnpm db:reset` | Reset local DB and re-apply all migrations |
| `pnpm db:diff` | Diff local schema against migrations |
| `pnpm db:new-migration <name>` | Create a new migration file |
| `pnpm seed` | Load `supabase/seed.sql` into local DB |
| `pnpm studio` | Open Supabase Studio |
| `pnpm logs` | Stream Supabase logs |

---

## First Production Deploy

Everything below is already filled in for `plakagh/guille-outes` and
`guilleoutes.com` — there are no placeholders left to substitute. If the domain
is ever wrong, it appears in exactly four files: `docker/Caddyfile`,
`docker/.env.example`, `supabase/config.toml`, and the two GitHub secrets in
step 5.

### Prerequisites

- A VPS running **Ubuntu 24.04 LTS** (2 vCPU / 4 GB is enough — see "What runs in production")
- Root SSH access to it
- Control of the DNS for the domain

### Step 1 — DNS records

Two **A records**, both pointing at the VPS IP:

| Record | Value |
|---|---|
| `guilleoutes.com` | `<VPS_IP>` |
| `api.guilleoutes.com` | `<VPS_IP>` |

Do this **first and wait for propagation.** Caddy asks Let's Encrypt for
certificates the moment the stack starts, and that only works once the records
resolve.

### Step 2 — Generate the keys

Two pairs, both on your own machine, never on the server:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/guille-outes-admin   -N ''   # you
ssh-keygen -t ed25519 -f ~/.ssh/guille-outes-actions -N ''   # GitHub Actions
```

You paste the two **public** halves when the script asks. The Actions private half
becomes the `VPS_SSH_KEY` secret in step 5; your own private half stays put.

> If the VPS is currently reached **by password**, as a fresh one usually is, the
> admin pair is not optional — it is the only thing that will get you back in once
> passwords are turned off. The script refuses to continue without it, and it does
> not turn passwords off until you have proven the key works.
>
> If root already has an authorised key, the script offers it as the default
> instead and you can skip the first command.

### Step 3 — Run the setup script on the VPS

```bash
scp infra/scripts/setup-vps.sh root@<VPS_IP>:/root/
ssh root@<VPS_IP> 'bash /root/setup-vps.sh'
```

It is idempotent — safe to re-run if a step fails. Defaults are overridable:
`SSH_PORT=2222 ADMIN_USER=admin DEPLOY_USER=deploy`.

1. Install Docker, the Supabase CLI, git and rclone
2. Add 2 GB of swap and set `vm.swappiness=10`
3. Create the two accounts (see "Accounts and SSH" below) and install their keys
4. Generate an ED25519 deploy key in the deploy account's home and **pause**,
   printing the public key. Add it at
   [Settings → Deploy keys](https://github.com/plakagh/guille-outes/settings/keys)
   as **read-only**, then press Enter
5. Clone the repo to `/opt/guille-outes`, owned by the deploy account
6. Create `docker/.env` (mode 600) and generate every random secret in it
7. **Derive `ANON_KEY` and `SERVICE_ROLE_KEY`** from the generated `JWT_SECRET`.
   These are HS256 JWTs, not random strings — every service verifies them against
   that secret, so they cannot be invented
8. Enable UFW and start listening on the new SSH port. This phase only **adds** —
   port 22, root login and password authentication all keep working
9. **Pause and make you prove the new access works** from a second terminal. Only
   after you confirm does it disable root login, turn password authentication off
   and close port 22
10. Install the nightly backup cron (03:00)
11. Start the backing services — **without** the storefront, whose image does not
    exist until the first CI run
12. Print the GitHub secrets you need, including the derived anon key

> The pause in step 9 is the point of the whole design, and the split matters. The
> first phase takes nothing away: sshd is told to listen on **both** ports, and root
> and passwords stay enabled. So if your key or the new port turns out not to work,
> Ctrl+C leaves every way in exactly as it was.
>
> A `Port` directive *replaces* the default rather than adding to it, which is why
> the first phase lists `Port 22` explicitly — otherwise sshd would stop answering
> on 22 the moment it restarted, taking the fallback with it.
>
> Both phases validate with `sshd -t` before restarting and then check with `ss`
> that something really is listening; either failure rolls the file back.

### Step 4 — Fill in SMTP by hand

The only values the script cannot invent:

```bash
ssh -p 2222 admin@<VPS_IP>
sudo nano /opt/guille-outes/infra/docker/.env
```

Set `SMTP_HOST`, `SMTP_USER` and `SMTP_PASS`. They serve three purposes: GoTrue's
confirmation and recovery mail, the storefront's order confirmations, and the
alert `backup.sh` sends when a backup fails.

Then restart so the values take effect:

```bash
cd /opt/guille-outes/infra/docker && sudo -u deploy docker compose up -d
```

### Step 5 — Configure GitHub Secrets

**Settings → Secrets and variables → Actions → New repository secret.** The setup
script printed all seven:

| Secret | Value |
|---|---|
| `VPS_HOST` | The VPS IP |
| `VPS_PORT` | `2222` — required, since SSH no longer answers on 22 |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | The **private** key from step 2 (whole file, including the header line) |
| `NEXT_PUBLIC_SITE_URL` | `https://guilleoutes.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://api.guilleoutes.com` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The `ANON_KEY` the script derived |

The three `NEXT_PUBLIC_*` values are **build inputs, not runtime configuration.**
`next build` substitutes them into the bundles textually, so they have to be
present when the image is built and changing one means a rebuild. They are all
values the browser receives anyway, so none of them is secret — they live in
Secrets rather than Variables only to keep the setup in one place.

No registry credential is needed. The deploy job logs in to ghcr.io with the
workflow's own `GITHUB_TOKEN`, which expires when the run ends, so no long-lived
token sits on the server.

### Step 6 — Configure rclone for backups

On the server:

```bash
rclone config
```

Create a remote named **`hetzner-obs`** — the name `backup.sh` expects. For
Hetzner Object Storage pick the S3-compatible provider; AWS S3, Backblaze and the
rest work the same way. The bucket is `guille-outes-backups`.

### Step 7 — Trigger the first deploy

```bash
git push origin main
```

The workflow runs the Redsys tests and the linter, builds the storefront image and
pushes it to `ghcr.io/plakagh/guille-outes-app`, then SSHes in to pull it, apply
migrations, import the product photographs and start the storefront.

Watch it under the repo's **Actions** tab. When it goes green,
`https://guilleoutes.com` is live.

### Step 8 — Make yourself an administrator

Registering through the shop creates an ordinary account: `profiles.is_admin`
cannot be set by the account itself — column privileges plus a trigger see to
that. Flip it as `postgres`, over an SSH tunnel to Studio (see below) or directly:

```bash
ssh -p 2222 admin@<VPS_IP>
docker exec -it supabase-db psql -U postgres -c \
  "update public.profiles set is_admin = true where email = 'you@example.com';"
```

Then sign in and enter the Redsys credentials under the admin panel's payments
page. They are encrypted with `PAYMENTS_ENCRYPTION_KEY` before they touch the
database, which is why they are not part of `docker/.env`.

### Step 9 — Verify nothing is exposed

From your own machine, not the server:

```bash
bash infra/scripts/check-exposure.sh <VPS_IP> "<ANON_KEY>" guilleoutes.com
```

It checks that the catalogue is readable, that orders and payment settings are
not, and that Postgres, Kong and Studio are unreachable from outside.

## Accounts and SSH

Nothing logs in as root, and the two accounts that exist have deliberately
different powers:

| Account | Groups | Purpose |
|---|---|---|
| `admin` | `sudo`, `docker` | You, doing maintenance. Passwordless sudo, because a key-only account has no password to type. |
| `deploy` | `docker` | GitHub Actions. **No sudo at all.** |

The deploy account needs no privileges because of how the work is arranged: it
owns `/opt/guille-outes` (so `git pull` and the `FRONTEND_IMAGE` rewrite work) and
it is in the `docker` group (so compose works). That is the entire requirement.
Anything that escapes the deploy pipeline therefore escapes into an unprivileged
account rather than into root.

SSH itself: **key-only** (`PasswordAuthentication no`), **no root login**, on
**port 2222**, and `AllowUsers` limited to those two accounts. The port change is
not a security boundary — key-only auth is — but it keeps the constant background
brute-forcing out of the logs, which is what makes a real attempt visible.

```bash
ssh -i ~/.ssh/guille-outes-admin -p 2222 admin@<VPS_IP>
```

The whole configuration lives in one file,
`/etc/ssh/sshd_config.d/99-guille-outes.conf`, which `setup-vps.sh` rewrites on
every run. Two things about it are easy to get wrong and worth knowing:

> On Ubuntu 23.04 and later, sshd is started through socket activation, and under
> it the `Port` directive in `sshd_config` is **ignored** — the socket unit decides.
> `setup-vps.sh` disables `ssh.socket` and enables `ssh.service` so that one config
> file is the single source of truth.

> A `Port` directive **replaces** the default port rather than adding to it. During
> the transition the file therefore lists `Port 22` alongside the new one, and only
> drops it once key-based login has been proven.

## Accessing Studio in Production

Studio is not exposed to the internet — it is bound to `127.0.0.1:3000` and Caddy
routes nothing to it. Reach it through an SSH tunnel:

```bash
ssh -p 2222 -L 8080:localhost:3000 admin@<VPS_IP>
```

Then open [http://localhost:8080](http://localhost:8080). Close the tunnel with `Ctrl+C`.

---

## Subsequent Deploys

**Automatic.** Any push to `main` runs the workflow: tests and lint, then build and
push the image, then over SSH — pull the code, start the backing services, apply
migrations, import any new photographs, and finally restart the storefront. The
storefront restarts *last*, on purpose, so a new build never meets an old schema.

**Rollback.** Every build is tagged with its commit SHA, so going back is one edit:

```bash
ssh -p 2222 admin@<VPS_IP>
sudo nano /opt/guille-outes/infra/docker/.env   # FRONTEND_IMAGE=ghcr.io/plakagh/guille-outes-app:<sha>
cd /opt/guille-outes/infra/docker && sudo -u deploy docker compose --profile frontend up -d
```

Migrations do not roll back with it. If the bad deploy carried one, write a new
migration that reverses it.

**Manual emergency deploy**, when you need a migration or a compose change without
waiting for a workflow run:

```bash
ssh -p 2222 admin@<VPS_IP>
bash /opt/guille-outes/infra/scripts/update.sh
```

It re-executes itself as the `deploy` account, so it never leaves root-owned files
for the next `git pull` to trip over. It also deliberately does not fetch a new
storefront image — building and publishing that is CI's job — so it never needs
registry credentials.

> **`--profile frontend`.** The storefront is behind a compose profile, so that the
> very first `docker compose up -d` works before its image exists. The consequence:
> a bare `docker compose up -d` starts everything *except* the shop. It will not
> stop an already-running one, but it will not start a stopped one either. Any
> command meant to bring the shop up needs `--profile frontend`.

---

## Backups

`scripts/backup.sh` runs nightly at **03:00** from `/etc/crontab`.

Two things are backed up, because losing either loses the shop:

- **The database** — a `pg_dump` in custom format, compression level 9, taken
  inside the `supabase-db` container so the dump is written by exactly the server
  version that holds the data. Uploaded to `hetzner-obs:guille-outes-backups/db/`.
- **The storage bucket** — `/opt/guille-outes-data/storage`, uploaded to
  `…/storage/`. Product photographs could be rebuilt from git, since `media/` is
  committed, but artwork uploaded through the admin panel exists nowhere else.

Retention is 7 days locally and 30 days remotely **for the dumps only** — storage
objects are never deleted remotely, being the sole copy of anything uploaded. A
failed backup sends mail to `SMTP_ADMIN_EMAIL`, and an empty dump counts as a
failure rather than passing quietly.

**To restore the database:**

```bash
ssh -p 2222 admin@<VPS_IP>
rclone copy hetzner-obs:guille-outes-backups/db/db_YYYYMMDD_HHMMSS.dump /tmp/
docker cp /tmp/db_YYYYMMDD_HHMMSS.dump supabase-db:/tmp/restore.dump
docker exec -e PGPASSWORD=<POSTGRES_PASSWORD> -it supabase-db \
  pg_restore -U postgres -h localhost -d postgres --clean /tmp/restore.dump
```

**To restore storage files**, `rclone copy` them back into
`/opt/guille-outes-data/storage` — the storage API reads the filesystem directly,
so no re-import is needed, though the matching `product_images` rows have to be in
the database for the shop to reference them.

---

## Security Notes

- **Only ports 2222, 80 and 443 are open.** UFW enforces it; every internal service
  is additionally bound to `127.0.0.1` in `docker-compose.yml`, so the firewall is
  the second lock, not the first.
- **No root SSH, no passwords, and two accounts with different powers** — see
  "Accounts and SSH". The account CI logs in as has no sudo.
- **Postgres is never exposed to the internet** — published on `127.0.0.1:5433`.
- **Studio is never exposed to the internet** — SSH tunnel only, and Caddy routes
  nothing to it.
- **Caddy routes only four API paths** — `/rest`, `/auth`, `/storage`, `/realtime`.
  Anything else on `api.guilleoutes.com` has no route at all, so a missing Kong ACL
  cannot become an exposed endpoint.
- **RLS is enabled on every application table** — see `supabase/migrations/`. Reads are
  public but limited to published rows; every write requires `public.is_admin()`.
- **`profiles.is_admin` cannot be set by the account itself** — column-level privileges plus
  a trigger. Flip it as `postgres` (Studio or psql). The reasoning, including two bugs found
  and fixed while building it, is commented in `20260804120000_profiles_and_roles.sql`.
- **The service-role key never reaches a browser.** It is set on the frontend
  *container*, and exactly one server-side module reads it: the Redsys callback,
  which arrives from the bank with no session and must mark an order paid.
  `import "server-only"` makes the build fail if that module is ever pulled into a
  Client Component, and the variable has no `NEXT_PUBLIC_` prefix, so Next.js will
  not inline it. See [../app/src/lib/supabase/elevated.ts](../app/src/lib/supabase/elevated.ts).
- **The Redsys merchant secret is encrypted at rest** with `PAYMENTS_ENCRYPTION_KEY`,
  which lives only in `docker/.env`. A leaked database dump therefore contains no
  usable bank credential — the reason the key is not stored alongside it.
- **No secrets live in the repo** — `docker/.env` is gitignored and generated on the server during setup.
- **Production data** lives in `/opt/guille-outes-data`, outside the repo and untracked.
