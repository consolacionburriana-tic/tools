export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft } from 'lucide-react';
import { getSessionUser } from '@/lib/auth-guards';
import { DIAS_SEMANA, formatoRetraso, fraseHistorial, indiceDiaSemana, labelJustificacion } from '@/lib/puntualidad';
import { historialAlumno, puedeConRegistro, getAlumno } from '@/lib/puntualidad-server';

export const metadata = { title: 'Ficha de puntualidad · Tools Consolación' };

const fmt = (iso: string, patron = 'EEE d MMM yyyy') => {
  try {
    return format(parseISO(iso), patron, { locale: es });
  } catch {
    return iso;
  }
};

function Barras({ filas }: { filas: { nombre: string; valor: number }[] }) {
  const max = Math.max(1, ...filas.map((f) => f.valor));
  if (filas.length === 0) return <p className="text-sm text-zinc-400">Sin datos.</p>;
  return (
    <ul className="space-y-2">
      {filas.map((f) => (
        <li key={f.nombre} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate text-zinc-700 dark:text-zinc-200">{f.nombre}</span>
            <span className="tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">{f.valor}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div className="h-full rounded-full bg-orange-400" style={{ width: `${(f.valor / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// Ficha de un alumno: su historial completo del curso y dónde se le acumulan los retrasos
// (¿siempre la misma asignatura? ¿siempre los lunes?). Es la pantalla que se abre desde el
// dashboard y desde el listado.
export default async function FichaAlumnoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');

  const { id } = await params;
  const alumno = await getAlumno(id);
  if (!alumno) notFound();
  if (!(await puedeConRegistro(user, { curso: alumno.curso, letra: alumno.letra }))) {
    redirect('/gestion/puntualidad');
  }

  const hoy = format(new Date(), 'yyyy-MM-dd');
  const historial = await historialAlumno(id, hoy);
  if (!historial) notFound();

  const { retrasos, resumen, consecuencias } = historial;

  const cuenta = (claves: (string | null)[]) => {
    const m = new Map<string, number>();
    for (const k of claves) m.set(k ?? '—', (m.get(k ?? '—') ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([nombre, valor]) => ({ nombre, valor }));
  };

  const porDia = DIAS_SEMANA.slice(0, 5)
    .map((dia, i) => ({ nombre: dia, valor: retrasos.filter((r) => indiceDiaSemana(r.fecha) === i).length }))
    .filter((d) => d.valor > 0);

  return (
    <div className="space-y-6">
      <Link
        href="/gestion/puntualidad"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-orange-600"
      >
        <ChevronLeft className="h-4 w-4" /> Puntualidad
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{historial.alumno.nombre}</h1>
          <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            {historial.alumno.clase}
          </span>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {resumen.total === 0
            ? 'Ni un retraso este curso.'
            : `${resumen.total} ${resumen.total === 1 ? 'retraso' : 'retrasos'} este curso · ${
                resumen.noJustificados
              } sin justificar · ${resumen.enCiclo} en el ciclo actual (a los 3, consecuencia).`}
        </p>
        {resumen.total > 0 && (
          <p className="text-sm text-zinc-400">{fraseHistorial(resumen, (iso) => fmt(iso, 'd MMM'))}</p>
        )}
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Por asignatura</h2>
          <Barras filas={cuenta(retrasos.map((r) => r.asignatura))} />
        </div>
        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Por día de la semana</h2>
          <Barras filas={porDia} />
        </div>
        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Quién lo registra</h2>
          <Barras filas={cuenta(retrasos.map((r) => r.profe))} />
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Consecuencias ({consecuencias.length})
        </h2>
        {consecuencias.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-200 py-6 text-center text-sm text-zinc-400 dark:border-zinc-700">
            Ninguna todavía.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {consecuencias.map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline gap-3 px-4 py-3 text-sm">
                <span className="font-medium text-zinc-800 dark:text-zinc-100">
                  {c.fecha ? `Sin patio el ${fmt(c.fecha, 'EEE d MMM')}` : 'Pendiente de fecha'}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-zinc-400">{c.motivo}</span>
                {c.cumplida && (
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                    cumplida
                  </span>
                )}
                {c.avisadaEducamos && (
                  <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                    Educamos
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Todos los retrasos del curso</h2>
        {retrasos.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-200 py-6 text-center text-sm text-zinc-400 dark:border-zinc-700">
            Ninguno.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {retrasos.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline gap-3 px-4 py-2.5 text-sm">
                <span className="w-32 shrink-0 capitalize text-zinc-700 dark:text-zinc-200">{fmt(r.fecha)}</span>
                <span className="w-14 shrink-0 tabular-nums text-zinc-500">{r.hora}</span>
                <span className="w-20 shrink-0 text-xs text-zinc-400">{formatoRetraso(r.minutosRetraso)}</span>
                <span className="min-w-0 flex-1 truncate text-zinc-500">{r.asignatura ?? 'sin asignatura'}</span>
                {r.justificado && (
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                    {labelJustificacion(r.justificacionTipo) || 'justificado'}
                  </span>
                )}
                {r.subeAClase && <span className="text-[10px] text-sky-600 dark:text-sky-400">sube a clase</span>}
                {r.observaciones && <span className="w-full text-xs text-zinc-400">{r.observaciones}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
