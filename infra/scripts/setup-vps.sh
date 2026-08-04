#!/usr/bin/env bash
# setup-vps.sh — idempotent initial setup for Ubuntu 24.04
# Run manually once. Everything else is automated by CI.
set -euo pipefail

REPO_URL="git@github.com:your-org/your-repo.git"
INSTALL_DIR="/opt/your-project"
DATA_DIR="/opt/your-project-data"
GITHUB_USERNAME="your-github-username"
BACKUP_CRON="0 3 * * * root bash ${INSTALL_DIR}/scripts/backup.sh >> /var/log/your-project-backup.log 2>&1"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}→ $*${NC}"; }
warn()    { echo -e "${YELLOW}⚠ $*${NC}"; }
success() { echo -e "${GREEN}✓ $*${NC}"; }

# ── 1. Docker ─────────────────────────────────────────────────────
info "Installing Docker..."
if ! command -v docker &>/dev/null; then
    apt-get update -qq
    apt-get install -y -qq ca-certificates curl gnupg lsb-release
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
        | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
        https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
        > /etc/apt/sources.list.d/docker.list
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl enable --now docker
    success "Docker installed"
else
    success "Docker already installed"
fi

# ── 2. Supabase CLI ───────────────────────────────────────────────
info "Installing Supabase CLI..."
if ! command -v supabase &>/dev/null; then
    SUPABASE_VERSION="2.98.2"
    curl -fsSL "https://github.com/supabase/cli/releases/download/v${SUPABASE_VERSION}/supabase_linux_amd64.tar.gz" \
        | tar -xz -C /usr/local/bin supabase
    chmod +x /usr/local/bin/supabase
    success "Supabase CLI installed"
else
    success "Supabase CLI already installed"
fi

# ── 3. Git and rclone ─────────────────────────────────────────────
info "Installing git and rclone..."
apt-get install -y -qq git
if ! command -v rclone &>/dev/null; then
    curl -fsSL https://rclone.org/install.sh | bash
fi
success "git and rclone ready"

# ── 4. Deploy key for GitHub (read-only access to private repo) ───
info "Configuring deploy key for GitHub..."
mkdir -p /root/.ssh
chmod 700 /root/.ssh

if [ ! -f /root/.ssh/your-project-deploy ]; then
    ssh-keygen -t ed25519 -f /root/.ssh/your-project-deploy -C "your-project-deploy" -N ""
    success "Deploy key generated"
else
    success "Deploy key already exists"
fi

# Add GitHub to known_hosts to avoid interactive prompt on first clone
ssh-keyscan -t ed25519 github.com >> /root/.ssh/known_hosts 2>/dev/null

# Configure SSH to use this key for GitHub
if ! grep -q "your-project-deploy" /root/.ssh/config 2>/dev/null; then
    cat >> /root/.ssh/config <<'EOF'
Host github.com
  IdentityFile /root/.ssh/your-project-deploy
  IdentitiesOnly yes
EOF
    chmod 600 /root/.ssh/config
fi

echo ""
warn "Before continuing, add this deploy key to GitHub:"
warn "  → Your GitHub repo → Settings → Deploy keys → Add deploy key (read-only)"
echo ""
cat /root/.ssh/your-project-deploy.pub
echo ""
warn "Press Enter once the key has been added..."
read -r

# ── 5. Clone repository ───────────────────────────────────────────
info "Setting up repository at ${INSTALL_DIR}..."
if [ ! -d "${INSTALL_DIR}/.git" ]; then
    git clone "${REPO_URL}" "${INSTALL_DIR}"
    success "Repository cloned"
else
    success "Repository already exists"
fi

# ── 6. .env file ──────────────────────────────────────────────────
info "Preparing docker/.env..."
if [ ! -f "${INSTALL_DIR}/docker/.env" ]; then
    cp "${INSTALL_DIR}/docker/.env.example" "${INSTALL_DIR}/docker/.env"
    warn "docker/.env created from example."
    warn "IMPORTANT: fill in the real values before continuing."
fi

# ── 7. Generate random secrets ────────────────────────────────────
info "Generating random secrets in docker/.env..."
ENV_FILE="${INSTALL_DIR}/docker/.env"

set_env_var() {
    local key="$1"
    local value="$2"
    if grep -q "^${key}=CHANGEME" "${ENV_FILE}" 2>/dev/null || grep -q "^${key}=$" "${ENV_FILE}" 2>/dev/null; then
        sed -i "s|^${key}=.*|${key}=${value}|" "${ENV_FILE}"
    fi
}

set_env_var "POSTGRES_PASSWORD"            "$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)"
set_env_var "JWT_SECRET"                   "$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 48)"
set_env_var "SECRET_KEY_BASE"              "$(openssl rand -base64 64 | tr -dc 'a-zA-Z0-9' | head -c 64)"
set_env_var "VAULT_ENC_KEY"               "$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)"
set_env_var "PG_META_CRYPTO_KEY"          "$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)"
set_env_var "LOGFLARE_PUBLIC_ACCESS_TOKEN" "$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)"
set_env_var "LOGFLARE_PRIVATE_ACCESS_TOKEN" "$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)"
set_env_var "DASHBOARD_PASSWORD"           "$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)"

success "Secrets generated"

# ── 8. SSH key for GitHub Actions ────────────────────────────────
info "Configuring SSH key for GitHub Actions..."
mkdir -p /root/.ssh
chmod 700 /root/.ssh

if [ -n "${DEPLOY_PUBLIC_KEY:-}" ]; then
    PUB_KEY="${DEPLOY_PUBLIC_KEY}"
else
    echo ""
    warn "Enter the public SSH key that GitHub Actions will use:"
    read -r PUB_KEY
fi

if ! grep -qF "${PUB_KEY}" /root/.ssh/authorized_keys 2>/dev/null; then
    echo "${PUB_KEY}" >> /root/.ssh/authorized_keys
    chmod 600 /root/.ssh/authorized_keys
    success "SSH key added to authorized_keys"
else
    success "SSH key already present"
fi

# ── 9. Print GitHub Secrets — do this before starting the stack ───
VPS_IP=$(curl -fsSL https://ifconfig.me 2>/dev/null || echo "<SERVER_IP>")
POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" "${ENV_FILE}" | cut -d= -f2)

echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Configure these GitHub Secrets now:                 ${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════${NC}"
echo ""
echo "  VPS_HOST         →  ${VPS_IP}"
echo "  VPS_USER         →  $(whoami)"
echo "  VPS_SSH_KEY      →  (PRIVATE key matching the public key you just added)"
echo "  PROD_DB_PASSWORD →  ${POSTGRES_PASSWORD}"
echo ""
echo "  Repository: Settings → Secrets and variables → Actions"
echo ""
echo -e "${YELLOW}  Also fill in ANON_KEY and SERVICE_ROLE_KEY in docker/.env (see README step 4).${NC}"
echo ""
warn "Press Enter to continue and start the Docker stack..."
read -r

# ── 10. ghcr.io login (for pulling private frontend image) ────────
info "Logging in to GitHub Container Registry (ghcr.io)..."
echo ""
warn "Enter a GitHub Personal Access Token with 'read:packages' scope:"
warn "  Generate one at: https://github.com/settings/tokens/new?scopes=read:packages"
read -r -s GHCR_TOKEN
echo "${GHCR_TOKEN}" | docker login ghcr.io -u "${GITHUB_USERNAME}" --password-stdin \
    && success "Logged in to ghcr.io" \
    || warn "ghcr.io login failed — you can retry later with: echo TOKEN | docker login ghcr.io -u ${GITHUB_USERNAME} --password-stdin"

# ── 11. Backup cron ───────────────────────────────────────────────
info "Configuring backup cron job..."
if ! grep -qF "backup.sh" /etc/crontab 2>/dev/null; then
    echo "${BACKUP_CRON}" >> /etc/crontab
    success "Cron configured (daily at 03:00)"
else
    success "Backup cron already configured"
fi

# ── 12. Start the stack ───────────────────────────────────────────
info "Creating data directories..."
mkdir -p "${DATA_DIR}/db/data" "${DATA_DIR}/storage"

info "Starting Docker stack..."
cd "${INSTALL_DIR}/docker"
docker compose up -d && success "Stack started" || warn "Stack failed to start — fix docker/.env and run: cd ${INSTALL_DIR}/docker && docker compose up -d"
