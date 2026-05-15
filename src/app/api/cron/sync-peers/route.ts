import { NextRequest, NextResponse } from 'next/server';
import { ensureCronAuth } from '@/lib/cron-auth';
import { processPendingSyncJobs } from '@/server/services/vpn-manager';
import { handleApiError } from '@/lib/api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const denied = ensureCronAuth(req);
  if (denied) return denied;
  try {
    const summary = await processPendingSyncJobs();
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    return handleApiError(err);
  }
}

// Allow GET so it can be wired into hosts that only support GET cron pings.
export const GET = POST;
