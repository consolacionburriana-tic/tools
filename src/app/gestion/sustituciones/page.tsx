import { after } from 'next/server';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-guards';
import { vistaActiva } from '@/lib/jefaturas-server';
import { hoyEnEspana } from '@/lib/oratorios';
import { lunesDe } from '@/lib/sustituciones';
import { datosSemana } from '@/lib/sustituciones-semana-server';
import { profesConHorario, repasarEnviosSilencioso } from '@/lib/sustituciones-server';
import { Calendario, type AbrirAlCargar } from '@/components/sustituciones/calendario';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sustituciones · Consolación' };

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^\d{2}:\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;

type Params = Record<'semana' | 'nueva' | 'ausencia' | 'profe' | 'desde' | 'hasta' | 'tramos' | 'hi' | 'hf' | 'motivo', string | undefined>;

export default async function SustitucionesPage({ searchParams }: { searchParams: Promise<Partial<Params>> }) {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  const sp = await searchParams;
  const hoy = hoyEnEspana();
  const lunes = lunesDe(sp.semana && FECHA.test(sp.semana) ? sp.semana : hoy);
  after(repasarEnviosSilencioso); // cuadra los correos programados con Resend, sin cron
  const [{ vista, modo, propia }, profes] = await Promise.all([vistaActiva(user.email), profesConHorario(hoy)]);
  const datos = await datosSemana(lunes, vista, hoy);

  const abrir: AbrirAlCargar = {};
  if (sp.ausencia && UUID.test(sp.ausencia)) abrir.ausencia = sp.ausencia;
  else if (sp.nueva) {
    const desde = sp.desde && FECHA.test(sp.desde) ? sp.desde : undefined;
    abrir.nueva = {
      profeId: sp.profe && profes.some((p) => p.id === sp.profe) ? sp.profe : undefined,
      desde,
      hasta: sp.hasta && FECHA.test(sp.hasta) && desde && sp.hasta >= desde ? sp.hasta : desde,
      tramos: sp.tramos ? sp.tramos.split(',').filter(Boolean).slice(0, 10) : undefined,
      hi: sp.hi && HORA.test(sp.hi) ? sp.hi : undefined,
      hf: sp.hf && HORA.test(sp.hf) ? sp.hf : undefined,
      motivo: sp.motivo,
    };
  }
  // eslint-disable-next-line react-hooks/purity -- página dinámica: cada petición, una marca nueva (reabre el panel)
  if (abrir.ausencia || abrir.nueva) abrir.marca = Date.now();
  return (
    <>
      <h1 className="sr-only">Sustituciones: la semana</h1>
      <Calendario inicial={datos} hoy={hoy} modoInicial={modo} propia={propia} profes={profes} abrir={abrir} />
    </>
  );
}
