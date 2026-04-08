import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose/jwt/verify';

/**
 * Build a Content-Security-Policy header value.
 *
 * - script-src allows inline scripts because hydration/runtime scripts and
 *   extension injections were being blocked in production.
 * - 'wasm-unsafe-eval' is required by the Prisma WASM query engine.
 * - style-src uses 'unsafe-inline' because Radix UI / shadcn write inline styles.
 * - frame-ancestors 'none' prevents clickjacking.
 */
function buildCsp(): string {
  const directives = [
    "default-src 'self'",
    // We intentionally avoid nonce here because browsers ignore 'unsafe-inline'
    // when a nonce/hash is present, which was blocking required inline runtime scripts.
    "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' 'inline-speculation-rules' chrome-extension:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ];
  return directives.join('; ');
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow static assets — images, fonts, etc.
  if (/\.(?:png|jpe?g|gif|webp|svg|ico|bmp|avif|woff2?|ttf|otf|eot|css|js|map)$/i.test(pathname)) {
    return NextResponse.next();
  }

  const csp = buildCsp();

  // Forward CSP to the rendering pipeline.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('content-security-policy', csp);

  // Helper: attach CSP to any NextResponse
  function withCsp(res: NextResponse): NextResponse {
    res.headers.set('content-security-policy', csp);
    return res;
  }

  // Always allow public routes — no auth check
  const publicPaths = [
    '/login',
    '/survey',
    '/feedback',
    '/api/auth/login',
    '/api/auth/refresh',
    '/api/health',
    '/api/survey',
    '/api/feedback',
    '/api/campaigns/csv-template',
    '/api/jobs/',
  ];

  const isPublic = publicPaths.some(path => pathname.startsWith(path));
  if (isPublic) {
    return withCsp(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  // Check for auth token in cookie
  const token = request.cookies.get('token')?.value;

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return withCsp(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    }
    return withCsp(NextResponse.redirect(new URL('/login', request.url)));
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(token, secret);
    return withCsp(NextResponse.next({ request: { headers: requestHeaders } }));
  } catch {
    // Token expired or invalid
    if (pathname.startsWith('/api/')) {
      return withCsp(NextResponse.json({ error: 'Token expired' }, { status: 401 }));
    }
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('token');
    return withCsp(response);
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder files (images, fonts, icons, etc.)
     * - api routes that must be public (health, survey, feedback)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|otf|map)).*)',
  ],
};
