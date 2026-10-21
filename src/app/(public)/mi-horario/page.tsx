import { redirect } from 'next/navigation';
import { CalendarDays, UserX } from 'lucide-react';

import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { getProfePorEmail } from '@/lib/mihorario-server';
import { getCeldas, getFranjasDeProfe, getPeriodos, getPeriodoVigente } from '@/lib/horarios-server';
import { Navegador } from '@/components/horarios/navegador';
import { SelectorPeriodo } from '@/components/horarios/selector-periodo';
import { Exportador } from '@/components/mihorario/exportador';
import { Vacio } from '@/components/ui/vacio';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Mi horario · Consolación',
  description: 'Tu horario, y llevártelo a Google Calendar',
};

export default async function MiHorarioPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const sp = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login?volver=/mi-horario');
  if (!canAccess(user, 'mi-horario')) redirect('/gestion/sin-acceso');

  const profe = await getProfePorEmail(user.email);

  const periodos = await getPeriodos();
  const vigente = await getPeriodoVigente();
  const periodo = periodos.find((p) => p.id === sp.periodo) ?? vigente;

  // Las franjas (recreo y horas sin clase) van en paralelo a las celdas: son dos consultas
  // independientes y un viaje a Neon cuesta ~127 ms.
  const [celdas, franjas] =
    profe && periodo
      ? await Promise.all([getCeldas(periodo.id, 'profe', profe.id), getFranjasDeProfe(periodo.id, profe.id)])
      : [[], []];

  return (
    <div className="space-y-5">
      <h1 className="sr-only">Mi horario</h1>
      {!profe ? (
        <Vacio icono={<UserX />} titulo="Tu correo no está enlazado a ningún profesor">
          {user.email} no aparece en la BBDD central. Habla con TIC para que lo revisen.
        </Vacio>
      ) : !periodo ? (
        <Vacio icono={<CalendarDays />} titulo="Todavía no hay ningún horario importado" />
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {[profe.nombre, profe.apellido1].filter(Boolean).join(' ')}
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {periodo.nombre} · curso {periodo.academicYear}
              </p>
            </div>
            {periodos.length > 1 && <SelectorPeriodo periodos={periodos} actual={periodo.id} basePath="/mi-horario" />}
          </div>

          <Navegador celdas={celdas} franjas={franjas} titulo="tu horario" editable={{ periodoId: periodo.id }} />

          <Exportador periodoId={periodo.id} />
        </>
      )}
    </div>
  );
}
