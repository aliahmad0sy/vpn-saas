# ShieldVPN — Production-ready VPN SaaS

A full-stack VPN-as-a-Service built with Next.js 15 (App Router), TypeScript,
Tailwind CSS, Prisma, Auth.js, Stripe and WireGuard.

## Stack

| Layer       | Tech                                       |
|-------------|--------------------------------------------|
| Frontend    | Next.js 15, React 19, Tailwind, Framer Motion |
| Auth        | Auth.js v5 (Credentials + JWT sessions)    |
| Payments    | Stripe Checkout + Billing Portal + Webhooks |
| Database    | PostgreSQL 16 via Prisma 6                  |
| VPN         | WireGuard (server-side key generation, QR + .conf export) |
| Logging     | pino                                       |
| Infra       | Docker + docker-compose                    |

## Quick start

### Option A — Local dev (Docker for DB only)

```bash
# 1. Install deps
npm install

# 2. Start Postgres
docker compose -f docker-compose.dev.yml up -d

# 3. Apply schema & seed
npm run db:push
npm run db:seed

# 4. Run the app
npm run dev
```

The app is now on `http://localhost:3000`.

Admin login: `admin@example.com` / `ChangeMeNow123!`
(override via `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars before seeding).

### Option B — Full Docker

```bash
docker compose up -d --build
# inside the container, run migrations once:
docker compose exec app npx prisma db push
docker compose exec app npm run db:seed
```

## Project layout

```
src/
├── app/
│   ├── (auth)/login, /register
│   ├── api/
│   │   ├── auth/[...nextauth]      Auth.js handler
│   │   ├── healthz                 health check
│   │   ├── webhooks/stripe         Stripe webhook
│   │   └── v1/                     REST API
│   ├── admin/                      Admin dashboard
│   ├── dashboard/                  User dashboard
│   ├── pricing/
│   ├── layout.tsx, page.tsx        Landing page
│   └── globals.css
├── components/                     UI primitives, marketing, shell
├── lib/                            env, prisma, stripe, wireguard, audit
├── server/
│   ├── actions/                    Server Actions (auth, billing, vpn, admin)
│   ├── auth.ts                     Auth.js config
│   └── guards.ts                   requireUser / requireAdmin
├── middleware.ts                   Route protection
prisma/
├── schema.prisma
└── seed.ts
```

## REST API

| Endpoint                              | Auth          | Description                            |
|---------------------------------------|---------------|----------------------------------------|
| `GET /api/healthz`                    | public        | Liveness + DB ping                     |
| `GET /api/v1/servers`                 | public        | List online servers                    |
| `GET /api/v1/me`                      | session       | Current user + active subscription     |
| `GET /api/v1/configs/:id`             | session       | WireGuard config as JSON               |
| `GET /api/v1/configs/:id?format=file` | session       | Download `.conf`                       |
| `GET /api/v1/configs/:id?format=qr`   | session       | QR code data URL                       |
| `POST /api/webhooks/stripe`           | Stripe sig    | Subscription lifecycle events          |

All endpoints are rate-limited per IP (configurable via `RATE_LIMIT_*`).

## Environment

Copy `.env.example` to `.env.local` and fill in real values. At minimum you
need `DATABASE_URL` and a strong `AUTH_SECRET` (generate with `openssl rand -base64 32`).

Stripe is optional for local development — without real keys, checkout flows
will error but the rest of the app remains functional.

## Security notes

- Passwords are hashed with bcrypt (cost factor 12).
- Sessions use JWT strategy via Auth.js.
- Middleware redirects unauthenticated users to `/login`.
- Admin pages additionally verify `role === 'ADMIN'` server-side.
- All Server Actions validate input with zod.
- Stripe webhooks are verified using the signing secret.
- Security headers (X-Frame-Options, Referrer-Policy, etc.) are set globally.

## Scripts

```bash
npm run dev         # start Next.js dev server
npm run build       # production build (runs prisma generate)
npm run start       # start production server
npm run typecheck   # tsc --noEmit
npm run lint
npm run format
npm run db:push     # sync schema without migrations
npm run db:migrate  # create migration
npm run db:seed     # seed admin + plans + servers
npm run db:studio   # open Prisma Studio
```
