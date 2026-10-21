import { redirect } from 'next/navigation';

import { getSessionUser } from '@/lib/auth-guards';
import { puedeEditarHorarios } from '@/lib/permissions';
import { EnlaceVolver, TituloPagina } from '@/components/ui/cabecera-modulo';
import { Importador } from '@/components/horarios/importador';

export const dynamic = 'force-dynamic';

export default async function ImportarHorariosPage() {
  const user = await getSessionUser();
  if (!puedeEditarHorarios(user?.role ?? null)) redirect('/gestion/horarios');

  return (
    <div className="mx-auto max-w-3xl">
      <EnlaceVolver href="/gestion/horarios">Horarios</EnlaceVolver>
      <TituloPagina descripcion="Del export de Educamos. Ves la vista previa antes de que se escriba nada.">
        Importar horarios
      </TituloPagina>
      <Importador />
    </div>
  );
}
