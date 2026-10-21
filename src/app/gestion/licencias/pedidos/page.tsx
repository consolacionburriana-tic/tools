export const dynamic = 'force-dynamic';

import { PedidosList } from '@/components/licencias/pedidos-list';
import { Subpantalla } from '@/components/licencias/subpantalla';

export const metadata = { title: 'Pedidos · Licencias' };

export default function PedidosPage() {
  return (
    <Subpantalla titulo="Pedidos" descripcion="Listado, edición, archivo y estado de cada pedido.">
      <PedidosList />
    </Subpantalla>
  );
}
