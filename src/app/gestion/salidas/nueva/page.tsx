export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getClasesDisponibles, claseLabel } from '@/lib/salidas-server';
import { getTeachers } from '@/lib/educamos-server';
import { nombreProfeBreve } from '@/lib/profes';
import { TripForm } from '@/components/salidas/trip-form';

export const metadata = { title: 'Nueva salida · Gestión' };

export default async function NuevaSalidaPage() {
  const [clases, profes] = await Promise.all([getClasesDisponibles(), getTeachers()]);
  return (
    <div className="space-y-4">
      <Link
        href="/gestion/salidas"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400"
      >
        <ChevronLeft className="h-4 w-4" /> Salidas
      </Link>
      <TripForm
        clases={clases.map((c) => ({ ...c, label: claseLabel(c) }))}
        profes={profes.map((p) => ({
          id: p.id,
          nombre: nombreProfeBreve(p),
          etapa: p.etapa,
          esTutor: p.esTutor,
          claseTutor: p.claseTutor,
        }))}
      />
    </div>
  );
}
