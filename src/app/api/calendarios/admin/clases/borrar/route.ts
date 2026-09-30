import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { borrarClases, buzonAdmin } from '@/lib/calendarios-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const cuerpo = z.object({
  ids: z.array(z.string().min(1).max(100)).min(1).max(15),
  conCalendario: z.boolean(),
  /** La pantalla obliga a escribir BORRAR: el servidor lo comprueba también. */
  confirmacion: z.literal('BORRAR'),
});

// Elimina clases de Classroom (no se deshace). Tandas pequeñas: la pantalla trocea.
export async function POST(request: Request) {
  const user = await requireModule('calendarios');
  if (isGuardResponse(user)) return user;
  let datos: z.infer<typeof cuerpo>;
  try {
    datos = cuerpo.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Datos incorrectos' }, { status: 400 });
  }
  try {
    return NextResponse.json({
      resultados: await borrarClases(buzonAdmin(user.email), datos.ids, user.email, datos.conCalendario),
    });
  } catch (error) {
    console.error('Calendarios: error borrando clases:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Error borrando las clases' }, { status: 500 });
  }
}
