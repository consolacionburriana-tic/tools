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
  // Ojo con Puntualidad: se protege el formulario (`/puntualidad`) pero NO
  // `/puntualidad/consecuencia/<token>`, que es el enlace de un clic del correo al tutor y
  // vive sin login a propósito (el token es la credencial y solo abre esa consecuencia).
  matcher: [
    '/gestion',
    '/gestion/:path*',
    '/admin',
    '/admin/:path*',
    '/registro-abc',
    '/registro-abc/:path*',
    '/puntualidad',
  ],
};
