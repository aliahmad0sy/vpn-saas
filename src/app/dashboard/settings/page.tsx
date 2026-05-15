import { requireUser } from '@/server/guards';
import { prisma } from '@/lib/prisma';
import { Card } from '@/components/ui/card';
import { ProfileForm } from './profile-form';
import { PasswordForm } from './password-form';
import { DangerZone } from './danger-zone';

export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const user = await requireUser();
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, name: true, createdAt: true },
  });
  if (!dbUser) throw new Error('User not found');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-slate-500">Manage your profile, password, and account.</p>
      </div>

      <Card>
        <h2 className="text-lg font-semibold">Profile</h2>
        <p className="mt-1 text-sm text-slate-500">
          Your display name. Email is fixed and used for sign-in.
        </p>
        <div className="mt-4">
          <ProfileForm initialName={dbUser.name ?? ''} email={dbUser.email} />
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Password</h2>
        <p className="mt-1 text-sm text-slate-500">
          Choose a strong password. We&apos;ll sign you out of other sessions after changing it.
        </p>
        <div className="mt-4">
          <PasswordForm />
        </div>
      </Card>

      <Card className="border-red-200 dark:border-red-900/60">
        <h2 className="text-lg font-semibold text-red-700 dark:text-red-300">Danger zone</h2>
        <p className="mt-1 text-sm text-slate-500">
          Deleting your account is permanent. All your VPN configs will be revoked immediately.
        </p>
        <div className="mt-4">
          <DangerZone />
        </div>
      </Card>
    </div>
  );
}
