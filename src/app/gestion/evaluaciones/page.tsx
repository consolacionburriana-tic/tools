export const dynamic = 'force-dynamic';

import { academicYearActual } from '@/lib/constants';
import { getActividades, getForms } from '@/lib/evaluaciones-server';
import { ListaEvaluaciones } from '@/components/evaluaciones/lista';

export const metadata = { title: 'Evaluaciones · Gestión' };

export default async function EvaluacionesPage({ searchParams }: { searchParams: Promise<{ anio?: string }> }) {
  const { anio } = await searchParams;
  const actual = academicYearActual();
  const year = anio ?? actual;
  const [forms, actividades] = await Promise.all([getForms({ academicYear: year }), getActividades({ academicYear: year })]);

  return (
    <>
      <h1 className="sr-only">Evaluaciones de {year}</h1>
      <ListaEvaluaciones forms={forms} actividades={actividades.length} year={year} actual={actual} />
    </>
  );
}
