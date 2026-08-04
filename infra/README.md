# infra

Self-hosted Supabase infrastructure. Includes a Docker Compose stack with Caddy TLS termination,
Supabase CLI project, deployment scripts, and a GitHub Actions CI/CD pipeline.

## Contents

```
infra/
├── supabase/           # Supabase CLI project (config.toml, migrations, edge functions)
├── docker/
│   ├── .env.example    # Production Docker Compose environment variables template
│   └── ...             # Docker Compose stack, Caddy config, volume files
├── scripts/            # VPS setup, backup, update, and security check scripts
├── .github/            # CI/CD workflow — auto-deploys on push to main
├── .env.example        # Local dev environment variables template
└── package.json        # pnpm scripts wrapping Supabase CLI commands
```

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

### Prerequisites

- SSH access to the target VPS (Ubuntu 24.04)
- Supabase CLI installed locally

### Step 1 — Replace placeholders with your project values

All client-specific values use consistent placeholders across the codebase. Do a global search-and-replace before deploying:

| Placeholder | Replace with | Where |
|---|---|---|
| `your-org/your-repo` | Your GitHub org and repo (e.g. `acme/my-infra`) | `setup-vps.sh` |
| `your-github-username` | Your GitHub username (for ghcr.io login) | `setup-vps.sh` |
| `your-project` | Short slug for your project (e.g. `acme`) | `setup-vps.sh`, `backup.sh`, `update.sh`, `deploy.yml`, `docker/.env.example` |
| `/opt/your-project` | Server install path (e.g. `/opt/acme`) | `setup-vps.sh`, `backup.sh`, `update.sh`, `deploy.yml` |
| `/opt/your-project-data` | Server data directory (e.g. `/opt/acme-data`) | `setup-vps.sh`, `docker-compose.yml` |
| `your-domain.com` | Your app's public domain | `Caddyfile`, `docker/.env.example`, `supabase/config.toml` (redirect URL) |
| `api.your-domain.com` | Your API subdomain | `Caddyfile`, `docker/.env.example` |
| `your-org/your-app` | Container image path on ghcr.io (e.g. `acme/my-app`) | `docker-compose.yml`, `docker/.env.example` |
| `your-table` | A table name to use in the exposure security check | `scripts/check-exposure.sh` |
| `your-remote` | rclone remote name for backup uploads | `scripts/backup.sh` |
| `YOUR_LOGO_URL` | URL of your logo image for email templates | `docker/volumes/templates/*.html` |
| `Your Organization` | Your organization name in email footers | `docker/volumes/templates/*.html` |

> **Tip:** Most editors support project-wide find-and-replace. Running it in order (project slug first, then paths) avoids partial replacements.

### Step 2 — DNS records

Create two **A records** pointing to your VPS IP:

| Record | Value |
|---|---|
| `your-domain.com` | `<VPS_IP>` |
| `api.your-domain.com` | `<VPS_IP>` |

Wait for DNS to propagate before proceeding.

### Step 3 — Run the setup script on the VPS

Copy and run `setup-vps.sh` as root:

```bash
scp scripts/setup-vps.sh root@<VPS_IP>:/root/
ssh root@<VPS_IP>
bash /root/setup-vps.sh
```

The script will:

1. Install Docker, Supabase CLI, git, and rclone
2. Generate an ED25519 deploy key — it will **pause and print the public key**. At this point:
   - Add the key as a **read-only deploy key** in your GitHub repo: Settings → Deploy keys → Add deploy key
   - Press Enter to continue
3. Clone the repo to the install directory
4. Generate random secrets for `POSTGRES_PASSWORD`, `JWT_SECRET`, and other internal tokens — written directly to `docker/.env`
5. Ask for the public SSH key that **GitHub Actions** will use to SSH into the server:
   - Generate a dedicated key pair locally if you don't have one: `ssh-keygen -t ed25519 -f ~/.ssh/github-actions`
   - Paste the contents of `~/.ssh/github-actions.pub` when prompted
6. Print the GitHub Secrets you'll need to configure (see step 6)
7. Prompt for a GitHub PAT with `read:packages` scope if you're using a private container image for the frontend
8. Configure the nightly backup cron (03:00 daily)
9. Start the Docker stack

### Step 4 — Fill in `docker/.env` on the server

The setup script auto-generates most secrets but **`ANON_KEY` and `SERVICE_ROLE_KEY` must be derived from `JWT_SECRET`**.

On the server, run:

```bash
ENV_FILE="<INSTALL_DIR>/docker/.env"
JWT_SECRET=$(grep "^JWT_SECRET=" "${ENV_FILE}" | cut -d= -f2)

python3 - <<EOF
import json, base64, hmac, hashlib

secret = '${JWT_SECRET}'

def b64(d):
    return base64.urlsafe_b64encode(d).rstrip(b'=').decode()

header = b64(json.dumps({'alg': 'HS256', 'typ': 'JWT'}).encode())

for role in ('anon', 'service_role'):
    payload = b64(json.dumps({'role': role, 'iss': 'supabase', 'iat': 1700000000, 'exp': 2000000000}).encode())
    sig = b64(hmac.new(secret.encode(), f'{header}.{payload}'.encode(), hashlib.sha256).digest())
    key_name = 'ANON_KEY' if role == 'anon' else 'SERVICE_ROLE_KEY'
    print(f'{key_name}={header}.{payload}.{sig}')
EOF
```

Paste the printed values into `docker/.env`:

```bash
nano <INSTALL_DIR>/docker/.env
```

Also fill in:
- `SITE_URL` and `API_EXTERNAL_URL` — your public domain URLs
- `SMTP_*` — mail server credentials (required for auth emails and backup failure alerts)
- `FRONTEND_IMAGE` — your container image if using the bundled frontend service

### Step 5 — Configure rclone for backups

The backup script uploads dumps to object storage via rclone. Configure the remote on the server:

```bash
rclone config
```

Create a remote whose name matches `RCLONE_REMOTE` in `scripts/backup.sh` (default: `hetzner-obs`). For Hetzner Object Storage use the S3-compatible provider. Other providers (AWS S3, Backblaze, etc.) work the same way.

### Step 6 — Configure GitHub Secrets

In your repo: **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Value |
|---|---|
| `VPS_HOST` | VPS IP address (printed by setup script) |
| `VPS_USER` | `root` (or the user you ran setup as) |
| `VPS_SSH_KEY` | **Private** key matching the public key added in step 3 (contents of `~/.ssh/github-actions`) |
| `PROD_DB_PASSWORD` | Postgres password (printed by setup script) |

### Step 7 — Restart the stack and trigger the first deploy

Restart Docker on the server so it picks up the completed `.env`:

```bash
cd <INSTALL_DIR>/docker
docker compose up -d
```

Then push to `main` from your local machine to trigger the CI pipeline:

```bash
git push origin main
```

The workflow will SSH in, apply pending migrations, restart services, and prune old images.

---

## Accessing Studio in Production

Studio is not exposed to the internet. Access it via an SSH tunnel:

```bash
ssh -L 8080:localhost:3000 root@<VPS_IP>
```

Then open [http://localhost:8080](http://localhost:8080). Close the tunnel with `Ctrl+C`.

---

## Subsequent Deploys

- **Automatic:** any push to `main` triggers the GitHub Actions workflow — pulls latest code, applies migrations, restarts services, prunes old images.
- **Manual emergency deploy** (without waiting for CI):
  ```bash
  ssh root@<VPS_IP>
  bash <INSTALL_DIR>/scripts/update.sh
  ```

---

## Backups

`scripts/backup.sh` runs automatically every night at **03:00** via cron (configured by setup-vps.sh).

- Compressed `pg_dump` (format=custom, gzip level 9) with a UTC timestamp in the filename
- Uploaded to object storage via rclone
- **Local retention:** 7 days
- **Remote retention:** 30 days
- Email alert on failure (requires `SMTP_*` configured in `docker/.env`)
- Logs written to the path set in `LOG_FILE` inside `backup.sh`

**To restore a backup:**

```bash
gunzip -c /var/backups/db_YYYYMMDD_HHMMSS.dump.gz \
  | PGPASSWORD=<POSTGRES_PASSWORD> pg_restore \
      -h localhost -p 5432 -U postgres -d postgres --clean
```

---

## Security Notes

- **Postgres is never exposed to the internet** — port 5432 is localhost-only inside Docker.
- **Studio is never exposed to the internet** — access only via SSH tunnel.
- **RLS is enabled on every application table** — see `supabase/migrations/`. Reads are
  public but limited to published rows; every write requires `public.is_admin()`.
- **`profiles.is_admin` cannot be set by the account itself** — column-level privileges plus
  a trigger. Flip it as `postgres` (Studio or psql). The reasoning, including two bugs found
  and fixed while building it, is commented in `20260804120000_profiles_and_roles.sql`.
- **No service-role key reaches the client app** — `app/` only ever holds the publishable
  key, so Row Level Security has no bypass path.
- **No secrets live in the repo** — `docker/.env` is gitignored and generated on the server during setup.
- **Production data** lives in the data directory on the server (outside the repo), not tracked by git.
