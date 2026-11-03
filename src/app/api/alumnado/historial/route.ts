import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { entradasDeAlumno, entradasDeLote, lotesRecientes } from '@/lib/auditoria-server';
import { puedeVerHistorialAlumnado } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

const consulta = z.object({
  alumno: z.string().uuid().optional(),
  lote: z.string().uuid().optional(),
  grupo: z.enum(['proteccion', 'participacion', 'servicios', 'educamos']).optional(),
  antesDe: z.string().datetime().optional(),
});

/**
 * El libro de cambios de Alumnado (docs/31-auditoria.md). Tres formas de preguntar:
 *  - `?lote=<id>`    las líneas de un cambio (un clic, aunque tocara a 600 alumnos)
 *  - `?alumno=<id>`  las últimas líneas de UNA persona, para su ficha
 *  - nada            los últimos cambios, resumidos por lote (`grupo` y `antesDe` para filtrar y paginar)
 * Solo lo ven quienes pueden restaurar: secretaría, dirección y TIC.
 */
export async function GET(request: Request) {
  const guard = await requireModule('alumnado');
  if (isGuardResponse(guard)) return guard;
  if (!puedeVerHistorialAlumnado(guard.role)) {
    return NextResponse.json({ error: 'El historial de cambios lo ven secretaría, dirección y TIC' }, { status: 403 });
  }
  try {
    const q = consulta.parse(Object.fromEntries(new URL(request.url).searchParams));
    if (q.lote) return NextResponse.json({ entradas: await entradasDeLote(q.lote) });
    if (q.alumno) return NextResponse.json({ entradas: await entradasDeAlumno(q.alumno) });
    const lotes = await lotesRecientes({
      limite: 40,
      grupo: q.grupo,
      antesDe: q.antesDe ? new Date(q.antesDe) : undefined,
    });
    return NextResponse.json({ lotes });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}
