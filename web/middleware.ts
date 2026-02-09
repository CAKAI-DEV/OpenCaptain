import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register', '/magic-link', '/api/auth'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Allow static assets and Next.js internals
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.includes('.')) {
    return NextResponse.next();
  }

  // Check for auth cookie
  const token = request.cookies.get('access_token')?.value;

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // For API proxy requests, rewrite to the backend and inject the access token
  // as Authorization header. We do this in middleware (not next.config.ts rewrites)
  // because standalone builds bake config rewrites at build time, but middleware
  // runs at runtime and can read runtime env vars like API_URL.
  if (pathname.startsWith('/api/v1/')) {
    const apiUrl = process.env.API_URL || 'http://localhost:3000';
    const url = new URL(`${apiUrl}${pathname}${request.nextUrl.search}`);
    const headers = new Headers(request.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return NextResponse.rewrite(url, {
      request: { headers },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
