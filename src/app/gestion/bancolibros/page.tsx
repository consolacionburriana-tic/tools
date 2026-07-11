export const dynamic = 'force-dynamic';

import { claseLabel, getClasesDisponibles } from '@/lib/salidas-server';
import { BancoPanel } from '@/components/bancolibros/banco-panel';

export const metadata = { title: 'Banco de libros · Gestión' };

export default async function BancoLibrosPage() {
  const clases = await getClasesDisponibles();
  return <BancoPanel clases={clases.map((c) => ({ ...c, label: claseLabel(c) }))} />;
}
