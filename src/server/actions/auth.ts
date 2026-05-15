'use server';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { signIn, signOut } from '@/server/auth';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';

const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export type ActionState = { ok: boolean; error?: string };

export async function registerAction(_prev: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' };
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return { ok: false, error: 'An account with that email already exists' };

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
    },
  });

  await audit({ userId: user.id, action: 'user.register', resource: 'user', resourceId: user.id });

  await signIn('credentials', {
    email: parsed.data.email,
    password: parsed.data.password,
    redirect: false,
  });

  redirect('/dashboard');
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function loginAction(_prev: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { ok: false, error: 'Invalid email or password' };

  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch {
    return { ok: false, error: 'Invalid email or password' };
  }

  redirect('/dashboard');
}

export async function logoutAction() {
  await signOut({ redirectTo: '/' });
}
