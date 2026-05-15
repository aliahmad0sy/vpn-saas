import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateLimit, clientKeyFromRequest } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  const limit = rateLimit(clientKeyFromRequest(req, 'api:servers'));
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
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
}
