import { requireAdmin } from '@/server/guards';
import { prisma } from '@/lib/prisma';
import { Sidebar } from '@/components/app-shell/sidebar';
import { Topbar } from '@/components/app-shell/topbar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const db = await prisma.user.findUnique({
    where: { id: admin.id },
    select: { email: true, name: true, role: true },
  });
  return (
    <div className="flex min-h-screen">
      <Sidebar role="ADMIN" />
      <div className="flex flex-1 flex-col">
        <Topbar
          user={{
            email: db?.email ?? admin.email!,
            name: db?.name ?? admin.name ?? null,
            role: 'ADMIN',
          }}
        />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
