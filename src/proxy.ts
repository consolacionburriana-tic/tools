import { NextResponse } from 'next/server';
import { auth } from '@/auth';

// Protege las zonas con login (Next 16: proxy.ts, antes middleware). La autorización
// fina por módulo/rol se hace en layouts y route handlers con canAccess/requireModule;
// aquí solo se exige sesión.
export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/gestion/login')) return NextResponse.next();

  if (!req.auth?.user) {
    const url = req.nextUrl.clone();
    url.pathname = '/gestion/login';
    url.search = `?volver=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ['/gestion', '/gestion/:path*', '/admin', '/admin/:path*', '/registro-abc', '/registro-abc/:path*'],
};
