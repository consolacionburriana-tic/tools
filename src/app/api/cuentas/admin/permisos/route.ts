import { NextResponse } from 'next/server';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { comprobarPermisos } from '@/lib/cuentas-google';
import { buzonAdmin, googleConfigurado } from '@/lib/google-sa';

export const dynamic = 'force-dynamic';

// Qué le falta a la delegación de la cuenta de servicio para este módulo.
export async function GET() {
  const user = await requireModule('cuentas');
  if (isGuardResponse(user)) return user;
  if (!googleConfigurado()) return NextResponse.json({ error: 'No hay cuenta de servicio de Google configurada' }, { status: 500 });
  const admin = buzonAdmin(user.email);
  return NextResponse.json({ admin, comprobaciones: await comprobarPermisos(admin) });
}
