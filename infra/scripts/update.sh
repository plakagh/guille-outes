#!/usr/bin/env bash
# update.sh — emergency manual deploy
#
# CI normally does all of this (.github/workflows/deploy.yml). Reach for this only
# when you need to apply a migration or a compose change without waiting for a
# workflow run.
#
# It deliberately does NOT pull a new storefront image. Building and publishing
# that is CI's job; here the frontend is restarted on whatever image docker/.env
# currently pins, so this script never needs registry credentials.
set -euo pipefail

INSTALL_DIR="/opt/guille-outes"
COMPOSE_DIR="${INSTALL_DIR}/infra/docker"
ENV_FILE="${COMPOSE_DIR}/.env"
DEPLOY_USER="${DEPLOY_USER:-deploy}"

# Run as the deploy account, which owns the tree and is in the docker group.
# Doing this as root would leave root-owned files behind for the next `git pull`
# to trip over.
if [ "$(id -un)" != "${DEPLOY_USER}" ]; then
    echo "→ Re-running as ${DEPLOY_USER}..."
    exec sudo -u "${DEPLOY_USER}" "$0" "$@"
fi

cd "${INSTALL_DIR}"

echo "→ Pulling latest changes..."
git pull --ff-only origin main

echo "→ Pulling updated backing-service images..."
cd "${COMPOSE_DIR}"
docker compose pull

echo "→ Starting backing services..."
docker compose up -d

# Kong's routes are a bind-mounted file, and compose compares container
# configuration rather than mounted file contents, so the line above leaves the
# gateway running with whatever routing table it started with. Without this, an
# edit to volumes/api/kong.yml deploys cleanly and does nothing.
echo "→ Recreating the API gateway so route changes take effect..."
docker compose up -d --force-recreate --no-deps kong

echo "→ Waiting for the database..."
for _ in $(seq 1 60); do
    if docker exec supabase-db pg_isready -U postgres -h localhost -q; then break; fi
    sleep 2
done
docker exec supabase-db pg_isready -U postgres -h localhost -q

echo "→ Applying migrations..."
POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" "${ENV_FILE}" | cut -d= -f2-)
PGSSLMODE=disable supabase --workdir "${INSTALL_DIR}/infra" db push --yes \
    --db-url "postgresql://postgres:${POSTGRES_PASSWORD}@127.0.0.1:5433/postgres"

echo "→ Restarting the storefront..."
# --profile frontend is required: the service is profiled so that the very first
# server setup can start the stack before the image exists.
docker compose --profile frontend up -d --remove-orphans

echo "→ Pruning old images..."
docker image prune -f

echo "✓ Update complete"
