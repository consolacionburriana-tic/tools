export const dynamic = 'force-dynamic';

import { cargarInventario } from '@/lib/inventario-server';
import { Audiovisual } from '@/components/inventario/audiovisual';

export const metadata = { title: 'Audiovisual · Inventario y aulas' };

export default async function AudiovisualPage() {
  return <Audiovisual inv={await cargarInventario()} />;
}
