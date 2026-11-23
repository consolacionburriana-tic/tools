import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-guards';
import { etapasActivas } from '@/lib/jefaturas-server';
import { hoyEnEspana, sumarDias } from '@/lib/oratorios';
import { cursoDeFecha } from '@/lib/sustituciones';
import { CONFIGURACION } from '@/lib/configuracion';
import { listarHistorial, profesConAusencias } from '@/lib/sustituciones-server';
import { Historial } from '@/components/sustituciones/historial';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Historial · Sustituciones' };

/** Los meses del curso hasta el actual, del más reciente al más antiguo. */
function mesesDelCurso(hoy: string): string[] {
  const inicio = `${cursoDeFecha(hoy).slice(0, 4)}-${String(CONFIGURACION.calendario.mesInicioCurso).padStart(2, '0')}`;
  const meses: string[] = [];
  for (let m = hoy.slice(0, 7); m >= inicio; m = sumarDias(`${m}-01`, -1).slice(0, 7)) meses.push(m);
  return meses;
}

export default async function HistorialPage({ searchParams }: { searchParams: Promise<{ mes?: string; profe?: string }> }) {
  const sp = await searchParams;
  const mes = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : null;
  const profeId = sp.profe && /^[0-9a-f-]{36}$/i.test(sp.profe) ? sp.profe : null;
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  const { grupo, etapas } = await etapasActivas(user.email);
  const [filas, profes] = await Promise.all([listarHistorial({ mes, profeId, etapas }), profesConAusencias()]);
  const meses = mesesDelCurso(hoyEnEspana());
  if (mes && !meses.includes(mes)) meses.push(mes);
  return (
    <>
      <h1 className="sr-only">Historial de ausencias</h1>
      <Historial filas={filas} meses={meses} profes={profes} mes={mes} profeId={profeId} grupoEtapas={grupo} />
    </>
  );
}
