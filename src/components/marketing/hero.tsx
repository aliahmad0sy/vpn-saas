'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Lock, Zap, Globe2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-60" aria-hidden />
      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-3xl text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            WireGuard-powered · 99.99% uptime
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl dark:text-white">
            Private internet, <span className="gradient-text">at wire speed.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
            ShieldVPN gives you a modern WireGuard tunnel in one click — global servers, instant
            config delivery, and zero-log infrastructure your customers can trust.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link href="/register">
              <Button size="lg">
                Start free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline">
                View pricing
              </Button>
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-3"
        >
          {[
            { icon: Zap, title: 'Wire-fast', body: 'Modern crypto, minimal handshake. Connect in milliseconds.' },
            { icon: Lock, title: 'Zero logs', body: 'We do not log activity, DNS queries, or IP addresses.' },
            { icon: Globe2, title: 'Global presence', body: 'Servers across NA, EU, and APAC with auto-failover.' },
          ].map((f) => (
            <div
              key={f.title}
              className="glass rounded-2xl border border-slate-200/60 p-5 text-left shadow-sm dark:border-slate-800/60"
            >
              <f.icon className="h-5 w-5 text-brand-600" />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{f.body}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
