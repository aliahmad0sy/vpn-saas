#!/usr/bin/env bash
# Bootstrap a fresh Ubuntu 22.04 / 24.04 VPS for ShieldVPN.
# Idempotent: rerun safely. Run as root: `sudo bash deploy/scripts/install.sh`.
#
# What it does:
#   1. apt install: nginx, postgresql-16, ufw, fail2ban, certbot, git, curl
#   2. Installs Node.js 22 from NodeSource
#   3. Creates app user `shieldvpn` and clones the repo into ~/app
#   4. Hardens SSH (disables password auth, root login)
#   5. Configures ufw firewall (22, 80, 443)
#   6. Configures fail2ban for sshd + nginx
#   7. Renders nginx vhost from the template + obtains an initial cert
#   8. Installs the systemd unit and enables the cron schedule
#
# Required env or flags:
#   DOMAIN=vpn.example.com  ./install.sh
#   LETSENCRYPT_EMAIL=ops@example.com  (for certbot)
#
# Optional:
#   APP_USER=shieldvpn  APP_DIR=/home/shieldvpn/app  REPO_URL=https://github.com/<you>/vpn-saas.git
#   SKIP_CERT=1  (handy on first run before DNS is pointed)

set -euo pipefail
IFS=$'\n\t'

log()  { printf '\033[1;32m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31mxx\033[0m %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run as root (sudo)."

: "${DOMAIN:?Set DOMAIN=your.vpn.example.com}"
: "${LETSENCRYPT_EMAIL:?Set LETSENCRYPT_EMAIL=you@example.com}"
APP_USER="${APP_USER:-shieldvpn}"
APP_DIR="${APP_DIR:-/home/${APP_USER}/app}"
REPO_URL="${REPO_URL:-}"
NODE_MAJOR="${NODE_MAJOR:-22}"
SKIP_CERT="${SKIP_CERT:-0}"

# ---- 1. Base packages -------------------------------------------------------
log "Installing apt packages…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
  ca-certificates curl gnupg lsb-release \
  git rsync openssl jq htop \
  nginx postgresql postgresql-contrib \
  ufw fail2ban unattended-upgrades \
  certbot python3-certbot-nginx

# ---- 2. Node.js 22 ----------------------------------------------------------
if ! command -v node >/dev/null || [[ "$(node -v | cut -dv -f2 | cut -d. -f1)" -lt "$NODE_MAJOR" ]]; then
  log "Installing Node.js ${NODE_MAJOR} from NodeSource…"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi
npm install -g pm2@latest >/dev/null

# ---- 3. App user ------------------------------------------------------------
if ! id -u "$APP_USER" >/dev/null 2>&1; then
  log "Creating app user ${APP_USER}…"
  adduser --system --group --shell /bin/bash --home "/home/${APP_USER}" "$APP_USER"
fi

if [[ -n "$REPO_URL" && ! -d "$APP_DIR/.git" ]]; then
  log "Cloning ${REPO_URL} → ${APP_DIR}"
  sudo -u "$APP_USER" git clone --depth=20 "$REPO_URL" "$APP_DIR"
fi
mkdir -p "$APP_DIR" && chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# ---- 4. SSH hardening -------------------------------------------------------
log "Hardening sshd config…"
SSHD=/etc/ssh/sshd_config
if [[ -f "$SSHD" ]]; then
  cp "$SSHD" "${SSHD}.shieldvpn.bak.$(date +%s)" 2>/dev/null || true
  sed -ri 's/^#?PermitRootLogin.*/PermitRootLogin prohibit-password/' "$SSHD"
  sed -ri 's/^#?PasswordAuthentication.*/PasswordAuthentication no/'    "$SSHD"
  sed -ri 's/^#?ChallengeResponseAuthentication.*/ChallengeResponseAuthentication no/' "$SSHD"
  sed -ri 's/^#?MaxAuthTries.*/MaxAuthTries 3/'                         "$SSHD"
  sed -ri 's/^#?ClientAliveInterval.*/ClientAliveInterval 300/'         "$SSHD"
  systemctl reload ssh || systemctl reload sshd || true
fi

# ---- 5. UFW -----------------------------------------------------------------
log "Configuring ufw…"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
systemctl enable --now ufw

# ---- 6. fail2ban ------------------------------------------------------------
log "Configuring fail2ban…"
cat >/etc/fail2ban/jail.d/shieldvpn.conf <<'JAIL'
[sshd]
enabled  = true
maxretry = 3
findtime = 10m
bantime  = 1h

[nginx-http-auth]
enabled = true

[nginx-botsearch]
enabled = true

[nginx-limit-req]
enabled  = true
filter   = nginx-limit-req
logpath  = /var/log/nginx/error.log
maxretry = 10
findtime = 1m
bantime  = 10m
JAIL
systemctl enable --now fail2ban
systemctl restart fail2ban

# ---- 7. nginx vhost ---------------------------------------------------------
log "Rendering nginx vhost for ${DOMAIN}…"
NGINX_TEMPLATE="${APP_DIR}/deploy/nginx/shieldvpn.conf.template"
NGINX_PROXY="${APP_DIR}/deploy/nginx/_proxy_params.conf"
NGINX_TARGET="/etc/nginx/conf.d/shieldvpn.conf"

if [[ ! -f "$NGINX_TEMPLATE" ]]; then
  warn "Template not found at $NGINX_TEMPLATE — skipping nginx step."
else
  install -m 0644 "$NGINX_PROXY" /etc/nginx/conf.d/_proxy_params.conf
  # For bare-metal, swap the upstream so nginx points at localhost.
  sed "s/server app:3000;.*$/server 127.0.0.1:3000;/" "$NGINX_TEMPLATE" \
    | DOMAIN="$DOMAIN" envsubst '${DOMAIN}' >"$NGINX_TARGET"
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl reload nginx
fi

# ---- 7b. Initial cert -------------------------------------------------------
if [[ "$SKIP_CERT" != "1" ]]; then
  log "Requesting initial Let's Encrypt cert for ${DOMAIN}…"
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "$LETSENCRYPT_EMAIL" --redirect || \
    warn "certbot failed — point DNS at this VPS, then rerun: certbot --nginx -d $DOMAIN"
  systemctl enable --now certbot.timer
fi

# ---- 8. systemd + cron ------------------------------------------------------
SYSTEMD_UNIT="${APP_DIR}/deploy/systemd/shieldvpn-app.service"
if [[ -f "$SYSTEMD_UNIT" ]]; then
  log "Installing shieldvpn-app.service…"
  install -m 0644 "$SYSTEMD_UNIT" /etc/systemd/system/shieldvpn-app.service
  systemctl daemon-reload
  systemctl enable shieldvpn-app.service
fi

CRON_FILE="${APP_DIR}/deploy/scripts/crontab.txt"
if [[ -f "$CRON_FILE" ]]; then
  log "Installing system cron schedule…"
  install -m 0644 "$CRON_FILE" /etc/cron.d/shieldvpn
  # cron is picky about ownership and trailing newlines; the file already
  # ends in a newline (enforced by deploy/scripts/crontab.txt).
fi

# ---- 9. unattended-upgrades -------------------------------------------------
log "Enabling unattended security upgrades…"
dpkg-reconfigure -f noninteractive unattended-upgrades || true

log "Done. Next steps:"
cat <<NEXT
  1. Copy .env to ${APP_DIR}/.env  (set ENCRYPTION_KEY, CRON_SECRET, DB creds, Stripe keys, etc.)
  2. As ${APP_USER}:  cd ${APP_DIR} && npm ci && npm run build && npx prisma migrate deploy && npm run db:seed
  3. systemctl start shieldvpn-app
  4. Verify:   curl -sf https://${DOMAIN}/api/healthz
NEXT
