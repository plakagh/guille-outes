#!/usr/bin/env bash
#
# Bring the whole development environment up with one command.
#
#   pnpm dev:all                 start Supabase (if needed), sync env, run the app
#   pnpm dev:all -- --fresh      also wipe and rebuild the database first
#   pnpm dev:all -- -p 3001      any extra flags are forwarded to `next dev`
#
# Supabase is deliberately left running when the app exits: starting the stack
# takes ~20 s and stopping it every time makes the edit loop slow. Use
# `pnpm stop:all` when you actually want the containers down.

set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INFRA="$ROOT/infra"
APP="$ROOT/app"
ENV_FILE="$APP/.env.local"

# ---------------------------------------------------------------- output ----

if [ -t 1 ]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; GREEN=$'\033[32m'
  YELLOW=$'\033[33m'; BLUE=$'\033[34m'; RESET=$'\033[0m'
else
  BOLD=""; DIM=""; RED=""; GREEN=""; YELLOW=""; BLUE=""; RESET=""
fi

step() { printf '%s\n%s▸ %s%s\n' "" "$BOLD$BLUE" "$*" "$RESET"; }
ok()   { printf '  %s✓%s %s\n' "$GREEN" "$RESET" "$*"; }
info() { printf '  %s%s%s\n' "$DIM" "$*" "$RESET"; }
warn() { printf '  %s!%s %s\n' "$YELLOW" "$RESET" "$*" >&2; }
die()  { printf '\n%s✗ %s%s\n' "$RED$BOLD" "$*" "$RESET" >&2; exit 1; }

# ------------------------------------------------------------------ args ----

FRESH=false
NEXT_ARGS=()

while [ $# -gt 0 ]; do
  case "$1" in
    --fresh) FRESH=true ;;
    --help|-h)
      # Print the header comment block, so help can never drift from the source.
      awk 'NR>2 { if ($0 !~ /^#/) exit; sub(/^# ?/, ""); print }' "${BASH_SOURCE[0]}"
      exit 0
      ;;
    *) NEXT_ARGS+=("$1") ;;
  esac
  shift
done

# -------------------------------------------------------------- preflight ---

step "Checking prerequisites"

command -v pnpm >/dev/null 2>&1 || die "pnpm not found. Install it: https://pnpm.io/installation"
command -v supabase >/dev/null 2>&1 ||
  die "Supabase CLI not found. Install it: brew install supabase/tap/supabase"

if ! docker info >/dev/null 2>&1; then
  die "Docker is not running. Start Docker Desktop and try again."
fi

ok "pnpm $(pnpm --version)"
ok "supabase $(supabase --version 2>/dev/null | head -1)"
ok "docker running"

HAVE_PSQL=true
command -v psql >/dev/null 2>&1 || { HAVE_PSQL=false; warn "psql not found — skipping the catalogue check"; }

# --------------------------------------------------------------- supabase ---

# `supabase status` exits non-zero when the stack is down. It exits 0 even with
# imgproxy/pooler stopped, which is this project's normal state.
supabase_running() { (cd "$INFRA" && supabase status >/dev/null 2>&1); }

if supabase_running; then
  step "Supabase already running"
  ok "reusing the running stack"
else
  step "Starting Supabase"
  info "first run pulls images — this can take a few minutes"
  (cd "$INFRA" && supabase start) || die "supabase start failed (see the output above)"
  ok "stack up"
fi

# Read the live connection details rather than hardcoding ports, so this keeps
# working if config.toml changes.
supabase_env() {
  (cd "$INFRA" && supabase status -o env 2>/dev/null) | grep -E '^[A-Z0-9_]+="' || true
}

env_value() {
  # $1 = key name, reads the captured env block on stdin
  sed -n "s/^$1=\"\(.*\)\"$/\1/p" | head -1
}

SB_ENV="$(supabase_env)"
API_URL="$(printf '%s\n' "$SB_ENV" | env_value API_URL)"
PUBLISHABLE_KEY="$(printf '%s\n' "$SB_ENV" | env_value PUBLISHABLE_KEY)"
DB_URL="$(printf '%s\n' "$SB_ENV" | env_value DB_URL)"
STUDIO_URL="$(printf '%s\n' "$SB_ENV" | env_value STUDIO_URL)"
MAILPIT_URL="$(printf '%s\n' "$SB_ENV" | env_value MAILPIT_URL)"
# Mailpit's SMTP listener, for the app's own transactional mail.
SMTP_PORT="$(sed -n 's/^smtp_port = \([0-9]*\)/\1/p' "$INFRA/supabase/config.toml" | head -1)"
SMTP_PORT="${SMTP_PORT:-54525}"
SERVICE_ROLE_KEY="$(printf '%s\n' "$SB_ENV" | env_value SECRET_KEY)"
if [ -z "$SERVICE_ROLE_KEY" ]; then
  SERVICE_ROLE_KEY="$(printf '%s\n' "$SB_ENV" | env_value SERVICE_ROLE_KEY)"
fi

# Older CLIs only emit the legacy ANON_KEY; either works as the public key.
if [ -z "$PUBLISHABLE_KEY" ]; then
  PUBLISHABLE_KEY="$(printf '%s\n' "$SB_ENV" | env_value ANON_KEY)"
fi

[ -n "$API_URL" ] || die "Could not read API_URL from \`supabase status\`."
[ -n "$PUBLISHABLE_KEY" ] || die "Could not read a publishable/anon key from \`supabase status\`."

# --------------------------------------------------------------- database ---

if [ "$FRESH" = true ]; then
  step "Resetting the database"
  warn "this drops everything, including any accounts you created"
  (cd "$INFRA" && supabase db reset) || die "supabase db reset failed"
  ok "migrations re-applied — the catalogue comes with them"
else
  step "Applying pending migrations"
  # `db push` targets the linked remote project; `migration up --local` is the
  # local equivalent. On a first `supabase start` there is nothing pending.
  if (cd "$INFRA" && supabase migration up --local >/tmp/go-migrate.log 2>&1); then
    if grep -qi "applying migration" /tmp/go-migrate.log; then
      grep -i "applying migration" /tmp/go-migrate.log | sed 's/^/  /'
      ok "migrations applied"
    else
      ok "schema up to date"
    fi
  else
    warn "could not apply migrations automatically:"
    sed 's/^/    /' /tmp/go-migrate.log >&2
    warn "run \`pnpm db:reset\` if the schema has drifted"
  fi

  if [ "$HAVE_PSQL" = true ] && [ -n "$DB_URL" ]; then
    COUNT="$(psql "$DB_URL" -Atc "select count(*) from public.products;" 2>/dev/null || echo "")"
    if [ -z "$COUNT" ]; then
      warn "could not read the catalogue — is the schema applied?"
    else
      ok "$COUNT products in the catalogue"
    fi
  fi
fi

# ------------------------------------------------------------------- env ----

step "Checking app environment"

if [ ! -f "$ENV_FILE" ]; then
  # A fresh 32-byte key for encrypting the Redsys merchant secret at rest.
  PAYMENTS_KEY="$(openssl rand -base64 32 2>/dev/null || true)"

  cat > "$ENV_FILE" <<EOF
# Generated by scripts/dev.sh from \`supabase status\`.
#
# NEXT_PUBLIC_* values reach the browser. Everything else stays on the server —
# never add a NEXT_PUBLIC_ prefix to a secret.

NEXT_PUBLIC_SUPABASE_URL=$API_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Server-only. Used by exactly one module (the Redsys callback, which has no user
# session because the caller is a bank) — see app/README.md, Security model.
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY

# Server-only. Encrypts the Redsys merchant secret before it is stored, so a
# database dump never contains a usable bank credential. Losing this means
# re-entering the merchant secret in the admin panel.
PAYMENTS_ENCRYPTION_KEY=$PAYMENTS_KEY

# Transactional email through Mailpit — nothing leaves this machine.
SMTP_HOST=127.0.0.1
SMTP_PORT=$SMTP_PORT
SMTP_ADMIN_EMAIL=pedidos@guilleoutes.com
SMTP_SENDER_NAME=Guille Outes
EOF
  ok "wrote app/.env.local"
  [ -n "$PAYMENTS_KEY" ] || warn "openssl not found — set PAYMENTS_ENCRYPTION_KEY by hand"
else
  # Never silently overwrite a hand-edited file — just flag a mismatch.
  CURRENT_URL="$(sed -n 's/^NEXT_PUBLIC_SUPABASE_URL=//p' "$ENV_FILE" | head -1)"
  CURRENT_KEY="$(sed -n 's/^NEXT_PUBLIC_SUPABASE_ANON_KEY=//p' "$ENV_FILE" | head -1)"

  if [ "$CURRENT_URL" != "$API_URL" ] || [ "$CURRENT_KEY" != "$PUBLISHABLE_KEY" ]; then
    warn "app/.env.local does not match the running Supabase instance:"
    [ "$CURRENT_URL" != "$API_URL" ] && warn "  URL — file: ${CURRENT_URL:-<unset>} · running: $API_URL"
    [ "$CURRENT_KEY" != "$PUBLISHABLE_KEY" ] && warn "  key — file: ${CURRENT_KEY:0:24}… · running: ${PUBLISHABLE_KEY:0:24}…"
    warn "delete app/.env.local and re-run to regenerate it"
  else
    ok "app/.env.local matches the running instance"
  fi
fi

# The service-role key is now required (the payment callback has no user session),
# but it must never be exposed to the browser. A NEXT_PUBLIC_ prefix on any
# secret is a hard stop.
if grep -qE '^\s*NEXT_PUBLIC_[A-Z_]*(SECRET|SERVICE_ROLE|PRIVATE|ENCRYPTION)' "$ENV_FILE" 2>/dev/null; then
  die "app/.env.local exposes a secret through a NEXT_PUBLIC_ variable. Remove the prefix."
fi

grep -qE '^\s*SUPABASE_SERVICE_ROLE_KEY=.' "$ENV_FILE" 2>/dev/null ||
  warn "SUPABASE_SERVICE_ROLE_KEY is unset — the Redsys callback cannot record payments"
grep -qE '^\s*PAYMENTS_ENCRYPTION_KEY=.' "$ENV_FILE" 2>/dev/null ||
  warn "PAYMENTS_ENCRYPTION_KEY is unset — the gateway secret cannot be stored (openssl rand -base64 32)"

# ----------------------------------------------------------------- media ----

# The catalogue rows arrive with the migrations, but the photographs cannot: SQL
# moves text. They are uploaded from `infra/media/`, which is committed, and the
# import is idempotent, so this is a no-op once everything is in the bucket.
if [ -d "$INFRA/media/products" ]; then
  step "Importing product images"
  if (cd "$INFRA" && node scripts/import-media.mjs >/tmp/go-media.log 2>&1); then
    tail -2 /tmp/go-media.log | sed 's/^/  /'
  else
    warn "image import failed — the shop will render without photographs:"
    sed 's/^/    /' /tmp/go-media.log >&2
  fi
fi

# ------------------------------------------------------------------ deps ----

if [ ! -d "$APP/node_modules" ]; then
  step "Installing app dependencies"
  (cd "$APP" && pnpm install) || die "pnpm install failed"
  ok "dependencies installed"
fi

# ------------------------------------------------------------------- run ----

printf '\n%s%s' "$BOLD" "Ready"
printf '%s\n' "$RESET"
printf '  %-10s %s\n' "App"     "http://localhost:3000"
printf '  %-10s %s\n' "Studio"  "${STUDIO_URL:-—}"
printf '  %-10s %s\n' "Mail"    "${MAILPIT_URL:-—}"
printf '  %-10s %s\n' "API"     "$API_URL"
printf '\n  %sCtrl+C stops the app; Supabase keeps running (pnpm stop:all).%s\n\n' "$DIM" "$RESET"

cd "$APP"
if [ ${#NEXT_ARGS[@]} -gt 0 ]; then
  exec pnpm dev "${NEXT_ARGS[@]}"
else
  exec pnpm dev
fi
