import { LRUCache } from 'lru-cache';
import { env } from './env';

type Entry = { count: number; resetAt: number };

const cache = new LRUCache<string, Entry>({
  max: 10_000,
  ttl: env.RATE_LIMIT_WINDOW_MS,
});

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

export function rateLimit(key: string, max = env.RATE_LIMIT_MAX): RateLimitResult {
  const now = Date.now();
  const existing = cache.get(key);

  if (!existing || existing.resetAt < now) {
    const resetAt = now + env.RATE_LIMIT_WINDOW_MS;
    cache.set(key, { count: 1, resetAt });
    return { success: true, limit: max, remaining: max - 1, reset: resetAt };
  }

  existing.count += 1;
  const success = existing.count <= max;
  return {
    success,
    limit: max,
    remaining: Math.max(0, max - existing.count),
    reset: existing.resetAt,
  };
}

export function clientKeyFromRequest(req: Request, scope = 'global'): string {
  const fwd = req.headers.get('x-forwarded-for');
  const ip = fwd?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  return `${scope}:${ip}`;
}
