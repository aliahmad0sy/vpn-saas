import { NextRequest, NextResponse } from 'next/server';
import { env } from './env';
import { constantTimeEqual } from './crypto';

/**
 * Returns null if the request carries a valid `Authorization: Bearer <CRON_SECRET>`
 * header, or a 401 NextResponse otherwise. Constant-time compare prevents
 * timing-based recovery of the secret.
 */
export function ensureCronAuth(req: NextRequest): NextResponse | null {
  const header = req.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const presented = match?.[1] ?? '';
  if (!presented || !constantTimeEqual(presented, env.CRON_SECRET)) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Invalid cron token' } },
      { status: 401 },
    );
  }
  return null;
}
