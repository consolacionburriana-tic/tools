import { after } from 'next/server';
import { notFound } from 'next/navigation';
import { hoyEnEspana } from '@/lib/oratorios';
import { ErrorSustitucion, fichaAusencia, repasarEnviosSilencioso } from '@/lib/sustituciones-server';
import { FichaAusencia } from '@/components/sustituciones/ficha';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ausencia · Sustituciones' };

export default async function AusenciaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  after(repasarEnviosSilencioso); // cuadra los correos programados con Resend, sin cron
  const ficha = await fichaAusencia(id).catch((e) => {
    if (e instanceof ErrorSustitucion && e.status === 404) return null;
    throw e;
  });
  if (!ficha) notFound();
  return <FichaAusencia ficha={ficha} hoy={hoyEnEspana()} />;
}
