export const dynamic = 'force-dynamic';

import { GraduationCap, History, TriangleAlert, Users } from 'lucide-react';
import { EnlaceVolver, TituloPagina } from '@/components/ui/cabecera-modulo';
import { Estado } from '@/components/ui/estado';
import { Tarjeta } from '@/components/ui/tarjeta';
import { Vacio } from '@/components/ui/vacio';
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
    <>
      <EnlaceVolver href="/gestion/educamos">BBDD central</EnlaceVolver>
      <TituloPagina descripcion="Las últimas 50, de alumnado y de profesorado">Historial de sincronizaciones</TituloPagina>

      <div className="anim-stagger space-y-2.5">
        {runs.length === 0 && (
          <Vacio icono={<History aria-hidden />} titulo="Todavía no se ha sincronizado nada" />
        )}

        {runs.map((run) => {
          const tipo = tipoDe(run);
          const r = run.resumen;
          const errores = r?.errores ?? [];
          return (
            <Tarjeta as="article" key={run.id} className="p-4">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Estado
                  tono="neutro"
                  icono={tipo === 'alumnado' ? <GraduationCap aria-hidden /> : <Users aria-hidden />}
                >
                  {tipo === 'alumnado' ? 'Alumnado' : 'Profesorado'}
                </Estado>
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{fmt(run.createdAt)}</span>
                {run.quienEmail && <span className="text-xs text-zinc-500 dark:text-zinc-400">· {run.quienEmail}</span>}
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
                  <summary className="inline-flex min-h-10 cursor-pointer items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                    <TriangleAlert className="h-3.5 w-3.5" /> {errores.length} aviso(s)
                  </summary>
                  <ul className="mt-1 list-inside list-disc text-xs text-amber-700 dark:text-amber-300">
                    {errores.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </details>
              )}
            </Tarjeta>
          );
        })}
      </div>
    </>
  );
}
