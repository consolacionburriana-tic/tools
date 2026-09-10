import { NextResponse } from 'next/server';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { alcanceAlumnado, fichaAlumno, puedeConAlumno } from '@/lib/alumnado-server';

export const dynamic = 'force-dynamic';

/**
 * La ficha completa de un alumno. Se pide al abrirla, no con el listado: es la consulta
 * cara (13 preguntas a Neon) y la mayoría de las veces solo se abren dos o tres fichas.
 *
 * El alcance se comprueba AQUÍ otra vez, no solo al pintar la lista: un tutor que teclee
 * el id de un alumno de otra clase en la URL tiene que recibir un 404, no su ficha.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireModule('alumnado');
  if (isGuardResponse(guard)) return guard;

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Identificador no válido' }, { status: 400 });
  }

  const ficha = await fichaAlumno(id);
  if (!ficha) return NextResponse.json({ error: 'Ese alumno no existe' }, { status: 404 });

  const alcance = await alcanceAlumnado(guard);
  if (!puedeConAlumno(alcance, ficha)) {
    // Mismo mensaje que si no existiera: quién está en cada clase tampoco es información
    // que tenga que dar esta ruta a quien no le toca.
    return NextResponse.json({ error: 'Ese alumno no existe' }, { status: 404 });
  }

  return NextResponse.json({ ficha });
}
