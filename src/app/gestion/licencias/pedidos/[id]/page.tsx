export const dynamic = 'force-dynamic';

import { PedidoDetail } from '@/components/licencias/pedido-detail';
import { Subpantalla } from '@/components/licencias/subpantalla';

export const metadata = { title: 'Pedido · Licencias' };

export default async function PedidoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Subpantalla
      ancho="estrecho"
      titulo="Detalle del pedido"
      volver={{ href: '/gestion/licencias/pedidos', texto: 'Todos los pedidos' }}
    >
      <PedidoDetail orderId={id} />
    </Subpantalla>
  );
}
