import { NextResponse } from 'next/server';
import { isGuardResponse, requireAlgunModulo } from '@/lib/auth-guards';
import { estadoCuentas } from '@/lib/cuentas-server';

export const dynamic = 'force-dynamic';

// El cruce Educamos ↔ Google desde la foto de Neon. Lo ven TIC (gestiona) y secretaría (solo ve).
export async function GET() {
  const user = await requireAlgunModulo(['cuentas', 'cuentas-ver']);
  if (isGuardResponse(user)) return user;
  try {
    return NextResponse.json(await estadoCuentas());
  } catch (error) {
    console.error('Cuentas: error leyendo el estado:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'No se puede leer el estado de las cuentas' }, { status: 500 });
  }
}
