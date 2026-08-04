#!/usr/bin/env bash
# backup.sh — back up Postgres to Hetzner Object Storage
# Runs via cron every night at 03:00
set -euo pipefail

INSTALL_DIR="/opt/your-project"
PROJECT_NAME="your-project"
BACKUP_DIR="/var/backups/your-project"
LOG_FILE="/var/log/your-project-backup.log"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/db_${DATE}.dump.gz"
RCLONE_REMOTE="your-remote:your-project-backups"
RETENTION_LOCAL_DAYS=7
RETENTION_REMOTE_DAYS=30

# Load production variables
ENV_FILE="${INSTALL_DIR}/docker/.env"
if [ -f "${ENV_FILE}" ]; then
    # shellcheck disable=SC1090
    source <(grep -E '^(POSTGRES_PASSWORD|SMTP_.*)=' "${ENV_FILE}" | sed 's/^/export /')
fi
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"

send_alert() {
    local subject="$1"
    local body="$2"
    if [ -n "${SMTP_HOST:-}" ] && [ -n "${SMTP_USER:-}" ] && [ -n "${SMTP_PASS:-}" ]; then
        curl -fsSL --ssl-reqd \
            --url "smtp://${SMTP_HOST}:${SMTP_PORT:-587}" \
            --user "${SMTP_USER}:${SMTP_PASS}" \
            --mail-from "${SMTP_ADMIN_EMAIL:-noreply@your-domain.com}" \
            --mail-rcpt "${SMTP_ADMIN_EMAIL:-noreply@your-domain.com}" \
            --upload-file - <<EOF || true
From: ${SMTP_SENDER_NAME:-Project Backup} <${SMTP_ADMIN_EMAIL:-noreply@your-domain.com}>
To: ${SMTP_ADMIN_EMAIL:-noreply@your-domain.com}
Subject: [${PROJECT_NAME^^}] ${subject}

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
log "Starting backup ${DATE}..."
mkdir -p "${BACKUP_DIR}"

PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
    -h localhost -p 5432 -U postgres \
    --format=custom --compress=9 \
    postgres \
    | gzip > "${BACKUP_FILE}" \
    || fail "pg_dump failed"

BACKUP_SIZE=$(du -sh "${BACKUP_FILE}" | cut -f1)
log "Dump complete: ${BACKUP_FILE} (${BACKUP_SIZE})"

# ── 2. Upload to Hetzner Object Storage ──────────────────────────
log "Uploading to ${RCLONE_REMOTE}..."
rclone copy "${BACKUP_FILE}" "${RCLONE_REMOTE}/" \
    --log-level INFO \
    >> "${LOG_FILE}" 2>&1 \
    || fail "rclone copy failed"
log "Upload complete"

# ── 3. Local cleanup (older than 7 days) ─────────────────────────
log "Removing local backups older than ${RETENTION_LOCAL_DAYS} days..."
find "${BACKUP_DIR}" -name "db_*.dump.gz" -mtime "+${RETENTION_LOCAL_DAYS}" -delete
log "Local cleanup complete"

# ── 4. Remote cleanup (older than 30 days) ───────────────────────
log "Removing remote backups older than ${RETENTION_REMOTE_DAYS} days..."
rclone delete "${RCLONE_REMOTE}/" \
    --min-age "${RETENTION_REMOTE_DAYS}d" \
    --log-level INFO \
    >> "${LOG_FILE}" 2>&1 \
    || fail "rclone delete failed"
log "Remote cleanup complete"

log "Backup ${DATE} finished successfully"
