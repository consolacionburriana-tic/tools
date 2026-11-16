export const dynamic = 'force-dynamic';

import { cargarInventario } from '@/lib/inventario-server';
import { Antenas } from '@/components/inventario/antenas';

export const metadata = { title: 'Antenas · Inventario y aulas' };

export default async function AntenasPage() {
  return <Antenas inv={await cargarInventario()} />;
}
