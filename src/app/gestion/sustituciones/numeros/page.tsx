import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-guards';
import { etapasActivas } from '@/lib/jefaturas-server';
import { appBaseUrl } from '@/lib/constants';
import { hoyEnEspana } from '@/lib/oratorios';
import { mesAnterior, PERIODOS_CIFRAS, type PeriodoCifras } from '@/lib/sustituciones';
import { correoInforme } from '@/lib/sustituciones-email';
import { cifras, informeMes } from '@/lib/sustituciones-server';
import { Numeros } from '@/components/sustituciones/numeros';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Números · Sustituciones' };

export default async function NumerosPage({ searchParams }: { searchParams: Promise<{ periodo?: string; etapa?: string }> }) {
  const sp = await searchParams;
  const periodo: PeriodoCifras = (PERIODOS_CIFRAS as readonly string[]).includes(sp.periodo ?? '') ? (sp.periodo as PeriodoCifras) : 'mes';
  const hoy = hoyEnEspana();
  const mes = mesAnterior(hoy);
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  // Sin elegir, lo de su jefatura (o todo, si no lleva ninguna).
  const etapa = sp.etapa && ['EI', 'EP', 'ESO', 'todas', 'infantil-primaria', 'eso'].includes(sp.etapa) ? sp.etapa : (await etapasActivas(user.email)).grupo;
  const [c, inf] = await Promise.all([cifras(periodo, hoy, etapa), informeMes(mes)]);
  const { subject, html } = correoInforme({ mes, delMes: inf.delMes, delCurso: inf.delCurso, curso: inf.curso, enlace: `${appBaseUrl()}/gestion/sustituciones/numeros` });
  return (
    <>
      <h1 className="sr-only">Números de sustituciones</h1>
      <Numeros
        datos={{
          ...c,
          informe: { mes, html, asunto: subject, destinatarios: inf.destinatarios, opcionesDestinatarios: inf.opcionesDestinatarios, enviado: inf.enviado ? { at: inf.enviado.at.toISOString(), destinatarios: inf.enviado.destinatarios } : null },
        }}
      />
    </>
  );
}
