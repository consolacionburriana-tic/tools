import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_TOKEN } from '@/lib/licencias-auth';

export async function POST(request: Request) {
  try {
    const { email, password } = (await request.json()) as { email: string; password: string };
    const ok =
      (email ?? '').trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD;
    if (!ok) {
      return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_COOKIE, ADMIN_TOKEN, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8,
    });
    return res;
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
