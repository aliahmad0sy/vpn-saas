import { NextRequest, NextResponse } from 'next/server';
import { ensureCronAuth } from '@/lib/cron-auth';
import {
  revokeExpiredConfigs,
  revokeConfigsWithoutActiveSubscription,
} from '@/server/services/vpn-manager';
import { handleApiError } from '@/lib/api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const denied = ensureCronAuth(req);
  if (denied) return denied;
  try {
    const expired = await revokeExpiredConfigs();
    const orphaned = await revokeConfigsWithoutActiveSubscription();
    return NextResponse.json({ ok: true, expired, orphaned });
  } catch (err) {
    return handleApiError(err);
  }
}

export const GET = POST;
