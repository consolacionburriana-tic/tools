import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { respuestaError } from '@/lib/sustituciones-api';
import { listarDia } from '@/lib/sustituciones-server';

export const dynamic = 'force-dynamic';

/** Las horas de ausencias de un día (`?fecha=`), por hora: la pantalla «Hoy» al cambiar de día. */
export async function GET(request: Request) {
  const user = await requireModule('sustituciones');
  if (isGuardResponse(user)) return user;
  try {
    const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida').parse(new URL(request.url).searchParams.get('fecha'));
    return NextResponse.json(await listarDia(fecha));
  } catch (e) {
    return respuestaError(e, 'leer el día');
  }
}
