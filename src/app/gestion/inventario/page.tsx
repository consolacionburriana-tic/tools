export const dynamic = 'force-dynamic';

import { cargarInventario } from '@/lib/inventario-server';
import { Aulas } from '@/components/inventario/aulas';

export const metadata = { title: 'Inventario y aulas · Tools Consolación' };

export default async function InventarioPage() {
  return <Aulas inv={await cargarInventario()} />;
}
