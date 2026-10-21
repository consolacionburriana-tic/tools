export const dynamic = 'force-dynamic';

import { notFound, redirect } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { getSessionUser } from '@/lib/auth-guards';
import { DIAS_SEMANA, formatoRetraso, fraseHistorial, indiceDiaSemana, labelJustificacion } from '@/lib/puntualidad';
import { historialAlumno, puedeConRegistro, getAlumno } from '@/lib/puntualidad-server';
import { EnlaceVolver, TituloPagina } from '@/components/ui/cabecera-modulo';
import { Estado } from '@/components/ui/estado';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Rotulo } from '@/components/ui/rotulo';
import { Tarjeta, TarjetaCabecera, TarjetaCuerpo, claseTarjeta } from '@/components/ui/tarjeta';
import { Vacio } from '@/components/ui/vacio';

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
  if (filas.length === 0) return <p className="text-sm text-zinc-500 dark:text-zinc-400">Sin datos.</p>;
  return (
    <ul className="space-y-2">
      {filas.map((f) => (
        <li key={f.nombre} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate text-zinc-700 dark:text-zinc-200">{f.nombre}</span>
            <span className="tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">{f.valor}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div className="h-full rounded-full bg-[var(--datos-1)]" style={{ width: `${(f.valor / max) * 100}%` }} />
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
      <div>
        <EnlaceVolver href="/gestion/puntualidad">Panel</EnlaceVolver>
        <TituloPagina
          className="mt-1 mb-0"
          descripcion={
            <>
              {resumen.total === 0
                ? 'Ni un retraso este curso.'
                : `${resumen.total} ${resumen.total === 1 ? 'retraso' : 'retrasos'} este curso · ${
                    resumen.noJustificados
                  } sin justificar · ${resumen.enCiclo} en el ciclo actual (a los 3, consecuencia).`}
              {resumen.total > 0 && (
                <span className="mt-1 block">{fraseHistorial(resumen, (iso) => fmt(iso, 'd MMM'))}</span>
              )}
            </>
          }
        >
          {historial.alumno.nombre} <Etiqueta className="ml-1 align-middle">{historial.alumno.clase}</Etiqueta>
        </TituloPagina>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Tarjeta as="section">
          <TarjetaCabecera titulo="Por asignatura" />
          <TarjetaCuerpo>
            <Barras filas={cuenta(retrasos.map((r) => r.asignatura))} />
          </TarjetaCuerpo>
        </Tarjeta>
        <Tarjeta as="section">
          <TarjetaCabecera titulo="Por día de la semana" />
          <TarjetaCuerpo>
            <Barras filas={porDia} />
          </TarjetaCuerpo>
        </Tarjeta>
        <Tarjeta as="section">
          <TarjetaCabecera titulo="Quién lo registra" />
          <TarjetaCuerpo>
            <Barras filas={cuenta(retrasos.map((r) => r.profe))} />
          </TarjetaCuerpo>
        </Tarjeta>
      </div>

      <section className="space-y-2">
        <Rotulo>Consecuencias ({consecuencias.length})</Rotulo>
        {consecuencias.length === 0 ? (
          <Vacio titulo="Ninguna todavía." />
        ) : (
          <ul className={`${claseTarjeta} divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800`}>
            {consecuencias.map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline gap-3 px-4 py-3 text-sm">
                <span className="font-medium text-zinc-800 dark:text-zinc-100">
                  {c.fecha ? `Sin patio el ${fmt(c.fecha, 'EEE d MMM')}` : 'Pendiente de fecha'}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-zinc-500 dark:text-zinc-400">{c.motivo}</span>
                {c.cumplida && (
                  <Estado tono="ok">cumplida</Estado>
                )}
                {c.avisadaEducamos && (
                  <Estado tono="info">Educamos</Estado>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <Rotulo>Todos los retrasos del curso</Rotulo>
        {retrasos.length === 0 ? (
          <Vacio titulo="Ningún retraso este curso." />
        ) : (
          <ul className={`${claseTarjeta} divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800`}>
            {retrasos.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline gap-3 px-4 py-2.5 text-sm">
                <span className="w-32 shrink-0 capitalize text-zinc-700 dark:text-zinc-200">{fmt(r.fecha)}</span>
                <span className="w-14 shrink-0 tabular-nums text-zinc-500">{r.hora}</span>
                <span className="w-20 shrink-0 text-xs text-zinc-500 dark:text-zinc-400">{formatoRetraso(r.minutosRetraso)}</span>
                <span className="min-w-0 flex-1 truncate text-zinc-500">{r.asignatura ?? 'sin asignatura'}</span>
                {r.justificado && (
                  <Estado tono="ok">{labelJustificacion(r.justificacionTipo) || 'justificado'}</Estado>
                )}
                {r.subeAClase && <span className="text-xs text-zinc-500 dark:text-zinc-400">sube a clase</span>}
                {r.observaciones && <span className="w-full text-xs text-zinc-500 dark:text-zinc-400">{r.observaciones}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
