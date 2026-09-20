import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { alcanceAlumnado, guardarParticipacionMasiva, puedeParticipacionDe } from '@/lib/alumnado-server';

export const dynamic = 'force-dynamic';

const cuerpo = z.object({
  // Mismo tope que la protección masiva: 700 y pico es el centro entero, y el límite está
  // para que una petición rara no barra la BBDD.
  eduStudentIds: z.array(z.string().uuid()).min(1).max(800),
  cambios: z
    .object({ bancoLibros: z.boolean().optional(), ampa: z.boolean().optional() })
    .refine((c) => c.bancoLibros !== undefined || c.ampa !== undefined, { message: 'No hay nada que cambiar' }),
});

/**
 * Banco de libros y AMPA de MUCHOS alumnos a la vez: «todos al banco en 2º ESO B» desde las
 * pestañas de Alumnado. La hermana de `[id]/participacion`, que hace lo mismo para uno.
 *
 * Ojo con el `ampa` de aquí: es «la familia es socia del AMPA», no el permiso de que el AMPA
 * publique fotos. Ese otro vive en la protección de datos, en la ruta de al lado.
 *
 * El alcance no se comprueba alumno por alumno aquí sino dentro de
 * `guardarParticipacionMasiva`, que lee sus clases de la BBDD y descarta lo que no toque.
 */
export async function POST(request: Request) {
  const guard = await requireModule('alumnado');
  if (isGuardResponse(guard)) return guard;

  if (!puedeParticipacionDe(guard)) {
    return NextResponse.json(
      { error: 'Solo jefatura, dirección o TIC pueden cambiar el banco de libros y el AMPA' },
      { status: 403 },
    );
  }

  try {
    const { eduStudentIds, cambios } = cuerpo.parse(await request.json());
    const alcance = await alcanceAlumnado(guard);
    const hecho = await guardarParticipacionMasiva(eduStudentIds, cambios, alcance.clases);
    if (hecho.ids.length === 0) {
      return NextResponse.json({ error: 'Ninguno de esos alumnos te toca' }, { status: 404 });
    }
    return NextResponse.json({ ...hecho, cambios });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}
