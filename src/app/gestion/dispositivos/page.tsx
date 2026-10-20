export const dynamic = 'force-dynamic';

import { panelDispositivos } from '@/lib/dispositivos-server';
import { VISTAS, type Vista } from '@/lib/dispositivos';
import { PanelDispositivos } from '@/components/dispositivos/panel';

export const metadata = { title: 'Dispositivos 1:1 · Tools Consolación' };

export default async function DispositivosPage({ searchParams }: { searchParams: Promise<{ vista?: string; alumno?: string }> }) {
  const [panel, { vista, alumno }] = await Promise.all([panelDispositivos(), searchParams]);
  const inicial: Vista = (VISTAS as readonly string[]).includes(vista ?? '') ? (vista as Vista) : 'alumnado';
  // `?alumno=<id>` (desde Nouvinguts o Alumnado) entra con su ficha abierta, si está en el alcance.
  const abierto = alumno && panel.alumnos.some((a) => a.id === alumno) ? alumno : null;
  return <PanelDispositivos inicial={panel} vistaInicial={inicial} alumnoInicial={abierto} />;
}
