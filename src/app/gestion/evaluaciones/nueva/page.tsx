export const dynamic = 'force-dynamic';

import { academicYearActual } from '@/lib/constants';
import { academicYearAnterior } from '@/lib/evaluaciones';
import { getActividades, getClasesDisponibles, getForms } from '@/lib/evaluaciones-server';
import { NuevaEvaluacion } from '@/components/evaluaciones/nueva-evaluacion';

export const metadata = { title: 'Nueva evaluación · Gestión' };

export default async function NuevaEvaluacionPage() {
  const actual = academicYearActual();
  const anterior = academicYearAnterior(actual);
  const [clases, actividades, actividadesAnterior, formsAnterior] = await Promise.all([
    getClasesDisponibles(),
    getActividades({ academicYear: actual }),
    getActividades({ academicYear: anterior }),
    getForms({ academicYear: anterior }),
  ]);

  return (
    <NuevaEvaluacion
      academicYear={actual}
      academicYearAnterior={anterior}
      clases={clases}
      actividades={actividades.map((a) => ({ id: a.id, nombre: a.nombre, categoria: a.categoria, fecha: a.fecha }))}
      actividadesAnterior={actividadesAnterior.map((a) => ({ id: a.id, nombre: a.nombre, categoria: a.categoria, fecha: a.fecha }))}
      formsAnterior={formsAnterior.map((f) => ({ id: f.id, titulo: f.titulo, audiencia: f.audiencia, actividades: f.actividades }))}
    />
  );
}
