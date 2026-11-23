// La semana del calendario de Sustituciones: ?lunes=YYYY-MM-DD&grupo=infantil-primaria|eso|todas.
import { NextResponse } from 'next/server';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { esClaveJefatura, etapasActivas } from '@/lib/jefaturas-server';
import { hoyEnEspana } from '@/lib/oratorios';
import { etapasDeGrupo, lunesDe } from '@/lib/sustituciones';
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
    const grupo = url.searchParams.get('grupo');
    const etapas = grupo === 'todas' ? etapasDeGrupo(null) : esClaveJefatura(grupo) ? etapasDeGrupo(grupo) : (await etapasActivas(user.email)).etapas;
    return NextResponse.json(await datosSemana(lunes, etapas, hoy));
  } catch (e) {
    return respuestaError(e, 'cargar la semana');
  }
}
