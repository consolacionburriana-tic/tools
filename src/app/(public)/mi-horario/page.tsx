import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarDays, ChevronLeft } from 'lucide-react';

import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { getProfePorEmail } from '@/lib/mihorario-server';
import { getCeldas, getPeriodos, getPeriodoVigente } from '@/lib/horarios-server';
import { Navegador } from '@/components/horarios/navegador';
import { SelectorPeriodo } from '@/components/horarios/selector-periodo';
import { Exportador } from '@/components/mihorario/exportador';

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

  const celdas = profe && periodo ? await getCeldas(periodo.id, 'profe', profe.id) : [];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="container mx-auto flex h-14 max-w-4xl items-center justify-between gap-3 px-4">
          <span className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <CalendarDays className="h-4 w-4 text-indigo-500" />
            Mi horario
          </span>
          <Link
            href="/gestion"
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <ChevronLeft className="h-4 w-4" /> <span className="hidden sm:inline">Escritorio</span>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl space-y-5 px-4 py-5">
        {!profe ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
              Tu correo ({user.email}) no está enlazado a ningún profesor en la BBDD central.
            </p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Habla con TIC para que lo revisen.</p>
          </div>
        ) : !periodo ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Todavía no hay ningún horario importado.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                  {[profe.nombre, profe.apellido1].filter(Boolean).join(' ')}
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {periodo.nombre} · curso {periodo.academicYear}
                </p>
              </div>
              {periodos.length > 1 && <SelectorPeriodo periodos={periodos} actual={periodo.id} basePath="/mi-horario" />}
            </div>

            <Navegador celdas={celdas} titulo="tu horario" />

            <Exportador periodoId={periodo.id} />
          </>
        )}
      </main>
    </div>
  );
}
