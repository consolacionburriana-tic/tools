import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { alcanceClases, crearConsecuenciaManual, listarConsecuencias } from '@/lib/puntualidad-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const guard = await requireModule('puntualidad');
  if (isGuardResponse(guard)) return guard;
  const clases = await alcanceClases(guard);
  return NextResponse.json({ consecuencias: await listarConsecuencias({ clases }) });
}

// Consecuencia a mano, sin retrasos detrás. Es la puerta abierta a que las consecuencias
// sean su propio módulo: el origen queda marcado como 'manual'.
export async function POST(request: Request) {
  const guard = await requireModule('puntualidad');
  if (isGuardResponse(guard)) return guard;
  try {
    const datos = z
      .object({
        eduStudentId: z.string().uuid(),
        tipoClave: z.string().min(2).max(40).optional(),
        fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        motivo: z.string().max(300).nullable().optional(),
        notas: z.string().max(1000).nullable().optional(),
      })
      .parse(await request.json());
    const creada = await crearConsecuenciaManual({ ...datos, creadaPorEmail: guard.email });
    return NextResponse.json({ consecuencia: creada });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
