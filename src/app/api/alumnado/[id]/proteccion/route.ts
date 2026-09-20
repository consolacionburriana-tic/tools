import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import {
  alcanceAlumnado,
  alcanceProteccion,
  claseDeAlumno,
  guardarProteccion,
  puedeConAlumno,
  veProteccionDe,
} from '@/lib/alumnado-server';

export const dynamic = 'force-dynamic';

// Tri-estado: `true` autoriza · `false` no autoriza · `null` no consta. El `null` entra a
// propósito (se puede desmarcar un permiso que se puso por error), lo que NO entra es
// `undefined`: eso es «este campo no se toca» y se resuelve no mandándolo.
const permiso = z.boolean().nullable();

const cuerpo = z
  .object({
    imagen: permiso.optional(),
    redes: permiso.optional(),
    ampa: permiso.optional(),
    ong: permiso.optional(),
    firmada: z.boolean().optional(),
    notas: z.string().max(500).nullable().optional(),
  })
  .refine((c) => Object.keys(c).length > 0, { message: 'No hay nada que cambiar' });

/**
 * Cambia la protección de datos de un alumno desde su ficha. Tres comprobaciones, y las
 * tres hacen falta:
 *
 *  1. El módulo (`requireModule`).
 *  2. El alcance general de la pantalla: un alumno de otra etapa no existe para ti (404).
 *  3. El alcance de la protección de datos, que es más estrecho —un tutor solo la de su
 *     tutoría— y encima exige rol de secretaría/jefatura/dirección/TIC para tocarla (403).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireModule('alumnado');
  if (isGuardResponse(guard)) return guard;

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Identificador no válido' }, { status: 400 });
  }

  const [alumno, alcance] = await Promise.all([claseDeAlumno(id), alcanceAlumnado(guard)]);
  if (!alumno || !puedeConAlumno(alcance.clases, alumno)) {
    return NextResponse.json({ error: 'Ese alumno no existe' }, { status: 404 });
  }

  const pd = alcanceProteccion(guard, alcance.propias);
  // Mismo mensaje que si no existiera, por el mismo motivo que en la ruta de la ficha:
  // quién está en cada clase no es información que dar a quien no le toca.
  if (!veProteccionDe(pd, alumno)) {
    return NextResponse.json({ error: 'Ese alumno no existe' }, { status: 404 });
  }
  if (!pd.edita) {
    return NextResponse.json(
      { error: 'La protección de datos la cambian secretaría, jefatura, dirección o TIC' },
      { status: 403 },
    );
  }

  try {
    const cambios = cuerpo.parse(await request.json());
    const proteccion = await guardarProteccion(id, cambios, guard.email);
    if (!proteccion) return NextResponse.json({ error: 'Ese alumno no existe' }, { status: 404 });
    return NextResponse.json({ proteccion });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}
