import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED_PREFIXES = ['/dashboard', '/admin', '/account'];

function safeRedirectPath(input: string | null | undefined): string {
  // Only allow same-origin path-style callbacks. Anything fancy goes home.
  if (!input) return '/dashboard';
  if (!input.startsWith('/') || input.startsWith('//')) return '/dashboard';
  if (input.length > 512) return '/dashboard';
  return input;
}

function applySecurityHeaders(res: NextResponse, nonce: string) {
  const isDev = process.env.NODE_ENV !== 'production';
  // Next.js inline runtime requires either 'unsafe-inline' (dev/HMR) or a nonce strategy.
  // We use a nonce in prod for script-src and rely on Tailwind's static stylesheet
  // (style-src remains 'unsafe-inline' because Next inlines critical CSS at build time).
  const scriptSrc = isDev
    ? "'self' 'unsafe-inline' 'unsafe-eval'"
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`;

  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.stripe.com",
    "frame-src https://js.stripe.com https://hooks.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');

  res.headers.set('Content-Security-Policy', csp);
  res.headers.set('X-DNS-Prefetch-Control', 'on');
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.headers.set('X-Nonce', nonce);
  return res;
}

function makeNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64');
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const nonce = makeNonce();

  const needsAuth = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  if (needsAuth) {
    const sessionCookie =
      req.cookies.get('authjs.session-token') ?? req.cookies.get('__Secure-authjs.session-token');

    if (!sessionCookie) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('callbackUrl', safeRedirectPath(pathname));
      return applySecurityHeaders(NextResponse.redirect(url), nonce);
    }
  }

  const res = NextResponse.next({
    request: { headers: new Headers(req.headers) },
  });
  return applySecurityHeaders(res, nonce);
}

export const config = {
  // Run on every route except Next internals, static assets, and the Stripe
  // webhook (which we must not modify — the raw body has to be byte-exact for
  // signature verification, and we don't want CSP nonces interfering).
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks/.*|api/auth/.*).*)',
  ],
};
