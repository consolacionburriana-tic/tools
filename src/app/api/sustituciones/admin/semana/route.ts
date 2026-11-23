// La semana de Sustituciones: ?lunes=YYYY-MM-DD&vista=EI|EP|ESO|infantil-primaria|todas.
import { NextResponse } from 'next/server';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { vistaActiva } from '@/lib/jefaturas-server';
import { hoyEnEspana } from '@/lib/oratorios';
import { esVistaSemana, lunesDe } from '@/lib/sustituciones';
import { respuestaError } from '@/lib/sustituciones-api';
import { datosSemana } from '@/lib/sustituciones-semana-server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await requireModule('sustituciones');
  if (isGuardResponse(user)) return user;
  try {
    const url = new URL(request.url);
    const pedido = url.searchParams.get('lunes');
    const hoy = hoyEnEspana();
    const lunes = lunesDe(pedido && /^\d{4}-\d{2}-\d{2}$/.test(pedido) ? pedido : hoy);
    const v = url.searchParams.get('vista');
    const vista = esVistaSemana(v) ? v : (await vistaActiva(user.email)).vista;
    return NextResponse.json(await datosSemana(lunes, vista, hoy));
  } catch (e) {
    return respuestaError(e, 'cargar la semana');
  }
}
