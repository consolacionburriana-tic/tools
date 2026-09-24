export const dynamic = 'force-dynamic';

import { listarTareas } from '@/lib/tareas-server';
import { TableroTareas } from '@/components/tareas/tablero';

export const metadata = { title: 'Tareas · Tools Consolación' };

export default async function TareasPage() {
  const tareas = await listarTareas();
  return <TableroTareas iniciales={tareas} />;
}
