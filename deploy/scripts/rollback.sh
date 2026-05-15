#!/usr/bin/env bash
# Roll back to the previous deployed commit. Reads the last `prev=` line from
# .releases. Run as the `shieldvpn` user from $APP_DIR.
#
# Optional:  TARGET=<sha>   to jump to an explicit commit instead.

set -euo pipefail
IFS=$'\n\t'

log()  { printf '\033[1;32m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31mxx\033[0m %s\n' "$*" >&2; exit 1; }

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
RELEASE_LOG="${APP_DIR}/.releases"
USE_PM2="${USE_PM2:-0}"

cd "$APP_DIR"

if [[ -n "${TARGET:-}" ]]; then
  SHA="$TARGET"
else
  [[ -f "$RELEASE_LOG" ]] || die "No release log at $RELEASE_LOG — pass TARGET=<sha> explicitly."
  SHA=$(grep '^prev=' "$RELEASE_LOG" | tail -n1 | cut -d= -f2)
  [[ -n "$SHA" ]] || die "Could not parse a previous SHA from $RELEASE_LOG."
fi

log "Rolling back to ${SHA}…"
git fetch --quiet origin || true
git reset --hard "$SHA"
npm ci --no-audit --no-fund
npx prisma migrate deploy || warn "Prisma migrate deploy failed — DB may be ahead of code; investigate."
npm run build

if [[ "$USE_PM2" == "1" ]]; then
  pm2 reload shieldvpn
else
  sudo systemctl restart shieldvpn-app
fi

printf 'rolled_back=%s at=%s\n' "$SHA" "$(date -Iseconds)" >>"$RELEASE_LOG"
log "Now serving ${SHA}."
