import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { prisma } from '@/lib/prisma';
import { buildWireGuardConfig, configToQrDataUrl } from '@/lib/wireguard';
import { rateLimit, clientKeyFromRequest } from '@/lib/rate-limit';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const limit = rateLimit(clientKeyFromRequest(req, 'api:config'));
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  const config = await prisma.vpnConfig.findUnique({
    where: { id },
    include: { server: true },
  });
  if (!config || config.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (config.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Config revoked' }, { status: 410 });
  }

  const text = buildWireGuardConfig({
    clientPrivateKey: config.privateKey,
    clientAddress: config.address,
    dns: config.server.dns,
    serverPublicKey: config.server.publicKey,
    serverEndpoint: config.server.endpoint,
    allowedIps: config.server.allowedIps,
    presharedKey: config.presharedKey,
  });

  const format = new URL(req.url).searchParams.get('format');
  if (format === 'qr') {
    const dataUrl = await configToQrDataUrl(text);
    return NextResponse.json({ qr: dataUrl });
  }
  if (format === 'file') {
    const filename = `${config.name.replace(/[^a-z0-9-_]/gi, '_')}.conf`;
    return new NextResponse(text, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  }
  return NextResponse.json({ config: text });
}
