import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, ADMIN_PASSWORD, ADMIN_TOKEN } from '@/lib/licencias-auth';

export async function POST(request: Request) {
  try {
    const { password } = (await request.json()) as { password: string };
    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 });
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
