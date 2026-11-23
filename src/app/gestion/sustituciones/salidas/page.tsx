import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-guards';
import { etapasActivas } from '@/lib/jefaturas-server';
import { hoyEnEspana } from '@/lib/oratorios';
import { gruposDelHorario, listarSalidas, sobrantesDeSalidas } from '@/lib/sustituciones-salidas-server';
import { profesConHorario } from '@/lib/sustituciones-server';
import { Salidas } from '@/components/sustituciones/salidas';
import { FiltroJefatura } from '@/components/sustituciones/comun';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Salidas · Sustituciones' };

export default async function SalidasPage() {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  const hoy = hoyEnEspana();
  const { grupo, etapas } = await etapasActivas(user.email);
  const [{ proximas, pasadas }, grupos, profes] = await Promise.all([listarSalidas(etapas, hoy), gruposDelHorario(), profesConHorario(hoy)]);
  const sobrantes = await sobrantesDeSalidas(proximas.map((s) => s.id));
  return (
    <div className="space-y-5">
      <h1 className="sr-only">Salidas</h1>
      <FiltroJefatura grupo={grupo} />
      <Salidas proximas={proximas} pasadas={pasadas} sobrantes={sobrantes} grupos={grupos} profes={profes} etapas={grupo === 'todas' ? [] : etapas} hoy={hoy} />
    </div>
  );
}
