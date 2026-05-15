#!/usr/bin/env bash
# Restore a pg_dump backup. DANGEROUS — drops and recreates the public schema.
# Usage:  bash restore.sh /var/backups/shieldvpn/shieldvpn-host-XXXX.sql.gz
#
# Pass --force to skip the confirmation prompt.

set -euo pipefail
IFS=$'\n\t'

APP_DIR="${APP_DIR:-/home/shieldvpn/app}"
FORCE=0
DUMP=""

for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    *) DUMP="$arg" ;;
  esac
done

[[ -n "$DUMP" && -f "$DUMP" ]] || { echo "Usage: $0 <dump-file> [--force]" >&2; exit 1; }

if [[ -z "${DATABASE_URL:-}" && -f "${APP_DIR}/.env" ]]; then
  # shellcheck disable=SC1091
  set -a; . "${APP_DIR}/.env"; set +a
fi
: "${DATABASE_URL:?DATABASE_URL not set}"

if [[ "$FORCE" != "1" ]]; then
  printf 'About to OVERWRITE the database at:\n  %s\nfrom:\n  %s\nContinue? [yes/NO] ' \
    "$(echo "$DATABASE_URL" | sed -E 's|://[^@]+@|://***:***@|')" "$DUMP"
  read -r reply
  [[ "$reply" == "yes" ]] || { echo "Aborted."; exit 1; }
fi

echo "==> Stopping app while restore runs"
sudo systemctl stop shieldvpn-app 2>/dev/null || pm2 stop shieldvpn 2>/dev/null || true

PSQL_URL="${DATABASE_URL%%\?*}"

echo "==> Dropping & recreating public schema"
psql "$PSQL_URL" -v ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
SQL

echo "==> Loading dump"
if [[ "$DUMP" == *.gpg ]]; then
  gpg --decrypt "$DUMP" | gunzip | psql "$PSQL_URL" -v ON_ERROR_STOP=1
elif [[ "$DUMP" == *.gz ]]; then
  gunzip -c "$DUMP" | psql "$PSQL_URL" -v ON_ERROR_STOP=1
else
  psql "$PSQL_URL" -v ON_ERROR_STOP=1 -f "$DUMP"
fi

echo "==> Restarting app"
sudo systemctl start shieldvpn-app 2>/dev/null || pm2 start shieldvpn 2>/dev/null || true

echo "==> Restore complete."
