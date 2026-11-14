import { NextResponse } from 'next/server';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { PeticionPropuesta } from '@/lib/sustituciones';
import { respuestaError } from '@/lib/sustituciones-api';
import { propuesta } from '@/lib/sustituciones-server';

export const dynamic = 'force-dynamic';

/** Las horas del profe en esas fechas y a quién mandar a cada una. No escribe nada. */
export async function POST(request: Request) {
  const user = await requireModule('sustituciones');
  if (isGuardResponse(user)) return user;
  try {
    const p = PeticionPropuesta.parse(await request.json());
    return NextResponse.json(await propuesta(p.profeId, p.desde, p.hasta, p.excluirAusencia));
  } catch (e) {
    return respuestaError(e, 'preparar la propuesta');
  }
}
