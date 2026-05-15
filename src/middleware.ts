import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED_PREFIXES = ['/dashboard', '/admin', '/account'];
const ADMIN_PREFIXES = ['/admin'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const needsAuth = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!needsAuth) return NextResponse.next();

  const sessionCookie =
    req.cookies.get('authjs.session-token') ?? req.cookies.get('__Secure-authjs.session-token');

  if (!sessionCookie) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  // Admin-specific gate handled in the page server component (we don't decode the JWT here
  // to keep the middleware edge-runtime-friendly without bundling crypto secrets).
  if (ADMIN_PREFIXES.some((p) => pathname.startsWith(p))) {
    // Pass through — server component will verify role and 404/redirect if not admin.
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/account/:path*'],
};
