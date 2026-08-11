#!/usr/bin/env bash
# setup-vps.sh — idempotent initial setup for Ubuntu 24.04
#
# Run once, as root, over SSH. Everything after this is automated by CI.
# Safe to re-run: every step checks before acting, and generated secrets are only
# written where the value is still CHANGEME or empty.
#
# After the first successful run, root SSH login is disabled. To re-run it later:
#   ssh -p <SSH_PORT> admin@<IP> 'sudo bash /opt/guille-outes/infra/scripts/setup-vps.sh'
#
# Overridable from the environment:
#   SSH_PORT=2222 ADMIN_USER=admin DEPLOY_USER=deploy bash setup-vps.sh
set -euo pipefail

REPO_URL="git@github.com:plakagh/guille-outes.git"
INSTALL_DIR="/opt/guille-outes"
DATA_DIR="/opt/guille-outes-data"

# The compose stack lives in a subdirectory of the monorepo, not at its root.
COMPOSE_DIR="${INSTALL_DIR}/infra/docker"
ENV_FILE="${COMPOSE_DIR}/.env"

# Two accounts with different jobs, neither of them root:
#   ADMIN_USER   a human, with sudo, for maintenance
#   DEPLOY_USER  GitHub Actions, no sudo at all — it only needs the docker group
#                and ownership of the install directory
ADMIN_USER="${ADMIN_USER:-admin}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"

# Moving SSH off 22 is not a security boundary — key-only auth is. It does cut the
# constant background brute-force noise out of the logs, which makes a real
# intrusion attempt visible.
SSH_PORT="${SSH_PORT:-2222}"

SWAP_FILE="/swapfile"
SWAP_SIZE_MB=2048
BACKUP_CRON="0 3 * * * root bash ${INSTALL_DIR}/infra/scripts/backup.sh >> /var/log/guille-outes-backup.log 2>&1"

SSHD_DROPIN="/etc/ssh/sshd_config.d/99-guille-outes.conf"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}→ $*${NC}"; }
warn()    { echo -e "${YELLOW}⚠ $*${NC}"; }
error()   { echo -e "${RED}✗ $*${NC}"; }
success() { echo -e "${GREEN}✓ $*${NC}"; }

if [ "$(id -u)" -ne 0 ]; then
    error "Run this as root (or under sudo)."
    exit 1
fi

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
# Needed on the server because the deploy applies migrations from here.
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

# ── 4. Swap ───────────────────────────────────────────────────────
# 4 GB is enough for this stack in steady state but leaves little headroom for a
# spike — the 03:00 pg_dump overlapping with image resizing, say. Swap turns an
# OOM kill into a slow minute.
info "Configuring ${SWAP_SIZE_MB} MB of swap..."
if ! swapon --show | grep -q "${SWAP_FILE}"; then
    if [ ! -f "${SWAP_FILE}" ]; then
        fallocate -l "${SWAP_SIZE_MB}M" "${SWAP_FILE}" \
            || dd if=/dev/zero of="${SWAP_FILE}" bs=1M count="${SWAP_SIZE_MB}"
        chmod 600 "${SWAP_FILE}"
        mkswap "${SWAP_FILE}" >/dev/null
    fi
    swapon "${SWAP_FILE}"
    grep -qF "${SWAP_FILE}" /etc/fstab || echo "${SWAP_FILE} none swap sw 0 0" >> /etc/fstab
    # Prefer reclaiming cache over swapping out a live process.
    sysctl -qw vm.swappiness=10
    grep -q '^vm.swappiness' /etc/sysctl.conf || echo "vm.swappiness=10" >> /etc/sysctl.conf
    success "Swap enabled"
else
    success "Swap already enabled"
fi

# ── 5. Accounts ───────────────────────────────────────────────────
info "Creating the ${ADMIN_USER} and ${DEPLOY_USER} accounts..."

make_user() {
    local user="$1"
    if ! id -u "${user}" &>/dev/null; then
        useradd --create-home --shell /bin/bash "${user}"
        # No password is ever set: both accounts are key-only, and password
        # authentication is turned off entirely in step 12.
        passwd -l "${user}" >/dev/null
    fi
    install -d -m 700 -o "${user}" -g "${user}" "/home/${user}/.ssh"
}

make_user "${ADMIN_USER}"
make_user "${DEPLOY_USER}"

# The admin is a human doing maintenance: sudo, and the docker group so `docker
# compose logs` needs no sudo.
usermod -aG sudo,docker "${ADMIN_USER}"

# The deploy account gets NO sudo. It does not need any: the deploy pulls the
# repo, edits docker/.env and drives docker — all of which it can do through
# group membership and file ownership alone. Anything that escapes the deploy
# pipeline therefore escapes into an unprivileged account.
usermod -aG docker "${DEPLOY_USER}"
gpasswd -d "${DEPLOY_USER}" sudo 2>/dev/null || true

# Key-only accounts cannot answer a sudo password prompt, so the admin's sudo is
# passwordless — the same arrangement cloud-init gives the default `ubuntu` user.
echo "${ADMIN_USER} ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/90-${ADMIN_USER}"
chmod 440 "/etc/sudoers.d/90-${ADMIN_USER}"
visudo -cf "/etc/sudoers.d/90-${ADMIN_USER}" >/dev/null || {
    error "Generated an invalid sudoers file; removing it."
    rm -f "/etc/sudoers.d/90-${ADMIN_USER}"
    exit 1
}

success "Accounts ready"

# ── 6. Authorised keys ────────────────────────────────────────────
add_key() {
    local user="$1" key="$2" file="/home/$1/.ssh/authorized_keys"
    touch "${file}"
    if ! grep -qF "${key}" "${file}" 2>/dev/null; then
        echo "${key}" >> "${file}"
    fi
    chmod 600 "${file}"
    chown "${user}:${user}" "${file}"
}

info "Installing SSH keys..."

# The admin key: how you will reach this machine once root login and passwords are
# off. If a key is already in use, offer it as the default rather than making you
# paste one you are evidently already using.
#
# Look at the invoking user's file first: on an Ubuntu cloud image you arrive as
# `ubuntu` via sudo, and that is where the real key lives. Root's file on those
# images is not empty but holds a forced-command stub —
#   no-port-forwarding,...,command="echo 'Please login as the user \"ubuntu\"...'"
# — so match only lines that actually begin with a key type, or that stub would be
# offered as a key and rejected a moment later for the wrong reason.
first_key() {
    [ -f "$1" ] || return 0
    grep -m1 -E '^(ssh-(ed25519|rsa|dss)|ecdsa-sha2-)' "$1" 2>/dev/null || true
}

ROOT_KEY=""
if [ -n "${SUDO_USER:-}" ] && [ "${SUDO_USER}" != "root" ]; then
    ROOT_KEY=$(first_key "/home/${SUDO_USER}/.ssh/authorized_keys")
fi
[ -n "${ROOT_KEY}" ] || ROOT_KEY=$(first_key /root/.ssh/authorized_keys)

if [ -n "${ADMIN_PUBLIC_KEY:-}" ]; then
    ADMIN_KEY="${ADMIN_PUBLIC_KEY}"
elif [ -s "/home/${ADMIN_USER}/.ssh/authorized_keys" ]; then
    ADMIN_KEY=""
    success "${ADMIN_USER} already has an authorised key"
else
    echo ""
    warn "PUBLIC SSH key for ${ADMIN_USER} — this is how you will log in from now on."
    if [ -n "${ROOT_KEY}" ]; then
        warn "Press Enter to reuse the key root is currently using:"
        warn "  ${ROOT_KEY:0:60}..."
    else
        warn "No existing authorised key was found, so you are logging in by password."
        warn "You need a key pair now. On your OWN machine, in another terminal:"
        warn "    ssh-keygen -t ed25519 -f ~/.ssh/guille-outes-admin -N ''"
        warn "    cat ~/.ssh/guille-outes-admin.pub"
        warn "Paste that single line here:"
    fi
    read -r ADMIN_KEY
    if [ -z "${ADMIN_KEY}" ]; then
        ADMIN_KEY="${ROOT_KEY}"
    fi
fi

if [ -n "${ADMIN_KEY}" ]; then
    case "${ADMIN_KEY}" in
        ssh-*|ecdsa-*) add_key "${ADMIN_USER}" "${ADMIN_KEY}" ;;
        *) error "That does not look like an SSH public key. Aborting before anything is locked."; exit 1 ;;
    esac
fi

if [ ! -s "/home/${ADMIN_USER}/.ssh/authorized_keys" ]; then
    error "${ADMIN_USER} has no authorised key. Refusing to continue — you would be locked out."
    exit 1
fi

# The deploy key: the public half of the pair GitHub Actions will use.
if [ -n "${DEPLOY_PUBLIC_KEY:-}" ]; then
    DEPLOY_KEY="${DEPLOY_PUBLIC_KEY}"
elif [ -s "/home/${DEPLOY_USER}/.ssh/authorized_keys" ]; then
    DEPLOY_KEY=""
    success "${DEPLOY_USER} already has an authorised key"
else
    echo ""
    warn "PUBLIC SSH key GitHub Actions will use. Generate the pair on your own machine:"
    warn "  ssh-keygen -t ed25519 -f ~/.ssh/guille-outes-actions -N ''"
    read -r DEPLOY_KEY
fi

if [ -n "${DEPLOY_KEY}" ]; then
    case "${DEPLOY_KEY}" in
        ssh-*|ecdsa-*) add_key "${DEPLOY_USER}" "${DEPLOY_KEY}" ;;
        *) error "That does not look like an SSH public key."; exit 1 ;;
    esac
fi

success "Keys installed"

# ── 7. Deploy key for GitHub (read-only access to the repo) ────────
# It lives in the deploy account's home, because the deploy account is what runs
# `git pull`.
info "Configuring the GitHub deploy key..."
DEPLOY_HOME="/home/${DEPLOY_USER}"
GH_KEY="${DEPLOY_HOME}/.ssh/guille-outes-deploy"

if [ ! -f "${GH_KEY}" ]; then
    sudo -u "${DEPLOY_USER}" ssh-keygen -t ed25519 -f "${GH_KEY}" -C "guille-outes-deploy" -N ""
    success "Deploy key generated"
else
    success "Deploy key already exists"
fi

# Pre-seed known_hosts so the first clone is not an interactive prompt.
sudo -u "${DEPLOY_USER}" bash -c "ssh-keyscan -t ed25519 github.com >> ${DEPLOY_HOME}/.ssh/known_hosts 2>/dev/null"
sort -u "${DEPLOY_HOME}/.ssh/known_hosts" -o "${DEPLOY_HOME}/.ssh/known_hosts"

if ! grep -q "guille-outes-deploy" "${DEPLOY_HOME}/.ssh/config" 2>/dev/null; then
    cat >> "${DEPLOY_HOME}/.ssh/config" <<EOF
Host github.com
  IdentityFile ${GH_KEY}
  IdentitiesOnly yes
EOF
fi
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${DEPLOY_HOME}/.ssh"
chmod 600 "${DEPLOY_HOME}/.ssh/config"

echo ""
warn "This is a DIFFERENT key from the two you just pasted. It was generated here,"
warn "and it is what lets this server pull the repo. Add the public half to GitHub:"
warn "  → https://github.com/plakagh/guille-outes/settings/keys → Add deploy key (read-only)"
warn "Its private half stays on this server; you never need it."
echo ""
cat "${GH_KEY}.pub"
echo ""
warn "Press Enter once the key has been added..."
read -r

# ── 8. Clone repository ───────────────────────────────────────────
info "Setting up the repository at ${INSTALL_DIR}..."
install -d -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" "${INSTALL_DIR}"

if [ ! -d "${INSTALL_DIR}/.git" ]; then
    sudo -u "${DEPLOY_USER}" git clone "${REPO_URL}" "${INSTALL_DIR}"
    success "Repository cloned"
else
    success "Repository already exists"
fi

# The deploy account must own the tree it pulls into and the .env it rewrites.
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${INSTALL_DIR}"

# ── 9. .env file ──────────────────────────────────────────────────
info "Preparing docker/.env..."
if [ ! -f "${ENV_FILE}" ]; then
    cp "${COMPOSE_DIR}/.env.example" "${ENV_FILE}"
    success "docker/.env created from the example"
else
    success "docker/.env already exists — leaving it alone"
fi
# Holds every production secret, and the deploy rewrites FRONTEND_IMAGE in it.
chown "${DEPLOY_USER}:${DEPLOY_USER}" "${ENV_FILE}"
chmod 600 "${ENV_FILE}"

# ── 10. Generate random secrets ───────────────────────────────────
info "Generating random secrets in docker/.env..."

set_env_var() {
    local key="$1"
    local value="$2"
    if grep -q "^${key}=CHANGEME$" "${ENV_FILE}" 2>/dev/null || grep -q "^${key}=$" "${ENV_FILE}" 2>/dev/null; then
        # `|` as the delimiter: base64 values contain / and + but never a pipe.
        sed -i "s|^${key}=.*|${key}=${value}|" "${ENV_FILE}"
    fi
}

alnum() { openssl rand -base64 "$1" | tr -dc 'a-zA-Z0-9' | head -c "$2"; }

set_env_var "POSTGRES_PASSWORD"  "$(alnum 32 32)"
set_env_var "JWT_SECRET"         "$(alnum 48 48)"
set_env_var "SECRET_KEY_BASE"    "$(alnum 64 64)"
set_env_var "PG_META_CRYPTO_KEY" "$(alnum 32 32)"
set_env_var "DASHBOARD_PASSWORD" "$(alnum 24 24)"

# NOT run through `tr`: this one must decode to exactly 32 bytes for AES-256, so
# stripping characters out of the base64 would quietly produce an unusable key
# and the admin panel would refuse to store the Redsys secret.
set_env_var "PAYMENTS_ENCRYPTION_KEY" "$(openssl rand -base64 32)"

success "Secrets generated"

# ── 11. Derive ANON_KEY and SERVICE_ROLE_KEY ──────────────────────
# These are not random: they are HS256 JWTs signed with JWT_SECRET, and every
# service verifies them against it. Deriving them here rather than by hand
# removes the step most likely to be got wrong.
info "Deriving ANON_KEY and SERVICE_ROLE_KEY from JWT_SECRET..."
if grep -q "^ANON_KEY=$" "${ENV_FILE}" || grep -q "^SERVICE_ROLE_KEY=$" "${ENV_FILE}"; then
    JWT_SECRET_VALUE=$(grep "^JWT_SECRET=" "${ENV_FILE}" | cut -d= -f2-)

    KEYS=$(JWT_SECRET_VALUE="${JWT_SECRET_VALUE}" python3 - <<'PY'
import base64, hashlib, hmac, json, os, time

secret = os.environ["JWT_SECRET_VALUE"].encode()
iat = int(time.time())
exp = iat + 10 * 365 * 24 * 3600  # ten years; rotating means re-signing both

def b64(raw):
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()

header = b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())

for role, name in (("anon", "ANON_KEY"), ("service_role", "SERVICE_ROLE_KEY")):
    payload = b64(json.dumps(
        {"role": role, "iss": "supabase", "iat": iat, "exp": exp},
        separators=(",", ":"),
    ).encode())
    signature = b64(hmac.new(secret, f"{header}.{payload}".encode(), hashlib.sha256).digest())
    print(f"{name}={header}.{payload}.{signature}")
PY
)

    while IFS='=' read -r key value; do
        [ -n "${key}" ] && set_env_var "${key}" "${value}"
    done <<< "${KEYS}"

    success "Keys derived and written"
else
    success "ANON_KEY and SERVICE_ROLE_KEY already set — leaving them alone"
fi

# ── 12. Firewall ──────────────────────────────────────────────────
# Every internal service is already bound to 127.0.0.1 by docker-compose.yml;
# this is the second lock on the same door. Port 22 stays open until the new SSH
# port has been proven to work, in step 14.
info "Configuring the firewall..."
if ! command -v ufw &>/dev/null; then
    apt-get install -y -qq ufw
fi
ufw allow 22/tcp             >/dev/null
ufw allow "${SSH_PORT}/tcp"  >/dev/null
ufw allow 80/tcp             >/dev/null
ufw allow 443/tcp            >/dev/null
ufw allow 443/udp            >/dev/null
ufw --force enable           >/dev/null
success "Firewall active (22, ${SSH_PORT}, 80, 443)"

# ── 13. Move SSH to ${SSH_PORT}, keeping root reachable for now ────
info "Moving SSH to port ${SSH_PORT}..."

# Ubuntu 23.04+ starts sshd through socket activation, and under it the `Port`
# directive in sshd_config is ignored — the socket unit decides. Switching back
# to the plain service is the least surprising way to make one config file the
# single source of truth.
if systemctl is-enabled ssh.socket &>/dev/null; then
    info "Disabling socket activation so sshd_config controls the port..."
    systemctl disable --now ssh.socket >/dev/null 2>&1 || true
    systemctl enable ssh.service >/dev/null 2>&1 || true
fi

mkdir -p /etc/ssh/sshd_config.d
cat > "${SSHD_DROPIN}" <<EOF
# Managed by infra/scripts/setup-vps.sh — edits here are overwritten on re-run.
#
# Both ports, deliberately. A Port directive REPLACES the default rather than
# adding to it, so listing only the new one would stop sshd answering on 22 the
# moment it restarts — and 22 is the way back in if the new port turns out not to
# work. Step 14 drops this line once the new access has been proven.
#
# (No backticks anywhere in this heredoc. It is unquoted so the port number
# expands, which also means bash would read backticks as command substitution.)
Port 22
Port ${SSH_PORT}

PubkeyAuthentication yes
PermitEmptyPasswords no
X11Forwarding no

# Deliberately generous. An SSH agent offers its keys one at a time and each one
# counts against this limit, so a client whose agent holds several keys — 1Password
# and the like — gets "Too many authentication failures" before the right key is
# ever tried. Tightening this does not buy much either: with passwords off and
# pubkey-only auth, there is nothing here to brute-force.
MaxAuthTries 10

# Nothing is taken away yet either. On a server reached by password — the normal
# case for a fresh VPS — turning passwords off here would lock you out the instant
# sshd restarts, because there would be no root key to fall back on. Both of these
# become restrictive in step 14.
PermitRootLogin yes
PasswordAuthentication yes
EOF

if ! sshd -t; then
    error "sshd rejected the new configuration. Reverting; nothing has changed."
    rm -f "${SSHD_DROPIN}"
    systemctl restart ssh 2>/dev/null || true
    exit 1
fi

systemctl restart ssh
sleep 2

# If sshd is not actually listening on the new port, the config did not take
# effect — most likely socket activation is still in play. Revert rather than
# hand back a server whose only open SSH port answers nothing.
if ! ss -tlnH "sport = :${SSH_PORT}" | grep -q .; then
    error "Nothing is listening on port ${SSH_PORT}. Reverting to the previous SSH config."
    rm -f "${SSHD_DROPIN}"
    systemctl restart ssh
    error "Port 22 is untouched, so your current session is safe. Investigate before re-running."
    exit 1
fi

success "sshd is listening on ${SSH_PORT} (and still on 22)"

# ── 14. Prove the new access works, then close the old door ────────
VPS_IP=$(curl -fsSL https://ifconfig.me 2>/dev/null || echo "<SERVER_IP>")

echo ""
echo -e "${YELLOW}══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  Do this now, in a SECOND terminal — do not close this one:   ${NC}"
echo -e "${YELLOW}══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "    ssh -p ${SSH_PORT} ${ADMIN_USER}@${VPS_IP} 'sudo -n true && echo works'"
echo ""
warn "It must print 'works' — that proves the key, the port and sudo all work."
warn "If your key is a file rather than in an agent, add -i <path> to that command."
warn ""
warn "Only then press Enter. That is the irreversible half: it disables root login,"
warn "turns password authentication OFF for everyone, and closes port 22."
warn ""
warn "If it fails, press Ctrl+C. This session, port 22, root login and password"
warn "authentication all stay exactly as they are, so you can fix it and re-run."
read -r

# Keep a copy: if sshd rejects the result, put back exactly what was working.
cp "${SSHD_DROPIN}" "${SSHD_DROPIN}.working"

sed -i '/^Port 22$/d' "${SSHD_DROPIN}"
sed -i 's|^PermitRootLogin .*|PermitRootLogin no|' "${SSHD_DROPIN}"
sed -i 's|^PasswordAuthentication .*|PasswordAuthentication no|' "${SSHD_DROPIN}"
{
    echo "KbdInteractiveAuthentication no"
    echo "AllowUsers ${ADMIN_USER} ${DEPLOY_USER}"
} >> "${SSHD_DROPIN}"

if ! sshd -t; then
    error "sshd rejected the hardened configuration. Restoring the working one."
    mv "${SSHD_DROPIN}.working" "${SSHD_DROPIN}"
    systemctl restart ssh
    error "Root, passwords and port 22 are all still available. Investigate before re-running."
    exit 1
fi

systemctl restart ssh
sleep 2

# Last guard: the hardened config must still be listening on the new port.
if ! ss -tlnH "sport = :${SSH_PORT}" | grep -q .; then
    error "Nothing is listening on ${SSH_PORT} after hardening. Rolling back."
    mv "${SSHD_DROPIN}.working" "${SSHD_DROPIN}"
    systemctl restart ssh
    exit 1
fi

rm -f "${SSHD_DROPIN}.working"
ufw delete allow 22/tcp >/dev/null 2>&1 || true
success "Root login and passwords disabled, port 22 closed"

# ── 15. Backup cron ───────────────────────────────────────────────
info "Configuring the backup cron job..."
if ! grep -qF "backup.sh" /etc/crontab 2>/dev/null; then
    echo "${BACKUP_CRON}" >> /etc/crontab
    success "Cron configured (daily at 03:00)"
else
    success "Backup cron already configured"
fi

# ── 16. Start the stack ───────────────────────────────────────────
info "Creating data directories..."
# Owned by root: the containers write here as their own internal users, and the
# deploy account has no reason to touch production data.
mkdir -p "${DATA_DIR}/db/data" "${DATA_DIR}/storage"

info "Starting the Docker stack..."
# Without --profile frontend, so the storefront is skipped: its image does not
# exist yet. The first push to main builds it and CI brings it up.
cd "${COMPOSE_DIR}"
if sudo -u "${DEPLOY_USER}" docker compose up -d; then
    success "Backing services started"
else
    warn "Stack failed to start. Fix ${ENV_FILE}, then:"
    warn "  cd ${COMPOSE_DIR} && sudo -u ${DEPLOY_USER} docker compose up -d"
fi

# ── 17. What CI needs ─────────────────────────────────────────────
ANON_KEY_VALUE=$(grep "^ANON_KEY=" "${ENV_FILE}" | cut -d= -f2-)

echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  GitHub → Settings → Secrets and variables → Actions          ${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "  VPS_HOST                       →  ${VPS_IP}"
echo "  VPS_PORT                       →  ${SSH_PORT}"
echo "  VPS_USER                       →  ${DEPLOY_USER}"
echo "  VPS_SSH_KEY                    →  ~/.ssh/guille-outes-actions  (the PRIVATE half, whole file)"
echo "  NEXT_PUBLIC_SITE_URL           →  https://guilleoutes.com"
echo "  NEXT_PUBLIC_SUPABASE_URL       →  https://api.guilleoutes.com"
echo "  NEXT_PUBLIC_SUPABASE_ANON_KEY  →  ${ANON_KEY_VALUE}"
echo ""
echo -e "${YELLOW}  Still to fill in by hand in ${ENV_FILE}:${NC}"
echo -e "${YELLOW}    SMTP_HOST, SMTP_USER, SMTP_PASS  (auth mail, order mail, backup alerts)${NC}"
echo ""
echo -e "${GREEN}  From now on you log in as:${NC}"
echo "    ssh -p ${SSH_PORT} ${ADMIN_USER}@${VPS_IP}"
echo ""
success "Setup complete."
