export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { ChevronLeft, GraduationCap, History, TriangleAlert, Users } from 'lucide-react';
import { getSyncRuns } from '@/lib/educamos-server';

export const metadata = { title: 'Historial de sincronizaciones · Educamos' };

const fmt = (d: Date) =>
  new Date(d).toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Las filas anteriores a la columna `tipo` marcaban el profesorado en `opciones.tipo`. */
function tipoDe(run: { tipo: string; opciones: Record<string, unknown> | null }): 'alumnado' | 'profesorado' {
  if (run.opciones?.tipo === 'profesores') return 'profesorado';
  return run.tipo === 'profesorado' ? 'profesorado' : 'alumnado';
}

export default async function HistorialSyncsPage() {
  const runs = await getSyncRuns(50);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-100">
              <History className="h-5 w-5 text-blue-600 dark:text-blue-400" /> Historial de sincronizaciones
            </h1>
            <p className="text-xs text-zinc-500">Las últimas 50, de alumnado y de profesorado</p>
          </div>
          <Link
            href="/gestion/educamos"
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
          >
            <ChevronLeft className="h-4 w-4" /> BBDD central
          </Link>
        </div>
      </header>

      <main className="anim-stagger mx-auto max-w-2xl space-y-2.5 px-4 py-6">
        {runs.length === 0 && (
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
            Todavía no se ha sincronizado nada.
          </p>
        )}

        {runs.map((run) => {
          const tipo = tipoDe(run);
          const r = run.resumen;
          const errores = r?.errores ?? [];
          return (
            <article
              key={run.id}
              className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    tipo === 'alumnado'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                  }`}
                >
                  {tipo === 'alumnado' ? <GraduationCap className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                  {tipo === 'alumnado' ? 'Alumnado' : 'Profesorado'}
                </span>
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{fmt(run.createdAt)}</span>
                {run.quienEmail && <span className="text-xs text-zinc-400">· {run.quienEmail}</span>}
              </div>

              {run.filename && (
                <p className="mt-1 truncate text-xs text-zinc-500">
                  {run.filename}
                  {run.formato && ` · ${run.formato}`}
                </p>
              )}

              {r && (
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-zinc-600 dark:text-zinc-300">
                  <span>
                    <strong className="text-zinc-900 dark:text-zinc-100">{r.altas}</strong> altas
                  </span>
                  <span>
                    <strong className="text-zinc-900 dark:text-zinc-100">{r.cambios}</strong> cambios
                  </span>
                  <span>
                    <strong className="text-zinc-900 dark:text-zinc-100">{r.desactivados}</strong>{' '}
                    {tipo === 'alumnado' ? 'desactivados' : 'con baja'}
                  </span>
                  {r.sinCambios !== undefined && <span>{r.sinCambios} sin cambios</span>}
                  {r.conflictosResueltos > 0 && <span>{r.conflictosResueltos} conflictos resueltos</span>}
                  {r.tutores !== undefined && <span>{r.tutores} tutores</span>}
                  {r.vinculos !== undefined && <span>{r.vinculos} vínculos</span>}
                </div>
              )}

              {errores.length > 0 && (
                <details className="mt-2">
                  <summary className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                    <TriangleAlert className="h-3.5 w-3.5" /> {errores.length} aviso(s)
                  </summary>
                  <ul className="mt-1 list-inside list-disc text-xs text-amber-700 dark:text-amber-300">
                    {errores.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </details>
              )}
            </article>
          );
        })}
      </main>
    </div>
  );
}
