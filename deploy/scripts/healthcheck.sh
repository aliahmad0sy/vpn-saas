#!/usr/bin/env bash
# External healthcheck probe. Intended to run from cron every 5 minutes.
# Exits 0 on success; on failure, prints to stderr (which cron mails / sends
# to syslog) and bumps a counter file — once 3 consecutive failures land,
# attempts a `systemctl restart` of the app and alerts via webhook.
#
# Env:
#   HEALTH_URL=http://127.0.0.1:3000/api/healthz
#   ALERT_WEBHOOK=https://hooks.slack.com/...   (optional)
#   COUNTER_FILE=/var/lib/shieldvpn/health-fails

set -euo pipefail

HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/healthz}"
COUNTER_FILE="${COUNTER_FILE:-/var/lib/shieldvpn/health-fails}"
ALERT_WEBHOOK="${ALERT_WEBHOOK:-}"
THRESHOLD="${THRESHOLD:-3}"

mkdir -p "$(dirname "$COUNTER_FILE")" 2>/dev/null || true

alert() {
  local msg="$1"
  echo "$(date -Iseconds) $msg" >&2
  if [[ -n "$ALERT_WEBHOOK" ]]; then
    curl -fsS -m 5 -H 'Content-Type: application/json' \
      -d "{\"text\":\"shieldvpn healthcheck: ${msg}\"}" "$ALERT_WEBHOOK" >/dev/null || true
  fi
}

if BODY=$(curl -fsS -m 5 "$HEALTH_URL"); then
  : >"$COUNTER_FILE"
  # Optional: assert the body claims db is up.
  if echo "$BODY" | grep -q '"db":"up"'; then
    exit 0
  fi
  alert "db not up in healthz body: $BODY"
fi

FAILS=$(( $(cat "$COUNTER_FILE" 2>/dev/null || echo 0) + 1 ))
echo "$FAILS" >"$COUNTER_FILE"
alert "healthcheck failed (#$FAILS) for $HEALTH_URL"

if [[ "$FAILS" -ge "$THRESHOLD" ]]; then
  alert "threshold reached — attempting systemctl restart shieldvpn-app"
  sudo systemctl restart shieldvpn-app 2>/dev/null || pm2 restart shieldvpn 2>/dev/null || true
  : >"$COUNTER_FILE"
fi

exit 1
