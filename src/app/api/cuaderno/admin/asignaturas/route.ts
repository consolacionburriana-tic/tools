import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import {
  academicYearActual,
  actualizarAsignatura,
  borrarAsignatura,
  crearAsignatura,
  getAsignaturas,
  getCursosConAlumnado,
  getMateriasDelHorario,
  moverAsignatura,
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
    const { id, ...cambios } = z
      .object({
        id: z.string().uuid(),
        nombre: z.string().trim().min(1).max(120).optional(),
        nombreCorto: z.string().trim().max(60).nullable().optional(),
        active: z.boolean().optional(),
      })
      .parse(await request.json());
    // Un nombre corto en blanco no es un nombre corto: se guarda como "no hay".
    if (cambios.nombreCorto !== undefined) cambios.nombreCorto = cambios.nombreCorto?.trim() || null;
    await actualizarAsignatura(id, cambios);
    return NextResponse.json({ ok: true });
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
