import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import {
  academicYearActual,
  actualizarAsignatura,
  borrarAsignatura,
  crearAsignatura,
  getAsignatura,
  getAsignaturas,
  getCursosConAlumnado,
  getMateriasDelHorario,
  moverAsignatura,
  propagarNombreCorto,
  sincronizarDesdeHorario,
} from '@/lib/cuaderno-server';

export const dynamic = 'force-dynamic';

/** Todo lo que pinta la pestaña: asignaturas guardadas, lo que ofrece el horario y los cursos. */
export async function GET() {
  const guard = await requireModule('cuaderno');
  if (isGuardResponse(guard)) return guard;
  const academicYear = academicYearActual();
  const [porCurso, materias, cursos] = await Promise.all([
    getAsignaturas(academicYear),
    getMateriasDelHorario(academicYear),
    getCursosConAlumnado(),
  ]);
  return NextResponse.json({
    academicYear,
    asignaturas: Object.fromEntries(porCurso),
    materiasHorario: materias,
    cursos,
  });
}

export async function POST(request: Request) {
  const guard = await requireModule('cuaderno');
  if (isGuardResponse(guard)) return guard;
  try {
    const datos = z
      .discriminatedUnion('accion', [
        z.object({
          accion: z.literal('crear'),
          curso: z.string().min(1).max(20),
          nombre: z.string().trim().min(1).max(120),
          nombreCorto: z.string().trim().max(60).nullable().optional(),
        }),
        z.object({ accion: z.literal('sincronizar'), curso: z.string().min(1).max(20).optional() }),
        z.object({ accion: z.literal('mover'), id: z.string().uuid(), direccion: z.enum(['arriba', 'abajo']) }),
      ])
      .parse(await request.json());
    const academicYear = academicYearActual();

    if (datos.accion === 'crear') {
      return NextResponse.json({
        asignatura: await crearAsignatura({
          academicYear,
          curso: datos.curso,
          nombre: datos.nombre,
          nombreCorto: datos.nombreCorto?.trim() || null,
        }),
      });
    }
    if (datos.accion === 'sincronizar') {
      return NextResponse.json(await sincronizarDesdeHorario(academicYear, datos.curso));
    }
    await moverAsignatura(datos.id, datos.direccion);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const guard = await requireModule('cuaderno');
  if (isGuardResponse(guard)) return guard;
  try {
    const { id, propagar, pisar, ...cambios } = z
      .object({
        id: z.string().uuid(),
        nombre: z.string().trim().min(1).max(120).optional(),
        nombreCorto: z.string().trim().max(60).nullable().optional(),
        active: z.boolean().optional(),
        /** Llevar el nombre corto a las asignaturas que se llaman igual en otros cursos. */
        propagar: z.boolean().default(true),
        /** Pisar también las que ya tenían uno puesto a mano. */
        pisar: z.boolean().default(false),
      })
      .parse(await request.json());
    // Un nombre corto en blanco no es un nombre corto: se guarda como "no hay".
    if (cambios.nombreCorto !== undefined) cambios.nombreCorto = cambios.nombreCorto?.trim() || null;
    await actualizarAsignatura(id, cambios);

    // «Biología» es «BG» en todos los cursos: se escribe una vez y se reparte.
    let reparto = { propagadas: 0, conOtro: 0 };
    if (propagar && cambios.nombreCorto !== undefined) {
      const asignatura = await getAsignatura(id);
      if (asignatura) {
        reparto = await propagarNombreCorto({
          academicYear: asignatura.academicYear,
          nombre: cambios.nombre ?? asignatura.nombre,
          nombreCorto: cambios.nombreCorto,
          excluirId: id,
          pisar,
        });
      }
    }
    return NextResponse.json({ ok: true, ...reparto });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const guard = await requireModule('cuaderno');
  if (isGuardResponse(guard)) return guard;
  try {
    const { id } = z.object({ id: z.string().uuid() }).parse(await request.json());
    await borrarAsignatura(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}
