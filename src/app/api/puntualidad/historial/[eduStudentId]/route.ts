import { NextResponse } from 'next/server';
import { isGuardResponse, requireSession } from '@/lib/auth-guards';
import { historialAlumno } from '@/lib/puntualidad-server';

export const dynamic = 'force-dynamic';

// Historial en vivo del alumno seleccionado: es lo que el profe lee antes de guardar
// ("4º retraso del curso · 2 este mes"), así que se sirve en una sola llamada.
export async function GET(request: Request, { params }: { params: Promise<{ eduStudentId: string }> }) {
  const guard = await requireSession();
  if (isGuardResponse(guard)) return guard;
  try {
    const { eduStudentId } = await params;
    const hoy = new URL(request.url).searchParams.get('fecha') ?? new Date().toISOString().slice(0, 10);
    const historial = await historialAlumno(eduStudentId, hoy);
    if (!historial) return NextResponse.json({ error: 'Alumno no encontrado' }, { status: 404 });
    return NextResponse.json(historial);
  } catch (error) {
    console.error('Puntualidad · error cargando historial:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
