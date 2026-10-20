import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { moverSchema } from '@/lib/cuentas';
import { moverCuentas } from '@/lib/cuentas-server';
import { buzonAdmin } from '@/lib/google-sa';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Cambia de unidad organizativa. Sin `uo`, a la que toca según el cruce (su clase o su archivo).
export async function POST(request: Request) {
  const user = await requireModule('cuentas');
  if (isGuardResponse(user)) return user;
  let datos: z.infer<typeof moverSchema>;
  try {
    datos = moverSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Datos incorrectos' }, { status: 400 });
  }
  try {
    return NextResponse.json({ resultados: await moverCuentas(buzonAdmin(user.email), datos.cuentas, user.email) });
  } catch (error) {
    console.error('Cuentas: error moviendo:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Error moviendo las cuentas' }, { status: 500 });
  }
}
