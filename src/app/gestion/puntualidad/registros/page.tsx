export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { format, subDays } from 'date-fns';
import { getSessionUser } from '@/lib/auth-guards';
import { alcanceClases, listarRetrasos } from '@/lib/puntualidad-server';
import { RegistrosPanel } from '@/components/puntualidad/registros-panel';

export const metadata = { title: 'Retrasos · Puntualidad · Tools Consolación' };

const RANGOS: Record<string, number | 'curso'> = { '7': 7, '30': 30, curso: 'curso' };

export default async function RegistrosPage({
  searchParams,
}: {
  searchParams: Promise<{ rango?: string; sinJustificar?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');

  const { rango, sinJustificar } = await searchParams;
  const clave = rango && rango in RANGOS ? rango : '30';
  const valor = RANGOS[clave];
  const hoy = new Date();
  const desde = valor === 'curso' ? undefined : format(subDays(hoy, valor - 1), 'yyyy-MM-dd');
  const soloNoJustificados = sinJustificar === '1';

  const filas = await listarRetrasos({
    desde,
    hasta: format(hoy, 'yyyy-MM-dd'),
    soloNoJustificados,
    clases: await alcanceClases(user),
  });

  const params = new URLSearchParams();
  if (desde) params.set('desde', desde);
  params.set('hasta', format(hoy, 'yyyy-MM-dd'));

  return (
    <RegistrosPanel
      filas={filas}
      rangoActivo={clave}
      soloNoJustificados={soloNoJustificados}
      exportUrl={`/api/puntualidad/admin/export?${params.toString()}`}
    />
  );
}
