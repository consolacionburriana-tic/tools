import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ADMIN_COOKIE, ADMIN_TOKEN } from '@/lib/licencias-auth';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // La página de login es pública
  if (pathname.startsWith('/gestion/login')) return NextResponse.next();

  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (token === ADMIN_TOKEN) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/gestion/login';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/gestion', '/gestion/:path*'],
};
