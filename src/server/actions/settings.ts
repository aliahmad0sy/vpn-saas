'use server';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { requireUser } from '@/server/guards';
import { signOut } from '@/server/auth';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(80),
});

export async function updateProfileAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse({ name: formData.get('name') });
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'Invalid input');

  await prisma.user.update({
    where: { id: user.id },
    data: { name: parsed.data.name },
  });
  await audit({
    userId: user.id,
    action: 'user.profile.updated',
    resource: 'user',
    resourceId: user.id,
  });
  revalidatePath('/dashboard/settings');
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters')
      .max(128, 'Password is too long'),
    confirmPassword: z.string().min(1),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'New password and confirmation do not match',
    path: ['confirmPassword'],
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: 'New password must differ from the current one',
    path: ['newPassword'],
  });

export async function changePasswordAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword'),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? 'Invalid input');
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.passwordHash) throw new Error('Password authentication is not enabled on this account');

  const valid = await bcrypt.compare(parsed.data.currentPassword, dbUser.passwordHash);
  if (!valid) throw new Error('Current password is incorrect');

  const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash },
  });
  await audit({
    userId: user.id,
    action: 'user.password.changed',
    resource: 'user',
    resourceId: user.id,
  });
  revalidatePath('/dashboard/settings');
}

export async function deleteAccountAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const confirm = String(formData.get('confirm') ?? '');
  if (confirm.trim().toLowerCase() !== 'delete my account') {
    throw new Error('Type "delete my account" to confirm');
  }

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'user.account.deleted',
      resource: 'user',
      resourceId: user.id,
    },
  });
  await prisma.user.delete({ where: { id: user.id } });
  await signOut({ redirectTo: '/' });
}
