export const dynamic = 'force-dynamic';

import { academicYearActual } from '@/lib/constants';
import { academicYearAnterior } from '@/lib/evaluaciones';
import { getActividades } from '@/lib/evaluaciones-server';
import { ActividadesPanel } from '@/components/evaluaciones/actividades-panel';
import { EnlaceVolver, TituloPagina } from '@/components/ui/cabecera-modulo';

export const metadata = { title: 'Actividades · Evaluaciones' };

export default async function ActividadesPage({ searchParams }: { searchParams: Promise<{ anio?: string }> }) {
  const { anio } = await searchParams;
  const year = anio ?? academicYearActual();
  const anterior = academicYearAnterior(year);
  const [actividades, delAnterior] = await Promise.all([
    getActividades({ academicYear: year }),
    getActividades({ academicYear: anterior }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <EnlaceVolver href="/gestion/evaluaciones">Todas las evaluaciones</EnlaceVolver>
        <TituloPagina antes={year} className="mb-0">
          Actividades
        </TituloPagina>
      </div>
      <ActividadesPanel
        academicYear={year}
        academicYearAnterior={anterior}
        actividades={actividades.map((a) => ({
          id: a.id,
          nombre: a.nombre,
          fecha: a.fecha,
          lugar: a.lugar,
          categoria: a.categoria,
          objetivo: a.objetivo,
          resumen: a.resumen,
          notas: a.notas,
          color: a.color,
          academicYear: a.academicYear,
          formularios: a.formularios,
        }))}
        actividadesAnterior={delAnterior.map((a) => ({ id: a.id, nombre: a.nombre, categoria: a.categoria }))}
      />
    </div>
  );
}
