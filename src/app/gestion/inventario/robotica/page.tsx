export const dynamic = 'force-dynamic';

import { cargarInventario } from '@/lib/inventario-server';
import { Robotica } from '@/components/inventario/robotica';

export const metadata = { title: 'Robótica · Inventario y aulas' };

export default async function RoboticaPage({ searchParams }: { searchParams: Promise<{ kit?: string }> }) {
  const [inv, { kit }] = await Promise.all([cargarInventario(), searchParams]);
  return <Robotica inv={inv} kitInicial={kit && inv.kits.some((k) => k.id === kit) ? kit : null} />;
}
