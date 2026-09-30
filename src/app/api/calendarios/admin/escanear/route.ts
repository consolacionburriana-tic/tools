import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { explicarError } from '@/lib/calendarios-google';
import { buzonAdmin, pasoClassroom, pasoEventos, pasoUsuarios } from '@/lib/calendarios-server';

export const dynamic = 'force-dynamic';
// Un paso = una página de Classroom, 30 usuarios o 12 calendarios: holgado en 60 s.
export const maxDuration = 60;

const cuerpo = z.object({
  paso: z.enum(['classroom', 'usuarios', 'eventos']),
  cursor: z.string().max(2000).nullable().optional(),
  /** Cuándo empezó el escaneo entero: lo que no se haya tocado desde entonces está por hacer. */
  inicio: z.string().datetime(),
});

// Un paso del escaneo. La pantalla los encadena: ver calendarios-server.ts.
export async function POST(request: Request) {
  const user = await requireModule('calendarios');
  if (isGuardResponse(user)) return user;
  let datos: z.infer<typeof cuerpo>;
  try {
    datos = cuerpo.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Datos incorrectos' }, { status: 400 });
  }
  const admin = buzonAdmin(user.email);
  const inicio = new Date(datos.inicio);
  try {
    if (datos.paso === 'classroom') return NextResponse.json(await pasoClassroom(admin, datos.cursor ?? null, inicio));
    if (datos.paso === 'usuarios') return NextResponse.json(await pasoUsuarios(admin, datos.cursor ?? null));
    return NextResponse.json(await pasoEventos(inicio));
  } catch (error) {
    console.error(`Calendarios: error en el paso ${datos.paso}:`, error instanceof Error ? error.message : error);
    return NextResponse.json({ error: explicarError(error) }, { status: 502 });
  }
}
