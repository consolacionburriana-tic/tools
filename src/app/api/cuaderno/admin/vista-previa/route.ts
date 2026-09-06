import { NextResponse } from 'next/server';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import {
  academicYearActual,
  asegurarNumeracion,
  getAjustes,
  getAsignaturas,
  getClasesCuaderno,
  getMapeo,
  getPlantillas,
} from '@/lib/cuaderno-server';
import { gruposDeClase } from '@/lib/cuaderno/tirada';
import { construirVistaPrevia } from '@/lib/cuaderno/vista-previa';

export const dynamic = 'force-dynamic';

/**
 * Qué va a salir exactamente en una plantilla para una clase concreta. Se calcula con el
 * mismo `construirPlan()` del worker, así que no puede desviarse de lo que se imprime.
 */
export async function GET(request: Request) {
  const guard = await requireModule('cuaderno');
  if (isGuardResponse(guard)) return guard;

  const params = new URL(request.url).searchParams;
  const plantillaId = params.get('plantilla');
  const curso = params.get('curso');
  const letra = params.get('letra');
  if (!plantillaId || !curso) {
    return NextResponse.json({ error: 'Hacen falta la plantilla y la clase' }, { status: 400 });
  }

  const academicYear = academicYearActual();
  const [plantillas, ajustes, mapeo, clases, asignaturas] = await Promise.all([
    getPlantillas(),
    getAjustes(),
    getMapeo(),
    getClasesCuaderno({ clases: [{ curso, letra: letra || null }] }),
    getAsignaturas(academicYear),
  ]);

  const plantilla = plantillas.find((p) => p.id === plantillaId);
  if (!plantilla) return NextResponse.json({ error: 'No existe esa plantilla' }, { status: 404 });
  if (!plantilla.etiquetas?.length) {
    return NextResponse.json({ error: 'La plantilla aún no se ha leído: pulsa «Analizar» en Plantillas.' }, { status: 400 });
  }
  const clase = clases[0];
  if (!clase) return NextResponse.json({ error: 'Esa clase no tiene alumnado activo' }, { status: 404 });

  // El ejemplo se hace con el primer tutor y su trozo de clase, que es un documento real.
  const grupos = gruposDeClase(clase);
  const grupo = grupos.grupos[0];
  const alumnos = grupo?.alumnos ?? clase.alumnos;
  const numeros = await asegurarNumeracion(academicYear, clase.curso, clase.letra, clase.alumnos);

  return NextResponse.json(
    construirVistaPrevia({
      plantilla,
      ajustes,
      academicYear,
      clase,
      tutor: grupo?.tutor ?? null,
      alumnos,
      asignaturas: asignaturas.get(clase.curso) ?? [],
      numeros,
      mapeo,
      etiquetas: plantilla.etiquetas,
    }),
  );
}
