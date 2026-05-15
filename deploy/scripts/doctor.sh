#!/usr/bin/env bash
# Diagnostics: verifies the host can actually run ShieldVPN. Safe and read-only.
# Run before/after deploy:  bash deploy/scripts/doctor.sh

set -uo pipefail

ok()    { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
warn()  { printf '\033[1;33m?\033[0m %s\n' "$*"; }
fail()  { printf '\033[1;31m✗\033[0m %s\n' "$*"; FAILED=1; }

FAILED=0
APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

cd "$APP_DIR"

# --- Tooling ---------------------------------------------------------------
command -v node >/dev/null  && ok "node $(node -v)"                         || fail "node not found"
command -v npm  >/dev/null  && ok "npm  $(npm -v)"                          || fail "npm not found"
command -v psql >/dev/null  && ok "psql $(psql --version | awk '{print $3}')" || warn "psql not on PATH (optional)"
command -v nginx >/dev/null && ok "nginx $(nginx -v 2>&1 | awk -F/ '{print $2}')" || warn "nginx not on PATH"
command -v certbot >/dev/null && ok "certbot $(certbot --version 2>&1 | awk '{print $2}')" || warn "certbot not installed"

# --- Required env --------------------------------------------------------
if [[ ! -f .env ]]; then
  fail ".env file missing"
else
  ok ".env present"
  # shellcheck disable=SC1091
  set -a; . ./.env; set +a
fi

check_required() {
  local var=$1
  if [[ -z "${!var:-}" ]]; then fail "$var is empty"; else ok "$var set"; fi
}
check_min_length() {
  local var=$1 min=$2 actual=${#3}
  if (( actual < min )); then fail "$var is ${actual} chars, need ≥${min}"; else ok "$var length ok"; fi
}

for v in DATABASE_URL AUTH_SECRET ENCRYPTION_KEY CRON_SECRET NEXT_PUBLIC_APP_URL; do
  check_required "$v"
done
check_min_length AUTH_SECRET 16     "${AUTH_SECRET:-}"
check_min_length ENCRYPTION_KEY 16  "${ENCRYPTION_KEY:-}"
check_min_length CRON_SECRET 16     "${CRON_SECRET:-}"

# --- Crypto roundtrip ---------------------------------------------------
if [[ -n "${ENCRYPTION_KEY:-}" ]]; then
  if RT=$(node -e '
    const k = process.env.ENCRYPTION_KEY;
    const { createCipheriv, createDecipheriv, randomBytes, scryptSync } = require("crypto");
    let key;
    if (/^[A-Za-z0-9+/=]+$/.test(k) && Buffer.from(k,"base64").length===32) key = Buffer.from(k,"base64");
    else key = scryptSync(k, "vpn-saas-static-salt-v1", 32);
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", key, iv);
    const ct = Buffer.concat([c.update("hello","utf8"), c.final()]);
    const tag = c.getAuthTag();
    const d = createDecipheriv("aes-256-gcm", key, iv);
    d.setAuthTag(tag);
    const pt = Buffer.concat([d.update(ct), d.final()]).toString("utf8");
    if (pt!=="hello") process.exit(1);
    console.log("ok");
  ' 2>&1); then
    [[ "$RT" == "ok" ]] && ok "encryption roundtrip" || fail "encryption roundtrip failed: $RT"
  else
    fail "encryption roundtrip threw"
  fi
fi

# --- DB connectivity ----------------------------------------------------
if [[ -n "${DATABASE_URL:-}" ]] && command -v psql >/dev/null; then
  # psql rejects Prisma's ?schema=... query param; strip Prisma-specific
  # params before handing the URI off.
  PSQL_URL="${DATABASE_URL%%\?*}"
  if psql "$PSQL_URL" -c 'SELECT 1' >/dev/null 2>&1; then
    ok "database reachable"
  else
    fail "cannot connect to DATABASE_URL"
  fi
fi

# --- App listening port -------------------------------------------------
if curl -fsS -m 2 "http://127.0.0.1:3000/api/healthz" >/dev/null 2>&1; then
  ok "app responding on 127.0.0.1:3000"
else
  warn "app not responding on 127.0.0.1:3000 (start it with: sudo systemctl start shieldvpn-app)"
fi

# --- HTTPS termination --------------------------------------------------
if [[ -n "${NEXT_PUBLIC_APP_URL:-}" && "${NEXT_PUBLIC_APP_URL}" == https://* ]]; then
  if curl -fsS -m 5 "${NEXT_PUBLIC_APP_URL%/}/api/healthz" >/dev/null 2>&1; then
    ok "external HTTPS healthz ok"
  else
    warn "external healthz failed at ${NEXT_PUBLIC_APP_URL%/}/api/healthz"
  fi
fi

# --- Cron schedule installed -------------------------------------------
if [[ -f /etc/cron.d/shieldvpn ]]; then
  ok "cron schedule installed at /etc/cron.d/shieldvpn"
else
  warn "cron schedule not installed (copy deploy/scripts/crontab.txt)"
fi

# --- TLS expiry warning -------------------------------------------------
if command -v openssl >/dev/null && [[ -n "${NEXT_PUBLIC_APP_URL:-}" && "${NEXT_PUBLIC_APP_URL}" == https://* ]]; then
  HOST=$(printf '%s' "$NEXT_PUBLIC_APP_URL" | sed -E 's|https://([^/]+).*|\1|')
  EXP=$(echo | openssl s_client -servername "$HOST" -connect "${HOST}:443" 2>/dev/null \
        | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
  if [[ -n "$EXP" ]]; then
    EXP_TS=$(date -d "$EXP" +%s 2>/dev/null || echo 0)
    NOW_TS=$(date +%s)
    DAYS=$(( (EXP_TS - NOW_TS) / 86400 ))
    if (( DAYS < 14 )); then fail "TLS cert expires in ${DAYS}d ($EXP)"; else ok "TLS cert valid for ${DAYS}d"; fi
  fi
fi

echo
if [[ "$FAILED" == "0" ]]; then
  ok "all checks passed"
else
  fail "doctor found problems — fix the items above"
  exit 1
fi
