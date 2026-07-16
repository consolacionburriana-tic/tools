export const dynamic = 'force-dynamic';

import { getClasesDisponibles, claseLabel } from '@/lib/salidas-server';
import { getTeachers } from '@/lib/educamos-server';
import { TripForm } from '@/components/salidas/trip-form';

export const metadata = { title: 'Nueva salida · Gestión' };

export default async function NuevaSalidaPage() {
  const [clases, profes] = await Promise.all([getClasesDisponibles(), getTeachers()]);
  return (
    <TripForm
      clases={clases.map((c) => ({ ...c, label: claseLabel(c) }))}
      profes={profes.map((p) => ({
        id: p.id,
        nombre: [p.nombre, p.apellido1].filter(Boolean).join(' '),
        etapa: p.etapa,
        esTutor: p.esTutor,
        claseTutor: p.claseTutor,
      }))}
    />
  );
}
