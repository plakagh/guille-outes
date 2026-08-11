#!/usr/bin/env bash
# backup.sh — nightly backup to object storage. Runs from /etc/crontab at 03:00.
#
# Two things are backed up, because losing either loses the shop:
#
#   1. The database — orders, accounts, the catalogue, the encrypted Redsys
#      credential. A custom-format pg_dump.
#   2. The storage bucket — /opt/guille-outes-data/storage. Product photographs
#      can be rebuilt from git (infra/media/ is committed) but artwork uploaded
#      through the admin panel cannot: those files exist nowhere else.
set -euo pipefail

INSTALL_DIR="/opt/guille-outes"
DATA_DIR="/opt/guille-outes-data"
PROJECT_NAME="guille-outes"
BACKUP_DIR="/var/backups/guille-outes"
LOG_FILE="/var/log/guille-outes-backup.log"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/db_${DATE}.dump"
RCLONE_REMOTE="hetzner-obs:guille-outes-backups"
RETENTION_LOCAL_DAYS=7
RETENTION_REMOTE_DAYS=30

ENV_FILE="${INSTALL_DIR}/infra/docker/.env"

# Read one value at a time rather than sourcing the file. Sourcing is fragile
# here: a value containing a space (SMTP_SENDER_NAME) is silently truncated at
# the space, and an unquoted one makes bash try to run the remainder as a
# command. Compose's own parser is not bash's, so the file is not shell code.
env_value() {
    [ -f "${ENV_FILE}" ] || return 0
    # The `|| true` matters: this script runs under `set -o pipefail`, so a grep
    # that matches nothing would otherwise abort the whole backup.
    { grep -E "^${1}=" "${ENV_FILE}" || true; } | head -1 | cut -d= -f2- | sed 's/^"\(.*\)"$/\1/'
}

POSTGRES_PASSWORD=$(env_value POSTGRES_PASSWORD)
SMTP_HOST=$(env_value SMTP_HOST)
SMTP_PORT=$(env_value SMTP_PORT)
SMTP_USER=$(env_value SMTP_USER)
SMTP_PASS=$(env_value SMTP_PASS)
SMTP_ADMIN_EMAIL=$(env_value SMTP_ADMIN_EMAIL)
SMTP_SENDER_NAME=$(env_value SMTP_SENDER_NAME)

send_alert() {
    local subject="$1"
    local body="$2"
    if [ -n "${SMTP_HOST:-}" ] && [ -n "${SMTP_USER:-}" ] && [ -n "${SMTP_PASS:-}" ]; then
        curl -fsSL --ssl-reqd \
            --url "smtp://${SMTP_HOST}:${SMTP_PORT:-587}" \
            --user "${SMTP_USER}:${SMTP_PASS}" \
            --mail-from "${SMTP_ADMIN_EMAIL:-pedidos@guilleoutes.com}" \
            --mail-rcpt "${SMTP_ADMIN_EMAIL:-pedidos@guilleoutes.com}" \
            --upload-file - <<EOF || true
From: ${SMTP_SENDER_NAME:-Guille Outes Backup} <${SMTP_ADMIN_EMAIL:-pedidos@guilleoutes.com}>
To: ${SMTP_ADMIN_EMAIL:-pedidos@guilleoutes.com}
Subject: [${PROJECT_NAME}] ${subject}

${body}
EOF
    fi
}

fail() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" | tee -a "${LOG_FILE}"
    send_alert "Backup ERROR ${DATE}" "$*"
    exit 1
}

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_FILE}"
}

# ── 1. pg_dump ────────────────────────────────────────────────────
# Run inside the db container: it guarantees the dump is taken by exactly the
# server version that wrote the data, and saves installing postgresql-client on
# the host. --compress=9 is part of the custom format, so no outer gzip.
log "Starting backup ${DATE}..."
mkdir -p "${BACKUP_DIR}"

docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" supabase-db \
    pg_dump -U postgres -h localhost --format=custom --compress=9 postgres \
    > "${BACKUP_FILE}" \
    || fail "pg_dump failed"

# An empty or truncated dump is worse than no dump, because it looks like one.
if [ ! -s "${BACKUP_FILE}" ]; then
    fail "pg_dump produced an empty file"
fi

BACKUP_SIZE=$(du -sh "${BACKUP_FILE}" | cut -f1)
log "Dump complete: ${BACKUP_FILE} (${BACKUP_SIZE})"

# ── 2. Upload the dump ────────────────────────────────────────────
log "Uploading the dump to ${RCLONE_REMOTE}..."
rclone copy "${BACKUP_FILE}" "${RCLONE_REMOTE}/db/" \
    --log-level INFO \
    >> "${LOG_FILE}" 2>&1 \
    || fail "rclone copy of the dump failed"
log "Dump uploaded"

# ── 3. Upload the storage bucket ──────────────────────────────────
# `copy`, not `sync`: a file deleted on the server should stay in the backup.
# Object names are content hashes, so nothing is ever re-uploaded needlessly.
log "Uploading storage files..."
if [ -d "${DATA_DIR}/storage" ]; then
    rclone copy "${DATA_DIR}/storage" "${RCLONE_REMOTE}/storage/" \
        --log-level INFO \
        >> "${LOG_FILE}" 2>&1 \
        || fail "rclone copy of storage failed"
    log "Storage uploaded"
else
    log "No storage directory at ${DATA_DIR}/storage — skipped"
fi

# ── 4. Local cleanup ──────────────────────────────────────────────
log "Removing local dumps older than ${RETENTION_LOCAL_DAYS} days..."
find "${BACKUP_DIR}" -name "db_*.dump" -mtime "+${RETENTION_LOCAL_DAYS}" -delete
log "Local cleanup complete"

# ── 5. Remote cleanup ─────────────────────────────────────────────
# Only the dumps age out. Storage files are never deleted remotely: they are the
# only copy of anything uploaded through the admin panel.
log "Removing remote dumps older than ${RETENTION_REMOTE_DAYS} days..."
rclone delete "${RCLONE_REMOTE}/db/" \
    --min-age "${RETENTION_REMOTE_DAYS}d" \
    --log-level INFO \
    >> "${LOG_FILE}" 2>&1 \
    || fail "rclone delete failed"
log "Remote cleanup complete"

log "Backup ${DATE} finished successfully"
