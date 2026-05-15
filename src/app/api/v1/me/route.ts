import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit, clientKeyFromRequest } from '@/lib/rate-limit';
import { ApiError, handleApiError, jsonError } from '@/lib/api-error';

export async function GET(req: NextRequest) {
  try {
    const limit = rateLimit(clientKeyFromRequest(req, 'api:me'));
    if (!limit.success) {
      return jsonError(429, 'rate_limited', 'Too many requests', undefined, {
        'Retry-After': String(Math.ceil((limit.reset - Date.now()) / 1000)),
        'X-RateLimit-Limit': String(limit.limit),
        'X-RateLimit-Remaining': '0',
      });
    }

    const session = await auth();
    if (!session?.user?.id) {
      throw new ApiError(401, 'unauthorized', 'Authentication required');
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        subscriptions: {
          where: { status: { in: ['ACTIVE', 'TRIALING'] } },
          select: {
            id: true,
            status: true,
            currentPeriodEnd: true,
            cancelAtPeriodEnd: true,
            plan: { select: { name: true, tier: true, maxDevices: true } },
          },
        },
      },
    });

    if (!user) throw new ApiError(404, 'not_found', 'User not found');

    return NextResponse.json(
      { user },
      {
        headers: {
          'X-RateLimit-Limit': String(limit.limit),
          'X-RateLimit-Remaining': String(limit.remaining),
        },
      },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
