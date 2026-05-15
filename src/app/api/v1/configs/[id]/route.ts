import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { prisma } from '@/lib/prisma';
import { buildWireGuardConfig, configToQrDataUrl } from '@/lib/wireguard';
import { decrypt } from '@/lib/crypto';
import { rateLimit, clientKeyFromRequest } from '@/lib/rate-limit';
import { ApiError, handleApiError, jsonError } from '@/lib/api-error';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const limit = rateLimit(clientKeyFromRequest(req, 'api:config'));
    if (!limit.success) return jsonError(429, 'rate_limited', 'Too many requests');

    const session = await auth();
    if (!session?.user?.id) throw new ApiError(401, 'unauthorized', 'Authentication required');

    const { id } = await params;
    const config = await prisma.vpnConfig.findUnique({
      where: { id },
      include: { server: true },
    });
    if (!config || config.userId !== session.user.id) {
      throw new ApiError(404, 'not_found', 'Config not found');
    }
    if (config.status !== 'ACTIVE') {
      throw new ApiError(410, 'revoked', 'Config has been revoked');
    }

    const text = buildWireGuardConfig({
      clientPrivateKey: decrypt(config.privateKey),
      clientAddress: config.address,
      dns: config.server.dns,
      serverPublicKey: config.server.publicKey,
      serverEndpoint: config.server.endpoint,
      allowedIps: config.server.allowedIps,
      presharedKey: config.presharedKey ? decrypt(config.presharedKey) : null,
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
  } catch (err) {
    return handleApiError(err);
  }
}
