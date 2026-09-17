import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { alcanceAlumnado, alcanceProteccion, guardarProteccionMasiva } from '@/lib/alumnado-server';

export const dynamic = 'force-dynamic';

const permiso = z.boolean().nullable();

const cuerpo = z.object({
  // 700 y pico es el centro entero: el tope está para que una petición rara no barra la
  // BBDD, no porque haga falta más.
  eduStudentIds: z.array(z.string().uuid()).min(1).max(800),
  cambios: z
    .object({
      imagen: permiso.optional(),
      redes: permiso.optional(),
      ampa: permiso.optional(),
      ong: permiso.optional(),
      firmada: z.boolean().optional(),
    })
    .refine((c) => Object.keys(c).length > 0, { message: 'No hay nada que cambiar' }),
});

/**
 * Protección de datos de MUCHOS alumnos a la vez: «sí a todo en 2º ESO B», o una columna
 * entera de la tabla. Es la única forma de que esto se llene: a mano son 639 fichas × 5.
 *
 * El alcance no se comprueba aquí alumno por alumno sino dentro de `guardarProteccionMasiva`,
 * que lee sus clases de la BBDD y descarta lo que no toque: lo que viene en el cuerpo de una
 * petición no decide a quién se puede tocar.
 */
export async function POST(request: Request) {
  const guard = await requireModule('alumnado');
  if (isGuardResponse(guard)) return guard;

  const alcance = await alcanceAlumnado(guard);
  const pd = alcanceProteccion(guard, alcance.propias);
  if (!pd.edita) {
    return NextResponse.json(
      { error: 'La protección de datos la cambian secretaría, dirección o TIC' },
      { status: 403 },
    );
  }

  try {
    const { eduStudentIds, cambios } = cuerpo.parse(await request.json());
    const hecho = await guardarProteccionMasiva(eduStudentIds, cambios, guard.email, {
      general: alcance.clases,
      proteccion: pd,
    });
    if (hecho.filas.length === 0) {
      return NextResponse.json({ error: 'Ninguno de esos alumnos te toca' }, { status: 404 });
    }
    return NextResponse.json(hecho);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}
