import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { getClasesConTutores, limpiarTutorias, promocionarTutores } from '@/lib/tutorias-server';

export const dynamic = 'force-dynamic';

// Acciones en bloque sobre las tutorías del curso académico en vigor. El plan de la
// promoción se recalcula en servidor: la vista previa del cliente es solo para mirar.
const schema = z.discriminatedUnion('accion', [
  z.object({ accion: z.literal('promocionar') }),
  z.object({ accion: z.literal('limpiar'), etapa: z.enum(['EI', 'EP', 'ESO']).nullable().default(null) }),
]);

export async function POST(request: Request) {
  const guard = await requireModule('profes');
  if (isGuardResponse(guard)) return guard;
  try {
    const input = schema.parse(await request.json());
    const resultado =
      input.accion === 'promocionar'
        ? await promocionarTutores()
        : { borradas: await limpiarTutorias(input.etapa ?? undefined) };
    // Devolvemos la rejilla ya recalculada para que la pantalla no tenga que recargarse.
    return NextResponse.json({ ok: true, resultado, clases: await getClasesConTutores() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}
