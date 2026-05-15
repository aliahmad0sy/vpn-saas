'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/guards';
import { generateKeypair, generatePresharedKey, nextClientAddress } from '@/lib/wireguard';
import { encrypt } from '@/lib/crypto';
import { audit } from '@/lib/audit';
import { enqueuePeerAdd, enqueuePeerRemove } from '@/server/services/vpn-manager';

const createSchema = z.object({
  serverId: z.string().min(1),
  name: z.string().min(1).max(64),
});

export async function createVpnConfigAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = createSchema.safeParse({
    serverId: formData.get('serverId'),
    name: formData.get('name'),
  });
  if (!parsed.success) throw new Error('Please choose a server and name.');

  const subscription = await prisma.subscription.findFirst({
    where: {
      userId: user.id,
      status: { in: ['ACTIVE', 'TRIALING'] },
    },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!subscription) throw new Error('An active subscription is required to add a device.');

  const deviceCount = await prisma.vpnConfig.count({
    where: { userId: user.id, status: 'ACTIVE' },
  });
  if (deviceCount >= subscription.plan.maxDevices) {
    throw new Error(
      `Your ${subscription.plan.name} plan allows ${subscription.plan.maxDevices} active devices.`,
    );
  }

  const server = await prisma.server.findUnique({ where: { id: parsed.data.serverId } });
  if (!server) throw new Error('Server not found');
  if (server.status !== 'ONLINE') throw new Error('Server is currently unavailable');
  if (server.premiumOnly && subscription.plan.tier === 'BASIC') {
    throw new Error('This server is available on Pro and Enterprise plans.');
  }

  const taken = await prisma.vpnConfig.findMany({
    where: { serverId: server.id },
    select: { address: true },
  });
  const address = nextClientAddress(
    server.subnetCidr,
    taken.map((t) => t.address),
  );

  const keys = generateKeypair();
  const psk = generatePresharedKey();

  // Honor the active subscription's period end as the default config expiry
  // so cancelled/expired subs auto-disable. Trial users get trial_end.
  const expiresAt = subscription.trialEnd ?? subscription.currentPeriodEnd ?? null;

  const config = await prisma.vpnConfig.create({
    data: {
      userId: user.id,
      serverId: server.id,
      name: parsed.data.name,
      publicKey: keys.publicKey,
      privateKey: encrypt(keys.privateKey),
      presharedKey: encrypt(psk),
      address,
      expiresAt,
    },
  });

  await enqueuePeerAdd(config.id);

  await audit({
    userId: user.id,
    action: 'vpn.config.created',
    resource: 'vpn_config',
    resourceId: config.id,
    metadata: { serverId: server.id, name: config.name },
  });

  revalidatePath('/dashboard');
}

const revokeSchema = z.object({ configId: z.string().min(1) });

export async function revokeVpnConfigAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = revokeSchema.safeParse({ configId: formData.get('configId') });
  if (!parsed.success) throw new Error('Invalid config');

  const config = await prisma.vpnConfig.findUnique({ where: { id: parsed.data.configId } });
  if (!config || config.userId !== user.id) throw new Error('Not found');

  await prisma.vpnConfig.update({
    where: { id: config.id },
    data: { status: 'REVOKED' },
  });
  await enqueuePeerRemove(config.id);

  await audit({
    userId: user.id,
    action: 'vpn.config.revoked',
    resource: 'vpn_config',
    resourceId: config.id,
  });

  revalidatePath('/dashboard');
}
