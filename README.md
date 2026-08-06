# Guille Outes

Monorepo for the Guille Outes online shop: a self-hosted Supabase instance and a
trilingual Next.js storefront with an admin panel.

## Quick start

Everything comes up with one command from the repo root:

```bash
pnpm dev:all
```

It checks the prerequisites (pnpm, Supabase CLI, Docker), starts Supabase if it is not
already running, applies any pending migrations, seeds the catalogue if it is empty,
generates `app/.env.local` from the live instance, installs app dependencies if missing,
and then runs the dev server.

| Command | What it does |
|---|---|
| `pnpm dev:all` | Bring everything up (see above) |
| `pnpm dev:fresh` | Same, but wipes and re-seeds the database first (**drops all accounts**) |
| `pnpm dev:clean` | Same as `dev:all`, after deleting `app/.next` — the fix for a hydration error that names markup you no longer have |
| `pnpm dev` | App only, assuming Supabase is already up |
| `pnpm stop:all` | Stop the Supabase containers |
| `pnpm db:urls` | Print the local URLs and keys |
| `pnpm db:migrate` | Apply pending migrations to the local database |
| `pnpm db:reset` | Re-apply every migration and reload the seed (**drops all accounts**) |
| `pnpm db:seed` | Reload `seed.sql` only (keeps accounts) |
| `pnpm db:seed:generate` | Regenerate `seed.sql` from `infra/scripts/generate-seed.mjs` |
| `pnpm test` | Redsys protocol tests (cross-checked against OpenSSL) |
| `pnpm check` | Lint + tests + production build |

Extra flags are forwarded to `next dev`:

```bash
pnpm dev:all -- -p 3001
```

`pnpm dev:all` deliberately leaves Supabase running when you stop the app — the stack takes
~20 s to start, and restarting it on every Ctrl+C makes the edit loop slow.

Prerequisites: [pnpm](https://pnpm.io/installation), [Docker
Desktop](https://www.docker.com/products/docker-desktop/), and the [Supabase
CLI](https://supabase.com/docs/guides/cli/getting-started). `psql` is optional — without it
the script skips the seed check.

## Structure

```
.
├── infra/    # Self-hosted Supabase: schema, RLS, seed — see infra/README.md
├── app/      # Storefront + admin panel — see app/README.md
└── scripts/  # dev.sh — the one-command development environment
```

### `infra/`

Everything needed to run and operate a self-hosted Supabase instance: Docker Compose stack,
Caddy TLS termination, Supabase CLI project, deployment scripts, and GitHub Actions CI/CD.

→ See [infra/README.md](infra/README.md) for local development and deployment instructions.

### `app/`

The **Guille Outes** store: a trilingual (castellano / galego / English) Next.js 16
storefront with an admin panel for products, stock, images and author credits.

→ See [app/README.md](app/README.md) for how to run it, the i18n and SEO design, and the
security model.
