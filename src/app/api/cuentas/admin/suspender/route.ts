import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { suspenderSchema } from '@/lib/cuentas';
import { suspenderCuentas } from '@/lib/cuentas-server';
import { buzonAdmin } from '@/lib/google-sa';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Suspende (y archiva, si se pide). Se deshace con «Reactivar».
export async function POST(request: Request) {
  const user = await requireModule('cuentas');
  if (isGuardResponse(user)) return user;
  let datos: z.infer<typeof suspenderSchema>;
  try {
    datos = suspenderSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Datos incorrectos' }, { status: 400 });
  }
  try {
    return NextResponse.json({ resultados: await suspenderCuentas(buzonAdmin(user.email), datos.ids, datos.archivar, user.email) });
  } catch (error) {
    console.error('Cuentas: error suspendiendo:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Error suspendiendo las cuentas' }, { status: 500 });
  }
}
