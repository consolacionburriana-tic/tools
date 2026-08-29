'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, Lightbulb, MessageSquareQuote, Users } from 'lucide-react';
import { LetraBadge } from '@/components/evaluaciones/color-picker';
import { claseLabel, escalaDe, tonoDe } from '@/lib/evaluaciones';
import type { Resultados } from '@/lib/evaluaciones-server';

const TONO_BARRA: Record<string, string> = {
  bien: 'bg-emerald-500',
  regular: 'bg-amber-500',
  flojo: 'bg-rose-500',
  sin: 'bg-zinc-300 dark:bg-zinc-700',
};

const TONO_TEXTO: Record<string, string> = {
  bien: 'text-emerald-600 dark:text-emerald-400',
  regular: 'text-amber-600 dark:text-amber-400',
  flojo: 'text-rose-600 dark:text-rose-400',
  sin: 'text-zinc-400',
};

function Nota({ pct, escala }: { pct: number | null; escala: string }) {
  if (pct === null) return <span className="text-xs text-zinc-400">sin datos</span>;
  const puntos = escalaDe(escala).puntos;
  const min = puntos[0].valor;
  const max = puntos[puntos.length - 1].valor;
  const enEscala = min + (pct / 100) * (max - min);
  return (
    <span className={`text-sm font-bold tabular-nums ${TONO_TEXTO[tonoDe(pct)]}`}>
      {enEscala.toFixed(1)}
      <span className="text-[10px] font-normal text-zinc-400"> / {max}</span>
    </span>
  );
}

function Barra({ pct }: { pct: number | null }) {
  return (
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
      <div className={`h-2 rounded-full transition-all ${TONO_BARRA[tonoDe(pct)]}`} style={{ width: `${pct ?? 0}%` }} />
    </div>
  );
}

/**
 * Color de un punto de la escala dentro de la rampa ordinal. Un solo tono de claro
 * a oscuro (nunca colores distintos por opción: "Poco" y "Mucho" no son categorías
 * independientes, son más y menos de lo mismo). Los pasos intermedios se interpolan
 * en oklab, así que la rampa funciona igual con 2, 4 o 5 puntos.
 */
function tonoOrdinal(indice: number, n: number): string {
  const t = n <= 1 ? 100 : (indice / (n - 1)) * 100;
  return `color-mix(in oklab, var(--eval-ord-hi) ${t}%, var(--eval-ord-lo))`;
}

/**
 * Distribución de una fila como una sola barra apilada. Antes eran cuatro barritas
 * sueltas, que se leían como cuatro medidas independientes en vez de como el reparto
 * de un total. Los 2px de hueco entre segmentos son del fondo, no un borde: así se
 * distinguen los tramos sin meter una línea de color que compita con los datos.
 */
function Distribucion({
  distribucion,
  n,
}: {
  distribucion: { valor: number; label: string; n: number }[];
  n: number;
}) {
  if (n === 0) return <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800" />;
  return (
    <div className="flex h-1.5 gap-[2px]" role="img" aria-label={distribucion.map((d) => `${d.label}: ${d.n}`).join(', ')}>
      {distribucion.map((d, i) => {
        if (d.n === 0) return null;
        return (
          <div
            key={d.valor}
            title={`${d.label}: ${d.n} de ${n}`}
            style={{ width: `${(d.n / n) * 100}%`, background: tonoOrdinal(i, distribucion.length) }}
            className="h-1.5 rounded-full first:rounded-l-full last:rounded-r-full"
          />
        );
      })}
    </div>
  );
}

/** Leyenda de la escala. Con 2+ tramos siempre va: el color solo nunca basta. */
function LeyendaEscala({ escala }: { escala: string }) {
  const puntos = escalaDe(escala).puntos;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {puntos.map((p, i) => (
        <span key={p.valor} className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: tonoOrdinal(i, puntos.length) }}
          />
          {p.label}
        </span>
      ))}
    </div>
  );
}

export function ResultadosPanel({
  resultados,
  formId,
  claseActiva,
}: {
  resultados: Resultados;
  formId: string;
  claseActiva: string | null;
}) {
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});
  const { form } = resultados;
  const cobertura =
    resultados.objetivo && resultados.objetivo > 0 ? Math.round((resultados.totalRespuestas / resultados.objetivo) * 100) : null;

  return (
    <div className="anim-stagger space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] ring-1 ring-zinc-200/70 p-4 dark:bg-zinc-900 dark:ring-zinc-800">
          <p className="text-xs text-zinc-500">Respuestas</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{resultados.totalRespuestas}</p>
          {cobertura !== null && <p className="text-xs text-zinc-400">de {resultados.objetivo} ({cobertura} %)</p>}
        </div>
        <div className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] ring-1 ring-zinc-200/70 p-4 dark:bg-zinc-900 dark:ring-zinc-800">
          <p className="text-xs text-zinc-500">Valoración media</p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${TONO_TEXTO[tonoDe(resultados.mediaPct)]}`}>
            {resultados.mediaPct === null ? '—' : Math.round(resultados.mediaPct)}
            <span className="text-sm font-normal text-zinc-400"> / 100</span>
          </p>
          <p className="text-xs text-zinc-400">comparable entre escalas</p>
        </div>
        <div className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] ring-1 ring-zinc-200/70 p-4 dark:bg-zinc-900 dark:ring-zinc-800">
          <p className="text-xs text-zinc-500">Actividades</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{resultados.bloques.length}</p>
        </div>
        <div className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] ring-1 ring-zinc-200/70 p-4 dark:bg-zinc-900 dark:ring-zinc-800">
          <p className="text-xs text-zinc-500">{form.audiencia === 'alumnos' ? 'Clases' : 'Etapas'}</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {form.audiencia === 'alumnos' ? resultados.clases.filter((c) => c.respuestas > 0).length : resultados.etapas.length}
          </p>
        </div>
      </div>

      {resultados.avisos.length > 0 && !claseActiva && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-amber-900 dark:text-amber-300">
            <Lightbulb className="h-4 w-4" /> Lo que salta a la vista
          </p>
          <ul className="space-y-1 text-sm text-amber-800 dark:text-amber-200">
            {resultados.avisos.map((a) => (
              <li key={a}>· {a}</li>
            ))}
          </ul>
        </div>
      )}

      {resultados.clases.length > 0 && (
        <div className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] ring-1 ring-zinc-200/70 p-4 dark:bg-zinc-900 dark:ring-zinc-800">
          <p className="mb-2.5 flex items-center gap-1.5 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Por clase
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Link
              href={`/gestion/evaluaciones/${formId}/resultados`}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                !claseActiva ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
              }`}
            >
              Todas
            </Link>
            {resultados.clases.map((c) => {
              const clave = `${c.curso}|${c.letra ?? ''}`;
              const activa = claseActiva === clave;
              return (
                <Link
                  key={clave}
                  href={`/gestion/evaluaciones/${formId}/resultados?clase=${encodeURIComponent(clave)}`}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${
                    activa ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}
                >
                  {claseLabel(c)}
                  <span className={`text-[11px] ${activa ? 'text-blue-100' : 'text-zinc-400'}`}>
                    {c.respuestas}
                    {c.objetivo > 0 && `/${c.objetivo}`}
                  </span>
                  {c.mediaPct !== null && (
                    <span className={`h-1.5 w-1.5 rounded-full ${TONO_BARRA[tonoDe(c.mediaPct)]}`} title={`${Math.round(c.mediaPct)}/100`} />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {resultados.etapas.length > 0 && (
        <div className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] ring-1 ring-zinc-200/70 p-4 dark:bg-zinc-900 dark:ring-zinc-800">
          <p className="mb-2.5 text-sm font-medium text-zinc-800 dark:text-zinc-200">Por etapa</p>
          <div className="space-y-2">
            {resultados.etapas.map((e) => (
              <div key={e.etapa} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm text-zinc-600 dark:text-zinc-300">
                  {e.etapa === 'EI' ? 'Infantil' : e.etapa === 'EP' ? 'Primaria' : 'Secundaria'}
                </span>
                <Barra pct={e.mediaPct} />
                <span className="w-16 shrink-0 text-right text-xs tabular-nums text-zinc-500">
                  {e.mediaPct === null ? '—' : Math.round(e.mediaPct)} · {e.respuestas}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {resultados.totalRespuestas === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
          Todavía no hay respuestas{claseActiva ? ' de esta clase' : ''}.
        </div>
      ) : (
        resultados.bloques.map((b, bi) => (
          <div key={b.id} className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] ring-1 ring-zinc-200/70 p-4 dark:bg-zinc-900 dark:ring-zinc-800">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <LetraBadge letra={String.fromCharCode(65 + bi)} color={b.color} />
                <h2 className="truncate font-bold text-zinc-900 dark:text-zinc-100">{b.titulo}</h2>
              </div>
              <span className={`shrink-0 text-sm font-bold tabular-nums ${TONO_TEXTO[tonoDe(b.mediaPct)]}`}>
                {b.mediaPct === null ? '—' : Math.round(b.mediaPct)}
                <span className="text-[10px] font-normal text-zinc-400"> / 100</span>
              </span>
            </div>

            <div className="space-y-4">
              {b.preguntas.map((q) => (
                <div key={q.id}>
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{q.texto}</p>

                  {q.tipo === 'escala' && (
                    <div className="mt-2 space-y-3">
                      <LeyendaEscala escala={q.escala} />
                      {q.filas.map((f) => (
                        <div key={f.clave || q.id}>
                          <div className="flex items-center gap-3">
                            <span className="min-w-0 flex-1 truncate text-sm text-zinc-600 dark:text-zinc-300">{f.texto}</span>
                            <Nota pct={f.mediaPct} escala={q.escala} />
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <Barra pct={f.mediaPct} />
                            <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-zinc-400">{f.n}</span>
                          </div>
                          <div className="mt-1">
                            <Distribucion distribucion={f.distribucion} n={f.n} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {(q.tipo === 'opcion' || q.tipo === 'varias' || q.tipo === 'quiz') && (
                    <div className="mt-2 space-y-1.5">
                      {q.opciones.map((o) => (
                        <div key={o.clave} className="flex items-center gap-3">
                          <span className="min-w-0 flex-1 truncate text-sm text-zinc-600 dark:text-zinc-300">
                            {o.correcta && <span className="mr-1 text-emerald-600">✓</span>}
                            {o.texto}
                          </span>
                          <div className="h-2 w-28 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800 sm:w-40">
                            <div
                              className={`h-2 rounded-full ${o.correcta ? 'bg-emerald-500' : 'bg-blue-500'}`}
                              style={{ width: `${q.n > 0 ? (o.n / q.n) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="w-8 shrink-0 text-right text-xs tabular-nums text-zinc-500">{o.n}</span>
                        </div>
                      ))}
                      {q.otras.length > 0 && (
                        <p className="text-xs text-zinc-500">Otras: {q.otras.join(' · ')}</p>
                      )}
                    </div>
                  )}

                  {q.tipo === 'texto' && (
                    <div className="mt-2">
                      {q.textos.length === 0 ? (
                        <p className="text-xs text-zinc-400">Sin respuestas.</p>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setAbiertos((prev) => ({ ...prev, [q.id]: !prev[q.id] }))}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                          >
                            <MessageSquareQuote className="h-3.5 w-3.5" />
                            {q.textos.length} respuesta(s)
                            {abiertos[q.id] ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </button>
                          {abiertos[q.id] && (
                            <ul className="mt-2 space-y-1.5">
                              {q.textos.map((t, i) => (
                                <li
                                  key={i}
                                  className="rounded-xl bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-200"
                                >
                                  {t.clase && (
                                    <span className="mr-2 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-900">
                                      {t.clase}
                                    </span>
                                  )}
                                  {t.valor}
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
