import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Enqueue a peer-add job for the given VPN config. Idempotent: if a PENDING
 * job already exists for this peer + action, skip.
 */
export async function enqueuePeerAdd(vpnConfigId: string): Promise<void> {
  const config = await prisma.vpnConfig.findUnique({
    where: { id: vpnConfigId },
    select: { id: true, serverId: true, publicKey: true },
  });
  if (!config) return;

  await prisma.peerSyncJob.create({
    data: {
      serverId: config.serverId,
      vpnConfigId: config.id,
      publicKey: config.publicKey,
      action: 'ADD',
    },
  });
}

export async function enqueuePeerRemove(vpnConfigId: string): Promise<void> {
  const config = await prisma.vpnConfig.findUnique({
    where: { id: vpnConfigId },
    select: { id: true, serverId: true, publicKey: true },
  });
  if (!config) return;

  await prisma.peerSyncJob.create({
    data: {
      serverId: config.serverId,
      vpnConfigId: config.id,
      publicKey: config.publicKey,
      action: 'REMOVE',
    },
  });
}

/**
 * Auto-revoke any ACTIVE configs whose expiresAt is in the past, and enqueue
 * remote peer removal for each. Returns the count revoked.
 */
export async function revokeExpiredConfigs(now: Date = new Date()): Promise<number> {
  const expired = await prisma.vpnConfig.findMany({
    where: { status: 'ACTIVE', expiresAt: { lte: now } },
    select: { id: true, serverId: true, publicKey: true },
  });

  if (expired.length === 0) return 0;

  await prisma.$transaction([
    prisma.vpnConfig.updateMany({
      where: { id: { in: expired.map((c) => c.id) } },
      data: { status: 'REVOKED' },
    }),
    prisma.peerSyncJob.createMany({
      data: expired.map((c) => ({
        serverId: c.serverId,
        vpnConfigId: c.id,
        publicKey: c.publicKey,
        action: 'REMOVE' as const,
      })),
    }),
  ]);

  logger.info({ count: expired.length }, 'Expired VPN configs revoked');
  return expired.length;
}

/**
 * Also revoke configs whose owner has no active subscription anymore (e.g.
 * Stripe sub canceled before expiresAt was set). Cheap safety net for the
 * cron sweep.
 */
export async function revokeConfigsWithoutActiveSubscription(): Promise<number> {
  const candidates = await prisma.vpnConfig.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      serverId: true,
      publicKey: true,
      user: {
        select: {
          subscriptions: {
            where: { status: { in: ['ACTIVE', 'TRIALING'] } },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  });

  const orphans = candidates.filter((c) => c.user.subscriptions.length === 0);
  if (orphans.length === 0) return 0;

  await prisma.$transaction([
    prisma.vpnConfig.updateMany({
      where: { id: { in: orphans.map((c) => c.id) } },
      data: { status: 'REVOKED' },
    }),
    prisma.peerSyncJob.createMany({
      data: orphans.map((c) => ({
        serverId: c.serverId,
        vpnConfigId: c.id,
        publicKey: c.publicKey,
        action: 'REMOVE' as const,
      })),
    }),
  ]);

  logger.info({ count: orphans.length }, 'Configs without active subscription revoked');
  return orphans.length;
}
