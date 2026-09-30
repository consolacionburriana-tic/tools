import { NextResponse } from 'next/server';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { comprobarPermisos, googleConfigurado } from '@/lib/calendarios-google';
import { buzonAdmin } from '@/lib/calendarios-server';

export const dynamic = 'force-dynamic';

// Qué le falta a la cuenta de servicio para este módulo: una lectura mínima a cada API.
export async function GET() {
  const user = await requireModule('calendarios');
  if (isGuardResponse(user)) return user;
  if (!googleConfigurado()) return NextResponse.json({ error: 'No hay cuenta de servicio de Google configurada' }, { status: 500 });
  const admin = buzonAdmin(user.email);
  return NextResponse.json({ admin, comprobaciones: await comprobarPermisos(admin) });
}
