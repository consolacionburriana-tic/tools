export const dynamic = 'force-dynamic';

import { getSessionUser } from '@/lib/auth-guards';
import { puedeGestionarParticipantesBanco } from '@/lib/permissions';
import { BancoSyncPanel } from '@/components/bancolibros/sync-panel';
import { EnlaceVolver, TituloPagina } from '@/components/ui/cabecera-modulo';
import { Vacio } from '@/components/ui/vacio';

export const metadata = { title: 'Sincronizar · Banco de libros' };

export default async function SincronizarBancoPage() {
  const user = await getSessionUser();
  const puede = puedeGestionarParticipantesBanco(user?.role ?? null);

  return (
    <div className="space-y-4">
      <div>
        <EnlaceVolver href="/gestion/bancolibros">Banco de libros</EnlaceVolver>
        <TituloPagina descripcion="Puente bajo demanda entre el Excel de libros y el catálogo del banco.">
          Sincronizar el catálogo
        </TituloPagina>
      </div>

      {puede ? (
        <BancoSyncPanel />
      ) : (
        <Vacio titulo="No puedes sincronizar">Solo dirección y TIC pueden sincronizar el catálogo de libros.</Vacio>
      )}
    </div>
  );
}
