export const dynamic = 'force-dynamic';

import { EnlaceVolver, TituloPagina } from '@/components/ui/cabecera-modulo';
import { SincronizarTabs } from '@/components/educamos/sincronizar-tabs';

export const metadata = { title: 'Sincronizar · BBDD Educamos' };

export default function SincronizarEducamosPage() {
  return (
    <>
      <EnlaceVolver href="/gestion/educamos">BBDD central</EnlaceVolver>
      <TituloPagina descripcion="Sube el export de Educamos, revisa el diff y aplica">Sincronizar</TituloPagina>
      <SincronizarTabs />
    </>
  );
}
