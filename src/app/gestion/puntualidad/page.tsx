export const dynamic = 'force-dynamic';

import { format, subDays } from 'date-fns';
import { getSessionUser } from '@/lib/auth-guards';
import { redirect } from 'next/navigation';
import { alcanceClases, dashboard, ensureTiposConsecuencia } from '@/lib/puntualidad-server';
import { DashboardPanel } from '@/components/puntualidad/dashboard-panel';

export const metadata = { title: 'Puntualidad · Tools Consolación' };

// Rangos del dashboard. 'curso' arranca en septiembre (el curso académico en vigor).
const RANGOS: Record<string, number | 'curso'> = { '7': 7, '30': 30, '90': 90, curso: 'curso' };

function inicioDeCurso(hoy = new Date()): Date {
  const año = hoy.getMonth() + 1 >= 9 ? hoy.getFullYear() : hoy.getFullYear() - 1;
  return new Date(año, 8, 1); // 1 de septiembre
}

export default async function PuntualidadDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ rango?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');

  const { rango } = await searchParams;
  const clave = rango && rango in RANGOS ? rango : '30';
  const valor = RANGOS[clave];
  const hoy = new Date();
  const desde = valor === 'curso' ? inicioDeCurso(hoy) : subDays(hoy, valor - 1);

  await ensureTiposConsecuencia();
  const datos = await dashboard({
    desde: format(desde, 'yyyy-MM-dd'),
    hasta: format(hoy, 'yyyy-MM-dd'),
    clases: await alcanceClases(user),
  });

  return <DashboardPanel datos={datos} rangoActivo={clave} />;
}
