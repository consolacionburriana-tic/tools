'use client';

// 📊 Números: hechas / programadas / por hacer por clase y unidad (mes o trimestre, según el
// objetivo del tipo), a qué profes se ha molestado más y cuántas fechas hay cada mes.
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { nombreClase } from '@/lib/cursos';
import { clasesDeTipo, molestiasPorProfe, nombreMesCorto, progresoTipo, sesionesPorMes, unidadesCurso, type CeldaProgreso } from '@/lib/oratorios';
import { FRECUENCIA_LABELS } from '@/lib/oratorios';
import { SelectorTipo, Puntos } from './planificar';
import type { Estado } from './panel';

function Tarjeta({ emoji, n, texto, tono }: { emoji: string; n: number; texto: string; tono: string }) {
  return (
    <div className={cn('rounded-2xl border p-3', tono)}>
      <p className="text-2xl font-bold tabular-nums">
        {emoji} {n}
      </p>
      <p className="text-xs opacity-80">{texto}</p>
    </div>
  );
}

function Celda({ c }: { c: CeldaProgreso }) {
  // Verde solo si está cubierto de verdad (hechas + programadas); con borradores, gris.
  const cubierto = c.hechas + c.programadas >= c.esperadas;
  const conBorrador = !cubierto && c.porHacer === 0;
  const empezado = c.hechas + c.programadas + c.borradores > 0;
  return (
    <td
      className={cn(
        'px-1.5 py-1 text-center',
        cubierto ? 'bg-emerald-50 dark:bg-emerald-500/10' : conBorrador ? 'bg-zinc-50 dark:bg-zinc-800/40' : empezado ? 'bg-amber-50 dark:bg-amber-500/10' : '',
      )}
      title={`✔️ ${c.hechas} · 📅 ${c.programadas} · 📝 ${c.borradores} · ○ ${c.porHacer}`}
    >
      <Puntos t={c} />
    </td>
  );
}

export function Numeros({ e }: { e: Estado }) {
  const tipo = e.tipos.find((t) => t.id === e.tipoId) ?? e.tipos[0];
  const hoy = e.datos.hoy;
  const clases = useMemo(() => (tipo ? clasesDeTipo(tipo, e.datos.clases) : []), [tipo, e.datos.clases]);
  const unidades = useMemo(() => (tipo ? unidadesCurso(tipo.frecuencia, e.ajustes.trimestres) : []), [tipo, e.ajustes.trimestres]);
  const filas = useMemo(() => (tipo ? progresoTipo(tipo, clases, e.sesiones, unidades, hoy) : []), [tipo, clases, e.sesiones, unidades, hoy]);
  const molestias = useMemo(() => molestiasPorProfe(e.sesiones, e.ajustes.trimestres), [e.sesiones, e.ajustes.trimestres]);
  const porMes = useMemo(() => sesionesPorMes(e.sesiones), [e.sesiones]);
  if (!tipo) return null;

  const total = filas.reduce(
    (a, f) => ({ hechas: a.hechas + f.total.hechas, programadas: a.programadas + f.total.programadas, borradores: a.borradores + f.total.borradores, porHacer: a.porHacer + f.total.porHacer }),
    { hechas: 0, programadas: 0, borradores: 0, porHacer: 0 },
  );
  // Por número de sesión: «Sesión 1: 8 hechas…» — lo que pidió David para el recuento general.
  const maxNumero = Math.max(0, ...e.sesiones.filter((s) => s.tipoId === tipo.id && s.estado !== 'anulado').map((s) => s.numero));
  const porNumero = Array.from({ length: maxNumero }, (_, i) => {
    const de = e.sesiones.filter((s) => s.tipoId === tipo.id && s.numero === i + 1);
    return {
      n: i + 1,
      hechas: de.filter((s) => s.estado === 'confirmado' && s.fecha < hoy).length,
      programadas: de.filter((s) => s.estado === 'confirmado' && s.fecha >= hoy).length,
      borradores: de.filter((s) => s.estado === 'borrador').length,
      faltan: Math.max(0, clases.length - de.filter((s) => s.estado === 'confirmado' || s.estado === 'borrador').length),
    };
  });
  const maxMolestia = Math.max(1, ...molestias.map((m) => m.total + m.borradores));
  const meses = [...porMes.keys()].sort();

  return (
    <div className="space-y-5">
      <SelectorTipo e={e} />
      <p className="text-sm text-zinc-500">
        🎯 {tipo.cantidad} {FRECUENCIA_LABELS[tipo.frecuencia]} por clase · {clases.length} clases
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tarjeta emoji="✔️" n={total.hechas} texto="Hechas" tono="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200" />
        <Tarjeta emoji="📅" n={total.programadas} texto="Programadas" tono="border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200" />
        <Tarjeta emoji="📝" n={total.borradores} texto="Borradores" tono="border-zinc-200 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200" />
        <Tarjeta emoji="○" n={total.porHacer} texto="Por hacer" tono="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200" />
      </div>

      {/* Clase × unidad */}
      <div className="-mx-4 overflow-x-auto px-4">
        <table className="w-full min-w-max overflow-hidden rounded-xl border border-zinc-200 bg-white text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-800/60">
            <tr>
              <th className="px-2 py-1.5 text-left">Clase</th>
              {unidades.map((u) => (
                <th key={u.clave} className="px-1.5 py-1.5">
                  {u.etiqueta}
                </th>
              ))}
              <th className="px-2 py-1.5">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filas.map((f) => (
              <tr key={f.clave}>
                <td className="px-2 py-1 font-medium whitespace-nowrap">{nombreClase(f.clase.curso, f.clase.letra)}</td>
                {f.celdas.map((c, i) => (
                  <Celda key={i} c={c} />
                ))}
                <td className="px-2 py-1 text-center text-xs whitespace-nowrap tabular-nums">
                  {f.total.hechas + f.total.programadas}/{f.total.esperadas}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-[11px] text-zinc-400">
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500" />
          hecha · <span className="mx-1 inline-block h-2 w-2 rounded-full bg-blue-500" />
          programada · <span className="mx-1 inline-block h-2 w-2 rounded-full bg-zinc-400" />
          borrador · <span className="mx-1 inline-block h-2 w-2 rounded-full ring-1 ring-zinc-300" />
          por hacer
        </p>
      </div>

      {/* Por número de sesión */}
      {porNumero.length > 0 && (
        <section className="space-y-1">
          <h3 className="text-sm font-semibold">#️⃣ Por sesión</h3>
          <div className="flex flex-wrap gap-2">
            {porNumero.map((p) => (
              <div key={p.n} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900">
                <b>
                  {tipo.emoji} S{p.n}
                </b>{' '}
                <span className="tabular-nums">
                  ✔️{p.hechas} 📅{p.programadas} {p.borradores > 0 && `📝${p.borradores} `}○{p.faltan}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Molestias por profe */}
      <section className="space-y-1">
        <h3 className="text-sm font-semibold">🙋 A quién se ha quitado la hora (todos los tipos)</h3>
        {molestias.length === 0 ? (
          <p className="text-sm text-zinc-500">Todavía a nadie.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <thead className="text-xs text-zinc-500">
                <tr>
                  <th className="py-1 pr-2 text-left">Profe</th>
                  {e.ajustes.trimestres.map((_, i) => (
                    <th key={i} className="px-2 py-1">
                      T{i + 1}
                    </th>
                  ))}
                  <th className="px-2 py-1">Total</th>
                  <th className="w-1/3" />
                </tr>
              </thead>
              <tbody>
                {molestias.map((m) => (
                  <tr key={m.profeId} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="py-1 pr-2 whitespace-nowrap">{m.nombre}</td>
                    {m.porTrimestre.map((n, i) => (
                      <td key={i} className={cn('px-2 py-1 text-center tabular-nums', n >= 3 ? 'font-bold text-rose-600' : n === 2 ? 'font-semibold text-orange-600' : '')}>
                        {n || '·'}
                      </td>
                    ))}
                    <td className="px-2 py-1 text-center font-semibold tabular-nums">
                      {m.total}
                      {m.borradores > 0 && <span className="ml-1 text-xs font-normal text-zinc-400">+{m.borradores}📝</span>}
                    </td>
                    <td className="py-1">
                      <div className="flex h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div className="bg-blue-500" style={{ width: `${(m.total / maxMolestia) * 100}%` }} />
                        <div className="bg-zinc-300 dark:bg-zinc-600" style={{ width: `${(m.borradores / maxMolestia) * 100}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Por mes */}
      {meses.length > 0 && (
        <section className="space-y-1">
          <h3 className="text-sm font-semibold">🗓️ Fechas por mes</h3>
          <div className="flex flex-wrap gap-2">
            {meses.map((mes) => (
              <div key={mes} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900">
                <b className="capitalize">{nombreMesCorto(Number(mes.slice(5, 7)))}</b>{' '}
                {e.tipos
                  .filter((t) => porMes.get(mes)?.get(t.id))
                  .map((t) => (
                    <span key={t.id} className="ml-1 tabular-nums">
                      {t.emoji}
                      {porMes.get(mes)!.get(t.id)}
                    </span>
                  ))}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
