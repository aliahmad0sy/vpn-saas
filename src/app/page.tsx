import Link from 'next/link';
import { MapPin, ShieldCheck, Cpu, Activity } from 'lucide-react';
import { MarketingNavbar } from '@/components/marketing/navbar';
import { MarketingFooter } from '@/components/marketing/footer';
import { Hero } from '@/components/marketing/hero';
import { PricingGrid, type PricingPlan } from '@/components/marketing/pricing-grid';
import { Button } from '@/components/ui/button';
import { prisma } from '@/lib/prisma';

export const revalidate = 60;

const tierOrder = ['FREE', 'BASIC', 'PRO', 'ENTERPRISE'] as const;

export default async function HomePage() {
  const [plans, servers] = await Promise.all([
    prisma.plan
      .findMany({ where: { active: true } })
      .catch(() => [])
      .then((rows) => rows.sort((a, b) => tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier))),
    prisma.server.findMany({ where: { status: 'ONLINE' }, take: 6 }).catch(() => []),
  ]);

  const pricingPlans: PricingPlan[] = plans.map((p) => ({
    id: p.id,
    tier: p.tier,
    name: p.name,
    description: p.description,
    priceMonthly: p.priceMonthly,
    features: p.features,
    highlight: p.tier === 'PRO',
    cta: {
      href: p.tier === 'FREE' ? '/register' : '/pricing',
      label: p.tier === 'FREE' ? 'Start free' : 'Choose plan',
    },
  }));

  return (
    <>
      <MarketingNavbar />
      <main>
        <Hero />

        <section id="features" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Why ShieldVPN</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300">
              Built on WireGuard. Designed for teams that care about speed, security, and a UX that
              just works.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: ShieldCheck, title: 'Modern crypto', body: 'ChaCha20-Poly1305 + Curve25519. No legacy protocols.' },
              { icon: Cpu, title: 'Lean kernel module', body: 'WireGuard is just ~4k LOC — auditable and fast.' },
              { icon: Activity, title: 'Real-time status', body: 'Per-server load and health visible at a glance.' },
              { icon: MapPin, title: 'Global presence', body: 'Pick from servers across three continents.' },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <f.icon className="h-6 w-6 text-brand-600" />
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="servers" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Global server network</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300">
              Low-latency endpoints on every major continent. More launching soon.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {servers.length === 0 && (
              <p className="col-span-full text-center text-sm text-slate-500">
                Server list loads after the database is seeded. Run <code>npm run db:seed</code>.
              </p>
            )}
            {servers.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{s.location}</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  online
                </span>
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Simple, fair pricing</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300">
              Cancel any time. Switch plans in one click.
            </p>
          </div>
          <div className="mt-12">
            {pricingPlans.length > 0 ? (
              <PricingGrid plans={pricingPlans} />
            ) : (
              <p className="text-center text-sm text-slate-500">
                Pricing loads after the database is seeded.
              </p>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 p-10 text-center text-white shadow-xl">
            <h2 className="text-3xl font-bold">Ready to lock down your traffic?</h2>
            <p className="mt-2 text-brand-100">Spin up your first tunnel in under 60 seconds.</p>
            <div className="mt-6">
              <Link href="/register">
                <Button size="lg" variant="secondary">
                  Create your account
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
