import { NextResponse } from 'next/server';
import { ADMIN_COOKIE } from '@/lib/licencias-auth';

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const res = NextResponse.redirect(`${origin}/gestion/login`, { status: 303 });
  res.cookies.set(ADMIN_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
