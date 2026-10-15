'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  ChevronUp,
  Frown,
  Lightbulb,
  MessageSquareQuote,
  Search,
  ThumbsDown,
  ThumbsUp,
  Users,
} from 'lucide-react';
import { LetraBadge } from '@/components/evaluaciones/color-picker';
import { PANEL, Rotulo, Segmentado } from '@/components/evaluaciones/ui';
import { claseLabel, comentarioUtil, escalaDe, tonoDe } from '@/lib/evaluaciones';
import type { RespuestaCritica, Resultados } from '@/lib/evaluaciones-server';
import { ETAPA_LABEL, esEtapa, etapaDeCurso } from '@/lib/cursos';

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

/** Borde izquierdo de un comentario: de un vistazo, si lo escribió alguien contento o no. */
const TONO_BORDE: Record<string, string> = {
  bien: 'border-l-emerald-400 dark:border-l-emerald-500/70',
  regular: 'border-l-amber-400 dark:border-l-amber-500/70',
  flojo: 'border-l-rose-500 dark:border-l-rose-500/80',
  sin: 'border-l-zinc-200 dark:border-l-zinc-700',
};

const TONO_FICHA: Record<string, string> = {
  bien: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  regular: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300',
  flojo: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
  sin: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
};

const CHIP = 'rounded-full px-3 py-1.5 text-sm font-medium transition-colors';
const CHIP_ON = 'bg-blue-600 text-white';
const CHIP_OFF = 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700';

function etapaLabel(e: string): string {
  return esEtapa(e) ? ETAPA_LABEL[e] : e;
}

function normalizar(t: string): string {
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

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

/** Nota 0-100 en grande y con su color: lo primero que se lee de una fila. */
function Cien({ pct, className = '' }: { pct: number | null; className?: string }) {
  return (
    <span className={`font-bold tabular-nums ${TONO_TEXTO[tonoDe(pct)]} ${className}`}>
      {pct === null ? '—' : Math.round(pct)}
    </span>
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
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: tonoOrdinal(i, puntos.length) }} />
          {p.label}
        </span>
      ))}
    </div>
  );
}

/** Etiqueta de dónde viene una respuesta (clase o etapa). Nunca quién. */
function Procedencia({ clase, etapa }: { clase: string | null; etapa: string | null }) {
  const texto = clase ?? (etapa ? etapaLabel(etapa) : null);
  if (!texto) return null;
  return (
    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
      {texto}
    </span>
  );
}

type Pestana = 'resumen' | 'comentarios' | 'criticos';

interface Comentario {
  valor: string;
  clase: string | null;
  etapa: string | null;
  pct: number | null;
  util: boolean;
}

interface GrupoComentarios {
  id: string;
  texto: string;
  bloque: string;
  letra: string;
  color: string | null;
  comentarios: Comentario[];
}

/** Críticos primero (media más baja), y a igualdad, el comentario más largo. */
function ordenCriticos(a: Comentario, b: Comentario): number {
  return (a.pct ?? 101) - (b.pct ?? 101) || b.valor.length - a.valor.length;
}

export function ResultadosPanel({
  resultados,
  formId,
  claseActiva,
  etapaActiva,
}: {
  resultados: Resultados;
  formId: string;
  claseActiva: string | null;
  etapaActiva: string | null;
}) {
  const [pestana, setPestana] = useState<Pestana>('resumen');
  const [preguntaFoco, setPreguntaFoco] = useState<string | null>(null);
  const pestanasRef = useRef<HTMLDivElement>(null);
  const { form } = resultados;
  const cobertura =
    resultados.objetivo && resultados.objetivo > 0 ? Math.round((resultados.totalRespuestas / resultados.objetivo) * 100) : null;

  const base = `/gestion/evaluaciones/${formId}/resultados`;
  const hrefEtapa = (e: string | null) => (e ? `${base}?etapa=${encodeURIComponent(e)}` : base);
  const hrefClase = (clave: string) => {
    const curso = clave.split('|')[0];
    const etapa = etapaDeCurso(curso);
    return `${base}?clase=${encodeURIComponent(clave)}${etapa ? `&etapa=${etapa}` : ''}`;
  };

  // Comentarios de todas las preguntas abiertas, con lo que hace falta para leerlos bien.
  const grupos: GrupoComentarios[] = useMemo(
    () =>
      resultados.bloques.flatMap((b, bi) =>
        b.preguntas
          .filter((q) => q.tipo === 'texto')
          .map((q) => ({
            id: q.id,
            texto: q.texto,
            bloque: b.titulo,
            letra: String.fromCharCode(65 + bi),
            color: b.color,
            comentarios: q.textos.map((t) => ({ ...t, util: comentarioUtil(t.valor) })),
          })),
      ),
    [resultados.bloques],
  );
  const totalUtiles = grupos.reduce((s, g) => s + g.comentarios.filter((c) => c.util).length, 0);
  const mostrarFiltroEtapa = resultados.etapas.length > 1;
  const clasesVisibles = etapaActiva
    ? resultados.clases.filter((c) => etapaDeCurso(c.curso) === etapaActiva)
    : resultados.clases;
  const criticosBajo70 = resultados.criticas.filter((c) => c.mediaPct < 70).length;

  function irAComentarios(preguntaId: string | null) {
    setPreguntaFoco(preguntaId);
    setPestana('comentarios');
    pestanasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="anim-stagger space-y-4">
      {/* ─── Qué se mira: etapa y clase ─── */}
      {(mostrarFiltroEtapa || resultados.clases.length > 0) && (
        <div className={`${PANEL} space-y-3 p-4`}>
          {mostrarFiltroEtapa && (
            <div>
              <Rotulo className="mb-2">Etapa</Rotulo>
              <div className="flex flex-wrap gap-1.5">
                <Link href={hrefEtapa(null)} className={`${CHIP} ${!etapaActiva && !claseActiva ? CHIP_ON : CHIP_OFF}`}>
                  Todas
                </Link>
                {resultados.etapas.map((e) => {
                  const activa = etapaActiva === e.etapa;
                  return (
                    <Link
                      key={e.etapa}
                      href={hrefEtapa(e.etapa)}
                      className={`inline-flex items-center gap-1.5 ${CHIP} ${activa ? CHIP_ON : CHIP_OFF}`}
                    >
                      {etapaLabel(e.etapa)}
                      <span className={`text-[11px] ${activa ? 'text-blue-100' : 'text-zinc-400'}`}>{e.respuestas}</span>
                      {e.mediaPct !== null && (
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${TONO_BARRA[tonoDe(e.mediaPct)]}`}
                          title={`${Math.round(e.mediaPct)}/100`}
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {clasesVisibles.length > 0 && (
            <div>
              <Rotulo className="mb-2 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Clase
              </Rotulo>
              <div className="flex flex-wrap gap-1.5">
                {!mostrarFiltroEtapa && (
                  <Link href={base} className={`${CHIP} ${!claseActiva ? CHIP_ON : CHIP_OFF}`}>
                    Todas
                  </Link>
                )}
                {clasesVisibles.map((c) => {
                  const clave = `${c.curso}|${c.letra ?? ''}`;
                  const activa = claseActiva === clave;
                  return (
                    <Link
                      key={clave}
                      href={activa ? hrefEtapa(etapaActiva) : hrefClase(clave)}
                      className={`inline-flex items-center gap-1.5 ${CHIP} ${activa ? CHIP_ON : CHIP_OFF}`}
                    >
                      {claseLabel(c)}
                      <span className={`text-[11px] ${activa ? 'text-blue-100' : 'text-zinc-400'}`}>
                        {c.respuestas}
                        {c.objetivo > 0 && `/${c.objetivo}`}
                      </span>
                      {c.mediaPct !== null && (
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${TONO_BARRA[tonoDe(c.mediaPct)]}`}
                          title={`${Math.round(c.mediaPct)}/100`}
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Cifras de cabecera ─── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className={`${PANEL} p-4`}>
          <p className="text-xs text-zinc-500">Respuestas</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{resultados.totalRespuestas}</p>
          {cobertura !== null && (
            <p className="text-xs text-zinc-400">
              de {resultados.objetivo} ({cobertura} %)
            </p>
          )}
        </div>
        <div className={`${PANEL} p-4`}>
          <p className="text-xs text-zinc-500">Valoración media</p>
          <p className="mt-1 text-2xl">
            <Cien pct={resultados.mediaPct} />
            <span className="text-sm font-normal text-zinc-400"> / 100</span>
          </p>
          <p className="text-xs text-zinc-400">comparable entre escalas</p>
        </div>
        <Animo animo={resultados.animo} onCriticos={() => setPestana('criticos')} />
      </div>

      {resultados.totalRespuestas === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
          Todavía no hay respuestas{claseActiva ? ' de esta clase' : etapaActiva ? ' de esta etapa' : ''}.
        </div>
      ) : (
        <>
          {/* ─── Pestañas ─── */}
          <div ref={pestanasRef} className="scroll-mt-4 flex gap-1 overflow-x-auto rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800/60">
            {(
              [
                { valor: 'resumen', label: 'Resumen', corto: 'Resumen', n: null },
                { valor: 'comentarios', label: 'Comentarios', corto: 'Comentarios', n: totalUtiles },
                { valor: 'criticos', label: 'Los más críticos', corto: 'Críticos', n: criticosBajo70 },
              ] as const
            ).map((p) => {
              const activa = pestana === p.valor;
              return (
                <button
                  key={p.valor}
                  type="button"
                  onClick={() => {
                    setPestana(p.valor);
                    if (p.valor === 'comentarios') setPreguntaFoco(null);
                  }}
                  className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-2 sm:px-3 text-sm font-semibold transition-colors ${
                    activa
                      ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50'
                      : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                  }`}
                >
                  <span className="sm:hidden">{p.corto}</span>
                  <span className="hidden sm:inline">{p.label}</span>
                  {p.n !== null && (
                    <span
                      className={`rounded-full px-1.5 text-[11px] tabular-nums ${
                        activa ? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-600 dark:text-zinc-200' : 'bg-zinc-200/70 dark:bg-zinc-700'
                      }`}
                    >
                      {p.n}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {pestana === 'resumen' && (
            <VistaResumen
              resultados={resultados}
              grupos={grupos}
              mostrarAvisos={!claseActiva}
              mostrarEtapas={!etapaActiva && !claseActiva && mostrarFiltroEtapa}
              hrefEtapa={hrefEtapa}
              onVerComentarios={irAComentarios}
            />
          )}
          {pestana === 'comentarios' && (
            <VistaComentarios grupos={grupos} foco={preguntaFoco} onFoco={setPreguntaFoco} />
          )}
          {pestana === 'criticos' && <VistaCriticos criticas={resultados.criticas} audiencia={form.audiencia} />}
        </>
      )}
    </div>
  );
}

// ─── Ánimo: cuánta gente sale contenta, regular o descontenta ────────────────

function Animo({ animo, onCriticos }: { animo: Resultados['animo']; onCriticos: () => void }) {
  const total = animo.bien + animo.regular + animo.flojo;
  const tramos = [
    { clave: 'bien', n: animo.bien, label: 'contentos', pista: '70 o más' },
    { clave: 'regular', n: animo.regular, label: 'regular', pista: 'entre 45 y 70' },
    { clave: 'flojo', n: animo.flojo, label: 'descontentos', pista: 'menos de 45' },
  ] as const;
  return (
    <div className={`${PANEL} col-span-2 p-4`}>
      <p className="text-xs text-zinc-500">Cómo sale la gente</p>
      {total === 0 ? (
        <p className="mt-2 text-sm text-zinc-400">Sin valoraciones todavía.</p>
      ) : (
        <>
          <div className="mt-2.5 flex h-3 gap-[2px] overflow-hidden rounded-full">
            {tramos.map((t) =>
              t.n === 0 ? null : (
                <div
                  key={t.clave}
                  className={`h-3 first:rounded-l-full last:rounded-r-full ${TONO_BARRA[t.clave]}`}
                  style={{ width: `${(t.n / total) * 100}%` }}
                  title={`${t.n} ${t.label} (${t.pista})`}
                />
              ),
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {tramos.map((t) => {
              const contenido = (
                <>
                  <span className={`h-2 w-2 rounded-full ${TONO_BARRA[t.clave]}`} />
                  <span className="font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
                    {Math.round((t.n / total) * 100)} %
                  </span>
                  <span className="text-zinc-500">
                    {t.label} ({t.n})
                  </span>
                </>
              );
              return t.clave === 'flojo' && t.n > 0 ? (
                <button
                  key={t.clave}
                  type="button"
                  onClick={onCriticos}
                  title="Ver sus respuestas"
                  className="inline-flex items-center gap-1.5 rounded underline decoration-rose-300 decoration-dotted underline-offset-2 hover:decoration-rose-500"
                >
                  {contenido}
                </button>
              ) : (
                <span key={t.clave} className="inline-flex items-center gap-1.5" title={t.pista}>
                  {contenido}
                </span>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Resumen ──────────────────────────────────────────────────────────────────

function VistaResumen({
  resultados,
  grupos,
  mostrarAvisos,
  mostrarEtapas,
  hrefEtapa,
  onVerComentarios,
}: {
  resultados: Resultados;
  grupos: GrupoComentarios[];
  mostrarAvisos: boolean;
  mostrarEtapas: boolean;
  hrefEtapa: (e: string | null) => string;
  onVerComentarios: (preguntaId: string | null) => void;
}) {
  // Todas las filas valoradas del formulario, para el "lo mejor / lo que menos".
  const filas = resultados.bloques.flatMap((b, bi) =>
    b.preguntas.flatMap((q) =>
      q.filas
        .filter((f) => f.mediaPct !== null)
        .map((f) => ({
          clave: `${q.id}:${f.clave}`,
          texto: f.texto,
          pregunta: q.texto,
          letra: String.fromCharCode(65 + bi),
          color: b.color,
          pct: f.mediaPct!,
          n: f.n,
        })),
    ),
  );
  const ordenadas = [...filas].sort((a, b) => b.pct - a.pct);
  const cuantas = Math.min(3, Math.floor(ordenadas.length / 2));
  const mejores = ordenadas.slice(0, cuantas);
  const peores = ordenadas.slice(-cuantas).reverse();
  const variosBloques = resultados.bloques.length > 1;

  return (
    <div className="space-y-4">
      {mostrarAvisos && resultados.avisos.length > 0 && (
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

      {cuantas > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {(
            [
              { titulo: 'Lo mejor valorado', icono: <ThumbsUp className="h-4 w-4 text-emerald-600" />, lista: mejores },
              { titulo: 'Lo que menos', icono: <ThumbsDown className="h-4 w-4 text-rose-600" />, lista: peores },
            ] as const
          ).map((col) => (
            <div key={col.titulo} className={`${PANEL} p-4`}>
              <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                {col.icono} {col.titulo}
              </p>
              <ul className="space-y-2.5">
                {col.lista.map((f) => (
                  <li key={f.clave}>
                    <div className="flex items-start gap-2">
                      {variosBloques && <LetraBadge letra={f.letra} color={f.color} className="!h-5 !w-5 !rounded-md !text-[10px]" />}
                      <span
                        className="min-w-0 flex-1 text-sm leading-snug text-zinc-700 dark:text-zinc-300"
                        title={f.pregunta !== f.texto ? f.pregunta : undefined}
                      >
                        {f.texto}
                      </span>
                      <Cien pct={f.pct} className="text-sm" />
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <Barra pct={f.pct} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {mostrarEtapas && (
        <div className={`${PANEL} p-4`}>
          <p className="mb-2.5 text-sm font-semibold text-zinc-800 dark:text-zinc-200">Por etapa</p>
          <div className="space-y-1">
            {resultados.etapas.map((e) => (
              <Link
                key={e.etapa}
                href={hrefEtapa(e.etapa)}
                className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
              >
                <span className="w-24 shrink-0 text-sm text-zinc-600 dark:text-zinc-300">{etapaLabel(e.etapa)}</span>
                <Barra pct={e.mediaPct} />
                <Cien pct={e.mediaPct} className="w-8 shrink-0 text-right text-sm" />
                <span className="w-20 shrink-0 text-right text-xs tabular-nums text-zinc-400">
                  {e.respuestas} resp.
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {resultados.bloques.map((b, bi) => (
        <div key={b.id} className={`${PANEL} p-4`}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <LetraBadge letra={String.fromCharCode(65 + bi)} color={b.color} />
              <h2 className="truncate font-bold text-zinc-900 dark:text-zinc-100">{b.titulo}</h2>
            </div>
            <span className="shrink-0 text-sm">
              <Cien pct={b.mediaPct} />
              <span className="text-[10px] font-normal text-zinc-400"> / 100</span>
            </span>
          </div>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {b.preguntas.map((q) => (
              <div key={q.id} className="py-3 first:pt-0 last:pb-0">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{q.texto}</p>

                {q.tipo === 'escala' && (
                  <div className="mt-2 space-y-3">
                    <LeyendaEscala escala={q.escala} />
                    {q.filas.map((f) => (
                      <div key={f.clave || q.id}>
                        {q.filas.length > 1 || f.texto !== q.texto ? (
                          <div className="flex items-start gap-3">
                            <span className="min-w-0 flex-1 text-sm leading-snug text-zinc-600 dark:text-zinc-300">{f.texto}</span>
                            <Nota pct={f.mediaPct} escala={q.escala} />
                          </div>
                        ) : (
                          <div className="flex justify-end">
                            <Nota pct={f.mediaPct} escala={q.escala} />
                          </div>
                        )}
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
                        <span className="min-w-0 flex-1 text-sm leading-snug text-zinc-600 dark:text-zinc-300">
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
                    {q.otras.filter(comentarioUtil).length > 0 && (
                      <p className="text-xs text-zinc-500">Otras: {q.otras.filter(comentarioUtil).join(' · ')}</p>
                    )}
                  </div>
                )}

                {q.tipo === 'texto' && (
                  <AdelantoComentarios grupo={grupos.find((g) => g.id === q.id)} onVerTodos={() => onVerComentarios(q.id)} />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** En el resumen, los tres comentarios más críticos de una pregunta y el enlace al resto. */
function AdelantoComentarios({ grupo, onVerTodos }: { grupo: GrupoComentarios | undefined; onVerTodos: () => void }) {
  const utiles = (grupo?.comentarios ?? []).filter((c) => c.util).sort(ordenCriticos);
  const vacios = (grupo?.comentarios.length ?? 0) - utiles.length;
  if (utiles.length === 0) {
    return (
      <p className="mt-1.5 text-xs text-zinc-400">
        {vacios > 0 ? `${vacios} respuesta(s) sin contenido («no», «nada»…).` : 'Sin respuestas.'}
      </p>
    );
  }
  return (
    <div className="mt-2 space-y-1.5">
      {utiles.slice(0, 3).map((c, i) => (
        <TarjetaComentario key={i} c={c} />
      ))}
      <button
        type="button"
        onClick={onVerTodos}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
      >
        <MessageSquareQuote className="h-3.5 w-3.5" />
        {utiles.length > 3 ? `Leer los ${utiles.length} comentarios` : 'Ir a comentarios'}
      </button>
    </div>
  );
}

function TarjetaComentario({ c, busqueda }: { c: Comentario; busqueda?: string }) {
  const tono = tonoDe(c.pct);
  return (
    <div
      className={`rounded-r-xl border-l-[3px] bg-zinc-50 px-3.5 py-2.5 dark:bg-zinc-800/40 ${TONO_BORDE[tono]} ${
        c.util ? '' : 'opacity-60'
      }`}
    >
      <p className="whitespace-pre-line text-[15px] leading-relaxed text-zinc-800 dark:text-zinc-100">
        <Resaltado texto={c.valor} busqueda={busqueda} />
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
        <Procedencia clase={c.clase} etapa={c.etapa} />
        {c.pct !== null && (
          <span title="Valoración media de quien lo escribió">
            su media <span className={`font-semibold ${TONO_TEXTO[tono]}`}>{Math.round(c.pct)}</span>/100
          </span>
        )}
      </div>
    </div>
  );
}

function Resaltado({ texto, busqueda }: { texto: string; busqueda?: string }) {
  const q = busqueda?.trim();
  if (!q) return <>{texto}</>;
  // Se busca sin tildes, pero se pinta el texto original (misma longitud tras quitar
  // las marcas combinadas solo si el texto viene en NFC, que es lo normal).
  const norm = normalizar(texto);
  if (norm.length !== texto.length) return <>{texto}</>;
  const nq = normalizar(q);
  const partes: React.ReactNode[] = [];
  let desde = 0;
  let i = norm.indexOf(nq);
  while (i !== -1 && nq.length > 0) {
    partes.push(texto.slice(desde, i));
    partes.push(
      <mark key={i} className="rounded bg-yellow-200/80 px-0.5 text-inherit dark:bg-yellow-500/30">
        {texto.slice(i, i + nq.length)}
      </mark>,
    );
    desde = i + nq.length;
    i = norm.indexOf(nq, desde);
  }
  partes.push(texto.slice(desde));
  return <>{partes}</>;
}

// ─── Comentarios ──────────────────────────────────────────────────────────────

function VistaComentarios({
  grupos,
  foco,
  onFoco,
}: {
  grupos: GrupoComentarios[];
  foco: string | null;
  onFoco: (id: string | null) => void;
}) {
  const [orden, setOrden] = useState<'criticos' | 'largos'>('criticos');
  const [busqueda, setBusqueda] = useState('');
  const [verVacios, setVerVacios] = useState(false);

  if (grupos.length === 0) {
    return (
      <div className={`${PANEL} p-8 text-center text-sm text-zinc-500`}>Esta evaluación no tiene preguntas abiertas.</div>
    );
  }

  const nq = normalizar(busqueda.trim());
  const visibles = foco ? grupos.filter((g) => g.id === foco) : grupos;
  const totalVacios = visibles.reduce((s, g) => s + g.comentarios.filter((c) => !c.util).length, 0);

  return (
    <div className="space-y-4">
      <div className={`${PANEL} space-y-3 p-3`}>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar en los comentarios…"
              className="w-full rounded-lg bg-zinc-50 py-2 pl-8 pr-3 text-sm text-zinc-900 ring-1 ring-transparent placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800/40 dark:text-zinc-100 dark:focus:bg-zinc-800"
            />
          </label>
          <Segmentado
            opciones={[
              { valor: 'criticos', label: 'Críticos primero' },
              { valor: 'largos', label: 'Más largos' },
            ]}
            valor={orden}
            onChange={setOrden}
            capitalizar={false}
          />
        </div>
        {grupos.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => onFoco(null)} className={`${CHIP} !py-1 !text-xs ${!foco ? CHIP_ON : CHIP_OFF}`}>
              Todas las preguntas
            </button>
            {grupos.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => onFoco(g.id)}
                title={`${g.bloque} · ${g.texto}`}
                className={`${CHIP} max-w-[16rem] truncate !py-1 !text-xs ${foco === g.id ? CHIP_ON : CHIP_OFF}`}
              >
                {g.texto}
              </button>
            ))}
          </div>
        )}
      </div>

      {visibles.map((g) => {
        const lista = g.comentarios
          .filter((c) => c.util || verVacios)
          .filter((c) => !nq || normalizar(c.valor).includes(nq))
          .sort(orden === 'criticos' ? ordenCriticos : (a, b) => b.valor.length - a.valor.length);
        const utiles = g.comentarios.filter((c) => c.util).length;
        return (
          <div key={g.id} className={`${PANEL} p-4`}>
            <div className="mb-3 flex items-start gap-2">
              <LetraBadge letra={g.letra} color={g.color} className="!h-6 !w-6 !text-[11px]" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-snug text-zinc-900 dark:text-zinc-100">{g.texto}</p>
                <p className="text-xs text-zinc-400">
                  {g.bloque} · {utiles} comentario{utiles === 1 ? '' : 's'}
                </p>
              </div>
            </div>
            {lista.length === 0 ? (
              <p className="text-sm text-zinc-400">
                {nq ? 'Ningún comentario con ese texto.' : 'Nadie ha escrito nada que leer aquí.'}
              </p>
            ) : (
              <div className="space-y-2">
                {lista.map((c, i) => (
                  <TarjetaComentario key={i} c={c} busqueda={busqueda} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {totalVacios > 0 && (
        <button
          type="button"
          onClick={() => setVerVacios((v) => !v)}
          className="mx-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          {verVacios ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {verVacios
            ? 'Ocultar las respuestas sin contenido'
            : `${totalVacios} respuesta${totalVacios === 1 ? '' : 's'} sin contenido oculta${totalVacios === 1 ? '' : 's'} («no», «nada»…) · mostrar`}
        </button>
      )}
    </div>
  );
}

// ─── Los más críticos ─────────────────────────────────────────────────────────

const POR_PAGINA = 10;

function VistaCriticos({ criticas, audiencia }: { criticas: RespuestaCritica[]; audiencia: string }) {
  const [umbral, setUmbral] = useState<'45' | '70' | 'todas'>('70');
  const [cuantas, setCuantas] = useState(POR_PAGINA);

  if (criticas.length === 0) {
    return (
      <div className={`${PANEL} p-8 text-center text-sm text-zinc-500`}>
        Esta evaluación no tiene preguntas de valoración: no hay nada que ordenar.
      </div>
    );
  }

  const bajo45 = criticas.filter((c) => c.mediaPct < 45).length;
  const bajo70 = criticas.filter((c) => c.mediaPct < 70).length;
  const lista = criticas.filter((c) => (umbral === '45' ? c.mediaPct < 45 : umbral === '70' ? c.mediaPct < 70 : true));
  const quien = audiencia === 'alumnos' ? 'Solo se ve su clase' : 'Solo se ve su etapa, si la marcó';

  return (
    <div className="space-y-3">
      <div className={`${PANEL} flex flex-wrap items-center justify-between gap-3 p-3`}>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          <Frown className="mr-1 inline h-4 w-4 -translate-y-px text-rose-500" />
          Quien peor ha valorado, de la nota más baja a la más alta. Anónimo: {quien.toLowerCase()}.
        </p>
        <Segmentado
          opciones={[
            { valor: '45', label: `Descontentos · ${bajo45}` },
            { valor: '70', label: `Bajo 70 · ${bajo70}` },
            { valor: 'todas', label: `Las ${criticas.length} más bajas` },
          ]}
          valor={umbral}
          capitalizar={false}
          onChange={(v) => {
            setUmbral(v);
            setCuantas(POR_PAGINA);
          }}
        />
      </div>

      {lista.length === 0 ? (
        <div className={`${PANEL} p-8 text-center`}>
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            🎉 Nadie ha valorado por debajo de {umbral === '45' ? 45 : 70}.
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            La valoración más baja es {Math.round(criticas[0].mediaPct)}/100.{' '}
            <button type="button" onClick={() => setUmbral('todas')} className="font-semibold text-blue-600 hover:underline">
              Ver igualmente las más bajas
            </button>
          </p>
        </div>
      ) : (
        <>
          {lista.slice(0, cuantas).map((c) => (
            <TarjetaCritica key={c.id} c={c} />
          ))}
          {lista.length > cuantas && (
            <button
              type="button"
              onClick={() => setCuantas((n) => n + POR_PAGINA)}
              className="mx-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
            >
              <ChevronDown className="h-4 w-4" /> Ver {Math.min(POR_PAGINA, lista.length - cuantas)} más (quedan{' '}
              {lista.length - cuantas})
            </button>
          )}
        </>
      )}
    </div>
  );
}

function TarjetaCritica({ c }: { c: RespuestaCritica }) {
  const [todas, setTodas] = useState(false);
  const tono = tonoDe(c.mediaPct);
  const bajas = c.valoraciones.filter((v) => v.pct < 70);
  const resto = c.valoraciones.length - bajas.length;
  const mostradas = todas ? c.valoraciones : bajas;
  const comentarios = c.comentarios.filter((x) => comentarioUtil(x.valor));

  return (
    <div className={`${PANEL} border-l-4 p-4 ${TONO_BORDE[tono]}`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl ${TONO_FICHA[tono]}`}>
          <span className="text-base font-bold leading-none tabular-nums">{Math.round(c.mediaPct)}</span>
          <span className="text-[9px] leading-none opacity-70">/100</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <Procedencia clase={c.clase} etapa={c.etapa} />
          {c.enLoMasBajo > 0 && (
            <span className="text-xs text-rose-600 dark:text-rose-400">
              {c.enLoMasBajo} {c.enLoMasBajo === 1 ? 'vez' : 'veces'} lo más bajo de la escala
            </span>
          )}
        </div>
      </div>

      {comentarios.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {comentarios.map((x, i) => (
            <div key={i} className="rounded-xl bg-zinc-50 px-3.5 py-2.5 dark:bg-zinc-800/40">
              <p className="text-[11px] text-zinc-400">{x.pregunta}</p>
              <p className="whitespace-pre-line text-[15px] leading-relaxed text-zinc-800 dark:text-zinc-100">“{x.valor}”</p>
            </div>
          ))}
        </div>
      )}

      {mostradas.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {mostradas.map((v, i) => (
            <li
              key={i}
              title={v.fila ? `${v.bloque} · ${v.pregunta}` : v.bloque}
              className={`rounded-lg px-2 py-1 text-xs ${TONO_FICHA[tonoDe(v.pct)]}`}
            >
              {v.fila ?? v.pregunta}: <span className="font-semibold">{v.label}</span>
            </li>
          ))}
        </ul>
      )}
      {resto > 0 && (
        <button
          type="button"
          onClick={() => setTodas((t) => !t)}
          className="mt-2 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          {todas ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {todas ? 'Solo lo que valoró bajo' : `Ver también lo que valoró bien (${resto})`}
        </button>
      )}
    </div>
  );
}
