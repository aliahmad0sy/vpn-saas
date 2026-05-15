import type { Server, VpnConfig, PeerSyncJob } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { audit } from '@/lib/audit';
import {
  addPeer,
  removePeer,
  fetchPeerStats,
  probeServer,
  SshConfigError,
} from './wireguard-sync';

const MAX_SYNC_ATTEMPTS = 5;
const SYNC_BATCH = 25;

// --- Enqueueing ------------------------------------------------------------

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

// --- Expiration sweep ------------------------------------------------------

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
  for (const c of expired) {
    await audit({
      action: 'vpn.config.auto_expired',
      resource: 'vpn_config',
      resourceId: c.id,
    });
  }
  return expired.length;
}

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
  for (const o of orphans) {
    await audit({
      userId: null,
      action: 'vpn.config.orphan_revoked',
      resource: 'vpn_config',
      resourceId: o.id,
    });
  }
  logger.info({ count: orphans.length }, 'Configs without active subscription revoked');
  return orphans.length;
}

// --- Sync job processing ---------------------------------------------------

export type SyncSummary = {
  attempted: number;
  succeeded: number;
  failed: number;
  skipped: number;
};

async function runJob(
  job: PeerSyncJob,
  server: Server & { wgInterface: string },
  config: VpnConfig | null,
): Promise<void> {
  if (job.action === 'ADD') {
    if (!config) throw new Error('VPN config not found for ADD job');
    await addPeer({
      server,
      peerPublicKey: job.publicKey,
      presharedKeyEncrypted: config.presharedKey,
      clientAddress: config.address,
    });
    await prisma.vpnConfig.update({
      where: { id: config.id },
      data: { lastSyncedAt: new Date() },
    });
  } else {
    await removePeer(server, job.publicKey);
    if (config) {
      await prisma.vpnConfig.update({
        where: { id: config.id },
        data: { lastSyncedAt: new Date() },
      });
    }
  }
}

/**
 * Drains up to SYNC_BATCH pending jobs. Skipping rules:
 * - if a server has no SSH credentials, jobs against it are marked
 *   FAILED with a descriptive error so the admin sees them.
 * - if a job has exceeded MAX_SYNC_ATTEMPTS, mark FAILED.
 */
export async function processPendingSyncJobs(): Promise<SyncSummary> {
  const summary: SyncSummary = { attempted: 0, succeeded: 0, failed: 0, skipped: 0 };

  const jobs = await prisma.peerSyncJob.findMany({
    where: { status: 'PENDING', attempts: { lt: MAX_SYNC_ATTEMPTS } },
    include: { server: true, vpnConfig: true },
    orderBy: { createdAt: 'asc' },
    take: SYNC_BATCH,
  });

  for (const job of jobs) {
    summary.attempted += 1;
    await prisma.peerSyncJob.update({
      where: { id: job.id },
      data: { status: 'RUNNING', startedAt: new Date(), attempts: { increment: 1 } },
    });

    try {
      await runJob(job, job.server, job.vpnConfig);
      await prisma.peerSyncJob.update({
        where: { id: job.id },
        data: { status: 'SUCCEEDED', finishedAt: new Date(), error: null },
      });
      await prisma.server.update({
        where: { id: job.serverId },
        data: { lastSyncedAt: new Date(), lastSyncError: null },
      });
      summary.succeeded += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isConfigError = err instanceof SshConfigError;
      const finalAttempt = job.attempts + 1 >= MAX_SYNC_ATTEMPTS;
      await prisma.peerSyncJob.update({
        where: { id: job.id },
        data: {
          status: isConfigError || finalAttempt ? 'FAILED' : 'PENDING',
          finishedAt: isConfigError || finalAttempt ? new Date() : null,
          error: message,
        },
      });
      await prisma.server.update({
        where: { id: job.serverId },
        data: { lastSyncError: message },
      });
      if (isConfigError) summary.skipped += 1;
      else summary.failed += 1;
      logger.error(
        { jobId: job.id, serverId: job.serverId, action: job.action, err: message },
        'Peer sync job failed',
      );
    }
  }

  return summary;
}

// --- Health probing --------------------------------------------------------

export async function runHealthChecks(): Promise<{ ok: number; failed: number; skipped: number }> {
  const servers = await prisma.server.findMany({});
  let ok = 0;
  let failed = 0;
  let skipped = 0;

  for (const server of servers) {
    if (!server.sshHost) {
      skipped += 1;
      continue;
    }
    try {
      const health = await probeServer(server);
      await prisma.serverHealthCheck.create({
        data: {
          serverId: server.id,
          status: 'ONLINE',
          latencyMs: health.latencyMs,
          peerCount: health.peerCount,
        },
      });
      await prisma.server.update({
        where: { id: server.id },
        data: {
          status: 'ONLINE',
          load: health.peerCount,
          lastHealthyAt: new Date(),
          lastSyncError: null,
        },
      });
      ok += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.serverHealthCheck.create({
        data: {
          serverId: server.id,
          status: 'OFFLINE',
          error: message,
        },
      });
      await prisma.server.update({
        where: { id: server.id },
        data: { status: 'OFFLINE', lastSyncError: message },
      });
      failed += 1;
    }
  }
  return { ok, failed, skipped };
}

// --- Traffic collection ----------------------------------------------------

export async function collectTrafficStats(): Promise<{ servers: number; peers: number }> {
  const servers = await prisma.server.findMany({ where: { sshHost: { not: null } } });
  let serverCount = 0;
  let peerCount = 0;

  for (const server of servers) {
    try {
      const stats = await fetchPeerStats(server);
      serverCount += 1;
      peerCount += stats.length;

      for (const stat of stats) {
        const config = await prisma.vpnConfig.findFirst({
          where: { serverId: server.id, publicKey: stat.publicKey },
          select: { id: true, bytesRxTotal: true, bytesTxTotal: true },
        });
        if (!config) continue;
        await prisma.$transaction([
          prisma.trafficRecord.create({
            data: {
              vpnConfigId: config.id,
              bytesRx: stat.bytesRx,
              bytesTx: stat.bytesTx,
              latestHandshake: stat.latestHandshake,
            },
          }),
          prisma.vpnConfig.update({
            where: { id: config.id },
            data: {
              // wg counters are cumulative since the peer was added, so the
              // running total is just the latest read.
              bytesRxTotal: stat.bytesRx,
              bytesTxTotal: stat.bytesTx,
              lastUsedAt: stat.latestHandshake ?? undefined,
            },
          }),
        ]);
      }
    } catch (err) {
      logger.warn(
        { serverId: server.id, err: err instanceof Error ? err.message : err },
        'Traffic collection failed for server',
      );
    }
  }

  return { servers: serverCount, peers: peerCount };
}
