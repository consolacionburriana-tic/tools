export const dynamic = 'force-dynamic';

import { cargarInventario } from '@/lib/inventario-server';
import { ListaGeneralArreglos } from '@/components/inventario/lista-arreglos';

export const metadata = { title: 'Arreglos · Inventario y aulas' };

export default async function ArreglosPage({ searchParams }: { searchParams: Promise<{ apuntar?: string }> }) {
  const [inv, { apuntar }] = await Promise.all([cargarInventario(), searchParams]);
  return <ListaGeneralArreglos inv={inv} apuntar={apuntar === '1'} />;
}
