export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { cargarInventario } from '@/lib/inventario-server';
import { FichaAula } from '@/components/inventario/ficha-aula';

export const metadata = { title: 'Aula · Inventario y aulas' };

export default async function AulaPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, inv] = await Promise.all([params, cargarInventario()]);
  if (!inv.aulas.some((a) => a.id === id)) notFound();
  return <FichaAula inv={inv} aulaId={id} />;
}
