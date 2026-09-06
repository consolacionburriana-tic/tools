import { redirect } from 'next/navigation';

import { getSessionUser } from '@/lib/auth-guards';
import { puedeEditarHorarios } from '@/lib/permissions';
import { Importador } from '@/components/horarios/importador';

export const dynamic = 'force-dynamic';

export default async function ImportarHorariosPage() {
  const user = await getSessionUser();
  if (!puedeEditarHorarios(user?.role ?? null)) redirect('/gestion/horarios');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Importar horarios</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Del export de Educamos. Se ve la vista previa antes de escribir nada.
        </p>
      </div>
      <Importador />
    </div>
  );
}
