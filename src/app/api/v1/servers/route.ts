import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateLimit, clientKeyFromRequest } from '@/lib/rate-limit';
import { handleApiError, jsonError } from '@/lib/api-error';

export async function GET(req: NextRequest) {
  try {
    const limit = rateLimit(clientKeyFromRequest(req, 'api:servers'));
    if (!limit.success) {
      return jsonError(429, 'rate_limited', 'Too many requests');
    }

    const servers = await prisma.server.findMany({
      where: { status: 'ONLINE' },
      select: {
        id: true,
        name: true,
        location: true,
        country: true,
        load: true,
        capacity: true,
        premiumOnly: true,
      },
      orderBy: [{ country: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json({ servers });
  } catch (err) {
    return handleApiError(err);
  }
}
