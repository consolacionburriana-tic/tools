export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { academicYearActual } from '@/lib/constants';
import { academicYearAnterior } from '@/lib/evaluaciones';
import { getActividades } from '@/lib/evaluaciones-server';
import { ActividadesPanel } from '@/components/evaluaciones/actividades-panel';

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
      <Link href="/gestion/evaluaciones" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-blue-600">
        <ChevronLeft className="h-4 w-4" /> Evaluaciones
      </Link>
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
          academicYear: a.academicYear,
          formularios: a.formularios,
        }))}
        actividadesAnterior={delAnterior.map((a) => ({ id: a.id, nombre: a.nombre, categoria: a.categoria }))}
      />
    </div>
  );
}
