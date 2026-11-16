export const dynamic = 'force-dynamic';

import { cargarInventario } from '@/lib/inventario-server';
import { Mobiliario } from '@/components/inventario/mobiliario';

export const metadata = { title: 'Mesas y sillas · Inventario y aulas' };

export default async function MobiliarioPage() {
  return <Mobiliario inv={await cargarInventario()} />;
}
