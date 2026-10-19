import { NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { eduStudents } from '@/db/schema';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { alcanceAlumnado, guardarServicios, puedeConAlumno } from '@/lib/alumnado-server';
import { puedeGestionarServicios } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

const cuerpo = z
  .object({
    eduStudentIds: z.array(z.string().uuid()).min(1).max(800),
    comedor: z.boolean().optional(),
    complementarias: z.boolean().optional(),
  })
  .refine((c) => c.comedor !== undefined || c.complementarias !== undefined, { message: 'No hay nada que cambiar' });

/**
 * Comedor y complementarias de uno o muchos alumnos: la pestaña «Comedor y complementarias»
 * («todos sí» de una clase) y el interruptor de la ficha usan esta misma ruta. Los marca
 * secretaría, dirección y TIC. El alcance se comprueba contra las clases de la BBDD, no
 * contra lo que venga en la petición, y las complementarias solo se escriben en Infantil y
 * Primaria (`guardarServicios`).
 */
export async function POST(request: Request) {
  const guard = await requireModule('alumnado');
  if (isGuardResponse(guard)) return guard;
  if (!puedeGestionarServicios(guard.role)) {
    return NextResponse.json({ error: 'El comedor y las complementarias los marcan secretaría, dirección o TIC' }, { status: 403 });
  }

  try {
    const { eduStudentIds, comedor, complementarias } = cuerpo.parse(await request.json());
    const [alcance, filas] = await Promise.all([
      alcanceAlumnado(guard, { conPropias: false }),
      db
        .select({ id: eduStudents.id, curso: eduStudents.curso, letra: eduStudents.letra })
        .from(eduStudents)
        .where(and(inArray(eduStudents.id, eduStudentIds), eq(eduStudents.active, true))),
    ]);
    const suyos = filas.filter((f) => puedeConAlumno(alcance.clases, f));
    if (suyos.length === 0) return NextResponse.json({ error: 'Ninguno de esos alumnos te toca' }, { status: 404 });

    const tocados = await guardarServicios(suyos, { comedor, complementarias });
    return NextResponse.json({ tocados });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}
