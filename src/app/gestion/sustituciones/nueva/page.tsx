import { hoyEnEspana } from '@/lib/oratorios';
import { profesConHorario } from '@/lib/sustituciones-server';
import { NuevaAusencia } from '@/components/sustituciones/nueva';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Nueva ausencia · Sustituciones' };

export default async function NuevaAusenciaPage({ searchParams }: { searchParams: Promise<{ profe?: string; fecha?: string }> }) {
  const [sp, profes] = await Promise.all([searchParams, profesConHorario()]);
  const fecha = sp.fecha && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) ? sp.fecha : undefined;
  return <NuevaAusencia profes={profes} hoy={hoyEnEspana()} inicial={{ profeId: profes.some((p) => p.id === sp.profe) ? sp.profe : undefined, fecha }} />;
}
