import { NextResponse } from 'next/server';
import { isGuardResponse, requireAlgunModulo } from '@/lib/auth-guards';
import { leerRegistro } from '@/lib/cuentas-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await requireAlgunModulo(['cuentas', 'cuentas-ver']);
  if (isGuardResponse(user)) return user;
  return NextResponse.json({ registro: await leerRegistro() });
}
