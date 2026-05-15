'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/server/guards';
import { audit } from '@/lib/audit';

const upsertServerSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  location: z.string().min(1),
  country: z.string().length(2),
  hostname: z.string().min(1),
  endpoint: z.string().min(1),
  publicKey: z.string().min(1),
  subnetCidr: z.string().min(1),
  premiumOnly: z.union([z.literal('on'), z.string().optional()]),
});

export async function upsertServerAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const parsed = upsertServerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'Invalid input');

  const data = {
    name: parsed.data.name,
    location: parsed.data.location,
    country: parsed.data.country.toUpperCase(),
    hostname: parsed.data.hostname,
    endpoint: parsed.data.endpoint,
    publicKey: parsed.data.publicKey,
    subnetCidr: parsed.data.subnetCidr,
    premiumOnly: parsed.data.premiumOnly === 'on',
  };

  const server = parsed.data.id
    ? await prisma.server.update({ where: { id: parsed.data.id }, data })
    : await prisma.server.create({ data });

  await audit({
    userId: admin.id,
    action: parsed.data.id ? 'admin.server.updated' : 'admin.server.created',
    resource: 'server',
    resourceId: server.id,
  });

  revalidatePath('/admin/servers');
}

const setStatusSchema = z.object({
  serverId: z.string().min(1),
  status: z.enum(['ONLINE', 'OFFLINE', 'MAINTENANCE']),
});

export async function setServerStatusAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const parsed = setStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error('Invalid input');
  await prisma.server.update({
    where: { id: parsed.data.serverId },
    data: { status: parsed.data.status },
  });
  await audit({
    userId: admin.id,
    action: 'admin.server.status_changed',
    resource: 'server',
    resourceId: parsed.data.serverId,
    metadata: { status: parsed.data.status },
  });
  revalidatePath('/admin/servers');
}

const setRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['USER', 'ADMIN']),
});

export async function setUserRoleAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const parsed = setRoleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error('Invalid input');

  if (parsed.data.userId === admin.id && parsed.data.role !== 'ADMIN') {
    throw new Error('You cannot demote yourself.');
  }

  await prisma.user.update({
    where: { id: parsed.data.userId },
    data: { role: parsed.data.role },
  });
  await audit({
    userId: admin.id,
    action: 'admin.user.role_changed',
    resource: 'user',
    resourceId: parsed.data.userId,
    metadata: { role: parsed.data.role },
  });
  revalidatePath('/admin/users');
}
