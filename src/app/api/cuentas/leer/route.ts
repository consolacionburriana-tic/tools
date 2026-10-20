import { NextResponse } from 'next/server';
import { isGuardResponse, requireAlgunModulo } from '@/lib/auth-guards';
import { estadoCuentas, leerDeGoogle } from '@/lib/cuentas-server';
import { buzonAdmin, explicarError, googleConfigurado } from '@/lib/google-sa';
import { canAccess } from '@/lib/permissions';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Rehace la foto desde Google. Leer exige suplantar a un administrador: TIC lo es; quien
// solo ve (secretaría) puede refrescar si hay un buzón de administrador fijo en el entorno.
export async function POST() {
  const user = await requireAlgunModulo(['cuentas', 'cuentas-ver']);
  if (isGuardResponse(user)) return user;
  if (!canAccess(user, 'cuentas') && !process.env.GOOGLE_ADMIN_BUZON) {
    return NextResponse.json({ error: 'Solo TIC puede leer de Google' }, { status: 403 });
  }
  if (!googleConfigurado()) return NextResponse.json({ error: 'No hay cuenta de servicio de Google configurada' }, { status: 500 });
  try {
    const { avisos } = await leerDeGoogle(buzonAdmin(user.email));
    return NextResponse.json({ avisos, estado: await estadoCuentas() });
  } catch (error) {
    console.error('Cuentas: error leyendo de Google:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: explicarError(error) }, { status: 502 });
  }
}
