import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit, clientKeyFromRequest } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  const limit = rateLimit(clientKeyFromRequest(req, 'api:me'));
  if (!limit.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((limit.reset - Date.now()) / 1000)) } },
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

  return NextResponse.json({ user });
}
