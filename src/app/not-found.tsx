import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <p className="text-sm font-medium text-brand-600">404</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Page not found</h1>
        <p className="mt-2 text-slate-500">The page you’re looking for doesn’t exist or was moved.</p>
        <div className="mt-6">
          <Link href="/">
            <Button>Back to home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
