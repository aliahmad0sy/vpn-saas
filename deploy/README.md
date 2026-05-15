# ShieldVPN — Production deployment

Two supported paths:

- **Docker Compose** (`deploy/docker-compose.prod.yml`) — single host, all
  services as containers. Best for getting up and running fast.
- **Bare-metal on Ubuntu 22.04 / 24.04** (`deploy/scripts/install.sh`,
  `deploy/systemd/`) — runs Postgres + Node directly with systemd. Best for
  long-lived VPS deployments where you want fine-grained control.

Both paths share the same nginx config, cron schedule, backup/deploy
scripts, and the same security baseline.

---

## 1. Prepare your secrets

Generate the strong secrets you'll need:

```bash
openssl rand -base64 32   # AUTH_SECRET
openssl rand -base64 32   # ENCRYPTION_KEY  (must be exactly 32 bytes b64)
openssl rand -hex 32      # CRON_SECRET
```

Copy `.env.example` and fill it in. Every variable in `src/lib/env.ts` is
validated at boot — the app will refuse to start with an incomplete config.

Bare-minimum production env:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db?schema=public` |
| `AUTH_SECRET` | 32-byte base64; signs Auth.js JWTs |
| `AUTH_TRUST_HOST` | `true` |
| `ENCRYPTION_KEY` | 32-byte base64; encrypts VPN private keys, PSKs, SSH keys at rest |
| `CRON_SECRET` | Bearer token for `/api/cron/*` (≥16 chars) |
| `NEXT_PUBLIC_APP_URL` | `https://vpn.example.com` |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe live keys |
| `STRIPE_PRICE_{BASIC,PRO,ENTERPRISE}{,_YEARLY}` | Created in your Stripe dashboard |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Bootstrap admin for the seed script |

---

## 2A. Docker Compose path

```bash
# On the host:
cd /opt && sudo git clone https://github.com/aliahmad0sy/vpn-saas.git
cd vpn-saas
cp .env.example .env && $EDITOR .env

# DNS — point vpn.example.com → this VPS

# Initial cert (one-time, with the app stack already running on :80)
sudo certbot certonly --standalone -d vpn.example.com -m ops@example.com --agree-tos

# Render nginx vhost (substitute ${DOMAIN}) into the mount path
DOMAIN=vpn.example.com envsubst '${DOMAIN}' \
  < deploy/nginx/shieldvpn.conf.template \
  > deploy/nginx/shieldvpn.conf

# Bring everything up
docker compose -f deploy/docker-compose.prod.yml up -d --build

# First-time: apply migrations + seed plans
docker compose -f deploy/docker-compose.prod.yml exec app npx prisma migrate deploy
docker compose -f deploy/docker-compose.prod.yml exec app npm run db:seed
```

The Docker image is a multi-stage build that emits a Next.js
**standalone** server (≈100 MB final image, no `node_modules` install at
runtime), runs as uid 1001 under `tini`, includes a built-in
`HEALTHCHECK` against `/api/healthz`, and ships the ssh2 native binding.

Auto-renewing certs: have the host run

```cron
0 4 * * * certbot renew --quiet --deploy-hook "docker compose -f /opt/vpn-saas/deploy/docker-compose.prod.yml exec nginx nginx -s reload"
```

---

## 2B. Bare-metal VPS path

Fresh Ubuntu 22.04 / 24.04 box:

```bash
# As root on the VPS:
git clone https://github.com/aliahmad0sy/vpn-saas.git /tmp/vpn-saas
cd /tmp/vpn-saas
DOMAIN=vpn.example.com LETSENCRYPT_EMAIL=ops@example.com bash deploy/scripts/install.sh
```

`install.sh` is idempotent. It installs Node 22, Postgres 16, nginx,
certbot, ufw, fail2ban, unattended-upgrades; creates the `shieldvpn`
system user; hardens sshd (no root, no passwords, MaxAuthTries=3);
configures the firewall (`ufw`: 22/80/443); renders the nginx vhost from
the template; requests an initial TLS cert; installs the systemd unit
and the system cron schedule.

After the script finishes, switch to the app user and bring the app up:

```bash
sudo -iu shieldvpn
cd ~/app
cp /tmp/vpn-saas/.env.example .env && $EDITOR .env   # fill it in
npm ci --no-audit --no-fund
npx prisma migrate deploy
npm run db:seed
npm run build
exit

sudo systemctl start shieldvpn-app
sudo systemctl status shieldvpn-app
curl -fsS https://vpn.example.com/api/healthz
```

Switch the app user's git remote to your private fork before pushing
deploys — see [Deploying updates](#4-deploying-updates).

---

## 3. Cron schedule

Installed at `/etc/cron.d/shieldvpn`. Driven by `CRON_SECRET` sourced
out of the app's `.env` so this file contains no secrets.

| When | What |
|---|---|
| `* * * * *` | `POST /api/cron/sync-peers` — drains PeerSyncJob queue (≤25 jobs/batch, retries up to 5) |
| `*/2 * * * *` | `POST /api/cron/health-check` — probes every managed server, records ServerHealthCheck |
| `*/5 * * * *` | `POST /api/cron/collect-traffic` — pulls `wg show dump`, writes TrafficRecord rows |
| `17 * * * *` | `POST /api/cron/expire-configs` — revokes expired + orphaned VPN configs |
| `30 2 * * *` | `backup.sh` — gzipped pg_dump with 14-day rotation, optional GPG + S3 |
| `*/5 * * * *` | `healthcheck.sh` — external probe; restarts the app after 3 consecutive failures and pings Slack |

Adjust by editing `deploy/scripts/crontab.txt` and re-running the install
script (it copies it to `/etc/cron.d/shieldvpn`).

---

## 4. Deploying updates

```bash
sudo -iu shieldvpn
cd ~/app
bash deploy/scripts/deploy.sh           # pulls main, npm ci, migrate, build, restart, healthcheck
bash deploy/scripts/deploy.sh BRANCH=release/2025-05
USE_PM2=1 bash deploy/scripts/deploy.sh # if you went with PM2 instead of systemd
```

If `/api/healthz` doesn't respond `200` within 30s after restart,
`deploy.sh` automatically resets to the previous SHA, rebuilds, and
restarts.

Manual rollback:

```bash
bash deploy/scripts/rollback.sh                 # → last prev= line
TARGET=abcd1234 bash deploy/scripts/rollback.sh # → explicit SHA
```

---

## 5. Backups

```bash
APP_DIR=/home/shieldvpn/app bash deploy/scripts/backup.sh
# → /var/backups/shieldvpn/shieldvpn-<host>-<UTC>.sql.gz   (mode 0600)
```

Configurable:

- `KEEP_DAYS=30` — local retention
- `S3_BUCKET=s3://shieldvpn-backups/prod` — uploads each dump
- `GPG_RECIPIENT=ops@example.com` — encrypts to that key before upload

Restore:

```bash
bash deploy/scripts/restore.sh /var/backups/shieldvpn/shieldvpn-host-20260101T020000Z.sql.gz
bash deploy/scripts/restore.sh /var/backups/shieldvpn/...gpg --force   # CI restore — no confirm
```

The restore script stops the app, drops and recreates the `public`
schema, loads the dump, and starts the app again.

---

## 6. Monitoring

Three layers, all in this repo:

1. **Per-server WireGuard health** — `/api/cron/health-check` writes a
   `ServerHealthCheck` row every 2 minutes per managed server. The
   admin UI at `/admin/monitoring` surfaces the last 15 checks and
   per-server status + latency.
2. **App liveness** — `/api/healthz` returns 200 with `{db:"up"}` when
   the DB ping succeeds. Used by the container HEALTHCHECK, the
   systemd unit, the deploy auto-rollback, and the external probe.
3. **External probe** — `deploy/scripts/healthcheck.sh` runs from cron,
   maintains a fail-streak counter, restarts the app at threshold, and
   alerts via `ALERT_WEBHOOK`.

The admin dashboard at `/admin/monitoring` also tracks:

- Failed `PeerSyncJob` queue with the full error per attempt
- Configs expiring in the next 7 days
- Top-traffic active peers with bytes rx/tx + last handshake
- Per-server last health check + last sync time + last sync error

---

## 7. Security hardening

What `install.sh` already does for you:

- **sshd**: `PermitRootLogin prohibit-password`, `PasswordAuthentication no`,
  `ChallengeResponseAuthentication no`, `MaxAuthTries 3`
- **ufw**: default deny incoming, only 22/80/443 open
- **fail2ban**: sshd (3 fails → 1h ban), `nginx-limit-req` (10 hits/min → 10m ban)
- **unattended-upgrades** for security patches
- **systemd sandbox**: `ProtectSystem=strict`, `ProtectHome=read-only`,
  `NoNewPrivileges`, `MemoryDenyWriteExecute`, empty `CapabilityBoundingSet`
- **nginx**: HSTS preload, modern TLS profile, OCSP stapling, per-IP
  rate limits (5r/s on auth, 20r/s on api), 50-connection cap per IP,
  Stripe webhook bypasses rate limits so retries don't 429

What the app does at the code level:

- All VPN private keys, PSKs, and SSH private keys are AES-256-GCM
  encrypted at rest. The encryption key never leaves the process; the
  DB only ever sees ciphertext (verified in `deploy/scripts/doctor.sh`
  with a live roundtrip)
- Stripe webhook signature verification with idempotent event tracking
  in `ProcessedStripeEvent`
- Constant-time compare for `CRON_SECRET`
- CSP, nonces, and HSTS set by the middleware
- Open-redirect-safe `callbackUrl` enforcement

What you still need to do:

- **DNS**: point your domain at the VPS, set up SPF/DKIM/DMARC if you
  send email
- **Stripe**: register the webhook endpoint at
  `https://vpn.example.com/api/webhooks/stripe` with the events listed
  in `src/app/api/webhooks/stripe/route.ts`
- **Backups**: configure `S3_BUCKET` + `GPG_RECIPIENT` for off-host
  encrypted backups; periodically test restore.sh against a staging DB
- **VPN servers**: provision WireGuard on each location, generate
  server keypairs, populate Server rows via `/admin/servers` with SSH
  credentials (key-only, dedicated user with `wg` in NOPASSWD sudoers)

---

## 8. CI / CD

`.github/workflows/ci.yml` runs on every push and PR:

- Postgres 16 service container
- `npm ci → prisma generate → prisma db push → typecheck → lint → build`
- Boot smoke test: starts the production server, polls `/api/healthz`,
  hits public pages
- A `docker` job on push-to-main builds the production image with
  buildx + GHA cache (push is off by default — set up your registry
  creds and flip `push: true`)

Recommended deploy job (added separately when you wire in your secret
manager): SSH to the VPS, run `bash deploy/scripts/deploy.sh BRANCH=main`.
The script auto-rolls-back on healthcheck failure so a bad commit can't
take the site down.

---

## 9. Troubleshooting

```bash
bash deploy/scripts/doctor.sh           # one-shot diagnostic
journalctl -u shieldvpn-app -f          # tail the app
journalctl -u nginx -f
tail -f /var/log/nginx/error.log
sudo -u shieldvpn psql                  # local DB shell
```

| Symptom | Likely cause |
|---|---|
| `Invalid environment variables` at boot | Missing ENCRYPTION_KEY or CRON_SECRET — run doctor.sh |
| `Stripe webhook returns 400` | The webhook is being rewritten by nginx; confirm the `/api/webhooks/stripe` location bypasses `proxy_buffering` (template already does this) |
| `Cron 401 — Invalid cron token` | `CRON_SECRET` in `.env` differs from the value cron is sourcing |
| `PeerSyncJob FAILED with SshConfigError` | Server has no `sshHost/sshUser/sshPrivateKey` — add credentials in `/admin/servers` |
| `Encryption key error` | `ENCRYPTION_KEY` length isn't 32 b64 bytes — `openssl rand -base64 32` |
| `TLS cert expires in N days` from doctor | `systemctl status certbot.timer`; `certbot renew --dry-run` |
