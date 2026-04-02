import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow static assets — images, fonts, etc.
  if (/\.(?:png|jpe?g|gif|webp|svg|ico|bmp|avif|woff2?|ttf|otf|eot|css|js|map)$/i.test(pathname)) {
    return NextResponse.next();
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
  ];

  const isPublic = publicPaths.some(path => pathname.startsWith(path));
  if (isPublic) return NextResponse.next();

  // Check for auth token in cookie
  const token = request.cookies.get('token')?.value;

  if (!token) {
    // For API routes, return 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // For pages, redirect to login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    // Token expired or invalid
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Token expired' }, { status: 401 });
    }
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('token');
    return response;
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
