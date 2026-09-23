import { NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { eduStudents } from '@/db/schema';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { alcanceAlumnado, puedeConAlumno } from '@/lib/alumnado-server';
import { setAmpa, setBancoVarios } from '@/lib/bancolibros-server';
import { canAccess, puedeGestionarParticipantesBanco } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

const cuerpo = z
  .object({
    eduStudentIds: z.array(z.string().uuid()).min(1).max(800),
    bancoLibros: z.boolean().optional(),
    ampa: z.boolean().optional(),
  })
  .refine((c) => c.bancoLibros !== undefined || c.ampa !== undefined, { message: 'No hay nada que cambiar' });

/**
 * Banco de libros y AMPA de MUCHOS alumnos a la vez, desde las pestañas de Alumnado («todos
 * sí» de una clase). Mismo permiso que la ficha y que el panel del banco —dirección/TIC con
 * el módulo del banco— y las mismas funciones (`setBancoVarios` propaga el banco a la campaña
 * de Licencias vigente). El alcance se comprueba contra las clases de la BBDD, no contra lo
 * que venga en la petición.
 */
export async function POST(request: Request) {
  const guard = await requireModule('alumnado');
  if (isGuardResponse(guard)) return guard;
  if (!(canAccess(guard, 'bancolibros') && puedeGestionarParticipantesBanco(guard.role))) {
    return NextResponse.json({ error: 'Solo dirección/TIC pueden cambiar el banco de libros y el AMPA' }, { status: 403 });
  }

  try {
    const { eduStudentIds, bancoLibros, ampa } = cuerpo.parse(await request.json());
    const [alcance, filas] = await Promise.all([
      alcanceAlumnado(guard, { conPropias: false }),
      db
        .select({ id: eduStudents.id, curso: eduStudents.curso, letra: eduStudents.letra })
        .from(eduStudents)
        .where(and(inArray(eduStudents.id, eduStudentIds), eq(eduStudents.active, true))),
    ]);
    const ids = filas.filter((f) => puedeConAlumno(alcance.clases, f)).map((f) => f.id);
    if (ids.length === 0) return NextResponse.json({ error: 'Ninguno de esos alumnos te toca' }, { status: 404 });

    await Promise.all([
      bancoLibros !== undefined ? setBancoVarios(ids, bancoLibros) : null,
      ampa !== undefined ? setAmpa(ids, ampa) : null,
    ]);
    return NextResponse.json({ ids });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}
