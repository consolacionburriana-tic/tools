import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { quienDe, respuestaError } from '@/lib/sustituciones-api';
import { enviarInforme, informeMes } from '@/lib/sustituciones-server';

export const dynamic = 'force-dynamic';

const Mes = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mes no válido');

/** Vista previa del informe de un mes (`?mes=2026-10`). */
export async function GET(request: Request) {
  const user = await requireModule('sustituciones');
  if (isGuardResponse(user)) return user;
  try {
    const mes = Mes.parse(new URL(request.url).searchParams.get('mes'));
    return NextResponse.json(await informeMes(mes));
  } catch (e) {
    return respuestaError(e, 'preparar el informe');
  }
}

/** «Enviarlo ahora»: lo manda aunque ya hubiera salido (el cron no repite; esto sí, a propósito). */
export async function POST(request: Request) {
  const user = await requireModule('sustituciones');
  if (isGuardResponse(user)) return user;
  try {
    const { mes, destinatarios, etapa } = z.object({ mes: Mes, destinatarios: z.array(z.string().email()).min(1).optional(), etapa: z.enum(['todas', 'EI', 'EP', 'ESO']).optional() }).parse(await request.json());
    return NextResponse.json(await enviarInforme(mes, { forzar: true, quien: await quienDe(user), destinatarios, etapa }));
  } catch (e) {
    return respuestaError(e, 'mandar el informe');
  }
}
