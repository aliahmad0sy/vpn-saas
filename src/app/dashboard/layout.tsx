import { requireUser } from '@/server/guards';
import { prisma } from '@/lib/prisma';
import { Sidebar } from '@/components/app-shell/sidebar';
import { Topbar } from '@/components/app-shell/topbar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const db = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, name: true, role: true },
  });
  const safeUser = {
    email: db?.email ?? user.email!,
    name: db?.name ?? user.name ?? null,
    role: (db?.role ?? 'USER') as 'USER' | 'ADMIN',
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar role={safeUser.role} />
      <div className="flex flex-1 flex-col">
        <Topbar user={safeUser} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
