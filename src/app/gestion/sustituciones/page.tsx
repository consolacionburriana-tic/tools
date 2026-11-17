import { hoyEnEspana } from '@/lib/oratorios';
import { listarDia } from '@/lib/sustituciones-server';
import { Hoy } from '@/components/sustituciones/hoy';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sustituciones · Consolación' };

export default async function SustitucionesHoyPage({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  const { fecha: pedida } = await searchParams;
  const hoy = hoyEnEspana();
  const fecha = pedida && /^\d{4}-\d{2}-\d{2}$/.test(pedida) ? pedida : hoy;
  const datos = await listarDia(fecha);
  return (
    <>
      <h1 className="sr-only">Sustituciones de hoy</h1>
      <Hoy inicial={datos} hoy={hoy} />
    </>
  );
}
