export const dynamic = 'force-dynamic';

import { getClasesDisponibles, claseLabel } from '@/lib/salidas-server';
import { getTeachers } from '@/lib/educamos-server';
import { nombreProfeBreve } from '@/lib/profes';
import { EnlaceVolver, TituloPagina } from '@/components/ui/cabecera-modulo';
import { TripForm } from '@/components/salidas/trip-form';

export const metadata = { title: 'Nueva salida · Gestión' };

export default async function NuevaSalidaPage() {
  const [clases, profes] = await Promise.all([getClasesDisponibles(), getTeachers()]);
  return (
    <div>
      <EnlaceVolver href="/gestion/salidas">Todas las salidas</EnlaceVolver>
      <TituloPagina className="mt-1">Nueva salida</TituloPagina>
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
