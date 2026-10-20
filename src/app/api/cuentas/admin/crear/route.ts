import { NextResponse } from 'next/server';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { crearSchema, type PeticionCrear } from '@/lib/cuentas';
import { crearCuentas } from '@/lib/cuentas-server';
import { buzonAdmin } from '@/lib/google-sa';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Crea cuentas de Google a alumnado y profesorado de Educamos. La contraseña vuelve en la
// respuesta UNA vez: no se guarda en ningún sitio ni va al registro.
export async function POST(request: Request) {
  const user = await requireModule('cuentas');
  if (isGuardResponse(user)) return user;
  let datos: PeticionCrear;
  try {
    datos = crearSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Datos incorrectos' }, { status: 400 });
  }
  try {
    return NextResponse.json({ resultados: await crearCuentas(buzonAdmin(user.email), datos, user.email) });
  } catch (error) {
    console.error('Cuentas: error creando:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Error creando las cuentas' }, { status: 500 });
  }
}
