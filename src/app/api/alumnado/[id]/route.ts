import { NextResponse } from 'next/server';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import {
  alcanceAlumnado,
  alcanceProteccion,
  fichaAlumno,
  fichaVisible,
  puedeConAlumno,
} from '@/lib/alumnado-server';

export const dynamic = 'force-dynamic';

/**
 * La ficha completa de un alumno. Se pide al abrirla, no con el listado: es la consulta
 * cara (13 preguntas a Neon) y la mayoría de las veces solo se abren dos o tres fichas.
 *
 * El alcance se comprueba AQUÍ otra vez, no solo al pintar la lista: quien teclee en la URL
 * el id de un alumno de otra ETAPA tiene que recibir un 404, no su ficha.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireModule('alumnado');
  if (isGuardResponse(guard)) return guard;

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Identificador no válido' }, { status: 400 });
  }

  // En paralelo: la ficha no depende del alcance ni al revés, y encadenarlas costaba dos
  // viajes a Neon de más justo en la petición que se nota al tocar un alumno.
  const [ficha, { clases, propias }] = await Promise.all([
    fichaAlumno(id),
    // `conPropias: false` solo ahorra la consulta a quien lo ve todo; a un tutor se le
    // traen igual, porque sus tutorías SON el alcance de la protección de datos.
    alcanceAlumnado(guard, { conPropias: false }),
  ]);
  if (!ficha) return NextResponse.json({ error: 'Ese alumno no existe' }, { status: 404 });
  if (!puedeConAlumno(clases, ficha)) {
    // Mismo mensaje que si no existiera: quién está en cada clase tampoco es información
    // que tenga que dar esta ruta a quien no le toca.
    return NextResponse.json({ error: 'Ese alumno no existe' }, { status: 404 });
  }

  // La protección de datos va más cerrada que el resto de la ficha (un tutor solo la de su
  // tutoría), así que la que no toca ni siquiera se manda por la red.
  return NextResponse.json({ ficha: fichaVisible(ficha, guard, alcanceProteccion(guard, propias)) });
}
