#!/usr/bin/env bash
# Database backup with local rotation and optional S3 upload.
#
# Env:
#   DATABASE_URL=postgresql://...        (sourced from $APP_DIR/.env if unset)
#   BACKUP_DIR=/var/backups/shieldvpn    where dumps land locally
#   KEEP_DAYS=14                          local retention window
#   S3_BUCKET=                            optional — s3://bucket/prefix
#   GPG_RECIPIENT=                        optional — encrypt dumps to this key

set -euo pipefail
IFS=$'\n\t'

APP_DIR="${APP_DIR:-/home/shieldvpn/app}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/shieldvpn}"
KEEP_DAYS="${KEEP_DAYS:-14}"
S3_BUCKET="${S3_BUCKET:-}"
GPG_RECIPIENT="${GPG_RECIPIENT:-}"

if [[ -z "${DATABASE_URL:-}" && -f "${APP_DIR}/.env" ]]; then
  # shellcheck disable=SC1091
  set -a; . "${APP_DIR}/.env"; set +a
fi
: "${DATABASE_URL:?DATABASE_URL not set and ${APP_DIR}/.env not found}"

mkdir -p "$BACKUP_DIR"
chmod 0700 "$BACKUP_DIR"

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
HOST=$(hostname -s)
DUMP="${BACKUP_DIR}/shieldvpn-${HOST}-${STAMP}.sql.gz"

# pg_dump rejects Prisma's ?schema=... query param. Strip before passing.
PG_URL="${DATABASE_URL%%\?*}"

echo "==> Dumping database → ${DUMP}"
# --format=plain so dumps remain restore-able with vanilla psql; --no-owner
# and --no-privileges keep them portable across DB role names. Force
# pg_dump's exit status to propagate through the pipe.
set -o pipefail
pg_dump --no-owner --no-privileges --format=plain "$PG_URL" | gzip -9 >"$DUMP"
chmod 0600 "$DUMP"

if [[ -n "$GPG_RECIPIENT" ]]; then
  echo "==> Encrypting for ${GPG_RECIPIENT}"
  gpg --batch --yes --trust-model always --output "${DUMP}.gpg" --encrypt --recipient "$GPG_RECIPIENT" "$DUMP"
  shred -u "$DUMP" 2>/dev/null || rm -f "$DUMP"
  DUMP="${DUMP}.gpg"
fi

if [[ -n "$S3_BUCKET" ]]; then
  echo "==> Uploading to ${S3_BUCKET}/$(basename "$DUMP")"
  aws s3 cp "$DUMP" "${S3_BUCKET%/}/$(basename "$DUMP")" --no-progress
fi

# Local rotation
echo "==> Pruning local dumps older than ${KEEP_DAYS} days"
find "$BACKUP_DIR" -maxdepth 1 -name 'shieldvpn-*.sql.gz*' -mtime "+${KEEP_DAYS}" -delete

# Sanity: a 0-byte dump means pg_dump failed silently (gzip swallowed the error).
SIZE=$(stat -c %s "$DUMP" 2>/dev/null || stat -f %z "$DUMP")
if [[ "$SIZE" -lt 1024 ]]; then
  echo "!! Dump is suspiciously small (${SIZE} bytes) — investigate" >&2
  exit 1
fi

echo "==> Backup ok: ${DUMP} (${SIZE} bytes)"
