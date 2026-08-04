#!/usr/bin/env bash
# update.sh — emergency manual update
# The CI pipeline normally handles this automatically.
# Use only when you need to deploy without waiting for GitHub Actions.
set -euo pipefail

INSTALL_DIR="/opt/your-project"
ENV_FILE="${INSTALL_DIR}/docker/.env"

cd "${INSTALL_DIR}"

echo "→ Pulling latest changes..."
git pull origin main

echo "→ Applying migrations..."
POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" "${ENV_FILE}" | cut -d= -f2)
PGSSLMODE=disable supabase db push \
    --db-url "postgresql://postgres:${POSTGRES_PASSWORD}@127.0.0.1:5433/postgres"

echo "→ Pulling updated Docker images..."
cd "${INSTALL_DIR}/docker"
docker compose pull

echo "→ Restarting services..."
docker compose up -d

echo "→ Pruning old images..."
docker image prune -f

echo "✓ Update complete"
