import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-guards';
import { etapasActivas } from '@/lib/jefaturas-server';
import { academicYearActual } from '@/lib/constants';
import { ETAPAS, type Etapa } from '@/lib/cursos';
import { disponibilidad } from '@/lib/sustituciones-server';
import { Disponibilidad } from '@/components/sustituciones/disponibilidad';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Disponibilidad · Sustituciones' };

export default async function DisponibilidadPage({ searchParams }: { searchParams: Promise<{ profe?: string; vista?: string; etapa?: string }> }) {
  const sp = await searchParams;
  const profeId = sp.profe && /^[0-9a-f-]{36}$/i.test(sp.profe) ? sp.profe : null;
  const datos = await disponibilidad(academicYearActual(), profeId);
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  // Sin elegir, la primera etapa de su jefatura.
  const activas = await etapasActivas(user.email);
  const etapa = (ETAPAS as readonly string[]).includes(sp.etapa ?? '') ? (sp.etapa as Etapa) : activas.grupo !== 'todas' ? activas.etapas[0] : null;
  return (
    <>
      <h1 className="sr-only">Disponibilidad del profesorado</h1>
      <Disponibilidad inicial={datos} vistaInicial={sp.vista === 'semana' ? 'semana' : 'profe'} etapaInicial={etapa} />
    </>
  );
}
