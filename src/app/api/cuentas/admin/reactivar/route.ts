import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { reactivarSchema } from '@/lib/cuentas';
import { reactivarCuentas } from '@/lib/cuentas-server';
import { buzonAdmin } from '@/lib/google-sa';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  const user = await requireModule('cuentas');
  if (isGuardResponse(user)) return user;
  let datos: z.infer<typeof reactivarSchema>;
  try {
    datos = reactivarSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Datos incorrectos' }, { status: 400 });
  }
  try {
    return NextResponse.json({ resultados: await reactivarCuentas(buzonAdmin(user.email), datos.ids, datos.aSuSitio, user.email) });
  } catch (error) {
    console.error('Cuentas: error reactivando:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Error reactivando las cuentas' }, { status: 500 });
  }
}
