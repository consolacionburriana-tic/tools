export const dynamic = 'force-dynamic';

import { Subpantalla } from '@/components/licencias/subpantalla';
import { SyncPanel } from '@/components/licencias/sync-panel';

export const metadata = { title: 'Sincronizar · Licencias' };

export default function SincronizarPage() {
  return (
    <Subpantalla
      ancho="estrecho"
      titulo="Sincronizar"
      descripcion="Puentes bajo demanda entre esta app y el Google Sheet histórico."
    >
      <SyncPanel />
    </Subpantalla>
  );
}
