#!/usr/bin/env bash
# Deploy the current commit on a long-lived VPS. Run as the `shieldvpn` user
# from $APP_DIR. Safe to rerun.
#
# Steps:
#   1. Record the current commit hash for rollback
#   2. git pull (or skip with NO_PULL=1 if you SCP'd a build)
#   3. npm ci  (locked, no scripts run with elevated privilege)
#   4. prisma migrate deploy  (production migration path — no schema drift)
#   5. npm run build
#   6. systemctl restart shieldvpn-app  (or pm2 reload shieldvpn)
#   7. wait for /api/healthz to return 200; otherwise roll back
#
# Env:
#   APP_DIR=/home/shieldvpn/app  BRANCH=main  HEALTH_URL=http://127.0.0.1:3000/api/healthz
#   USE_PM2=1   to drive PM2 instead of systemd

set -euo pipefail
IFS=$'\n\t'

log()  { printf '\033[1;32m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31mxx\033[0m %s\n' "$*" >&2; exit 1; }

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
BRANCH="${BRANCH:-main}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/healthz}"
USE_PM2="${USE_PM2:-0}"
RELEASE_LOG="${RELEASE_LOG:-${APP_DIR}/.releases}"

cd "$APP_DIR"
mkdir -p "$(dirname "$RELEASE_LOG")"

PREV_SHA=$(git rev-parse HEAD)
log "Current HEAD: ${PREV_SHA}"
printf 'prev=%s\n' "$PREV_SHA" >>"$RELEASE_LOG"

if [[ "${NO_PULL:-0}" != "1" ]]; then
  log "Fetching origin/${BRANCH}…"
  git fetch --prune origin "$BRANCH"
  git checkout "$BRANCH"
  git reset --hard "origin/${BRANCH}"
fi
NEW_SHA=$(git rev-parse HEAD)
log "Deploying ${NEW_SHA}"

if [[ ! -f .env ]]; then
  die ".env missing — copy .env.example and fill it in before deploying"
fi

log "Installing dependencies (npm ci, --ignore-scripts disabled because prisma postinstall needs to run)…"
npm ci --no-audit --no-fund

log "Running prisma migrate deploy…"
npx prisma migrate deploy

log "Building…"
npm run build

restart_app() {
  if [[ "$USE_PM2" == "1" ]]; then
    log "Reloading PM2 process…"
    pm2 reload shieldvpn
  else
    log "Restarting systemd unit…"
    sudo systemctl restart shieldvpn-app
  fi
}

wait_healthy() {
  for i in {1..30}; do
    if curl -fsS -m 3 "$HEALTH_URL" >/dev/null; then
      log "Healthy after ${i}s."
      return 0
    fi
    sleep 1
  done
  return 1
}

restart_app

if ! wait_healthy; then
  warn "Healthcheck did NOT pass after 30s — rolling back to ${PREV_SHA}…"
  git reset --hard "$PREV_SHA"
  npm ci --no-audit --no-fund || true
  npm run build || true
  restart_app
  die "Deployment rolled back."
fi

printf 'new=%s at=%s\n' "$NEW_SHA" "$(date -Iseconds)" >>"$RELEASE_LOG"
log "Deployed ${NEW_SHA}."
