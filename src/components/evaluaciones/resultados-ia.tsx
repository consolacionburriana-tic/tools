'use client';

// "Lo que ve la IA": análisis de los resultados con Claude. El botón manda al servidor el
// filtro de la pantalla (etapa o clase), y el análisis se guarda: abrir la pantalla otra vez
// no cuesta nada. Se vuelve a analizar a mano, cuando han llegado respuestas nuevas.
import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, Loader2, RefreshCw, Settings2, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react';
import { PANEL } from '@/components/evaluaciones/ui';
import { costeIA, modeloIA } from '@/lib/ajustes';
import type { Insights } from '@/lib/evaluaciones-ia';

export interface InsightCliente {
  id: string;
  modelo: string;
  contenido: Insights;
  respuestas: number;
  tokensEntrada: number | null;
  tokensSalida: number | null;
  createdAt: string | Date;
}

export interface EstadoIA {
  activado: boolean;
  hayClave: boolean;
  modelo: string;
  /** Puede cambiar los ajustes (para enseñarle el enlace). */
  puedeAjustar: boolean;
}

const FECHA = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Madrid',
});

export function PanelIA({
  formId,
  estado,
  inicial,
  clase,
  etapa,
  totalRespuestas,
}: {
  formId: string;
  estado: EstadoIA;
  inicial: InsightCliente | null;
  clase: string | null;
  etapa: string | null;
  totalRespuestas: number;
}) {
  const [insight, setInsight] = useState<InsightCliente | null>(inicial);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modelo = modeloIA(estado.modelo);

  if (!estado.activado) return null;

  async function analizar() {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/evaluaciones/admin/forms/${formId}/insights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clase, etapa }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'No se ha podido analizar');
      setInsight(data.insight);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido analizar');
    } finally {
      setCargando(false);
    }
  }

  const cabecera = (
    <p className="flex items-center gap-1.5 text-sm font-semibold text-violet-900 dark:text-violet-200">
      <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" /> Lo que ve la IA
    </p>
  );
  const marco = `${PANEL} overflow-hidden bg-gradient-to-b from-violet-50/80 to-white dark:from-violet-500/10 dark:to-zinc-900`;

  if (!estado.hayClave) {
    return (
      <div className={`${marco} p-4`}>
        {cabecera}
        <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-300">
          Falta la clave de la API de Anthropic. Es una <b>variable de entorno</b> (<code className="text-xs">ANTHROPIC_API_KEY</code>) que
          se pone en Vercel; en cuanto esté, aquí sale el botón para analizar los resultados con Claude.
        </p>
        {estado.puedeAjustar && <EnlaceAjustes />}
      </div>
    );
  }

  if (!insight) {
    return (
      <div className={`${marco} p-4`}>
        {cabecera}
        <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-300">
          {modelo.label} lee las {totalRespuestas} respuestas y todos los comentarios y te dice qué ha funcionado, qué se critica,
          qué propuestas se repiten y si hay algo que mirar con cuidado. Se mandan sin nombres ni correos.
        </p>
        <BotonAnalizar cargando={cargando} onClick={analizar} texto="Analizar con IA" />
        {error && <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      </div>
    );
  }

  const c = insight.contenido;
  const nuevas = totalRespuestas - insight.respuestas;
  const coste =
    insight.tokensEntrada !== null && insight.tokensSalida !== null
      ? costeIA(insight.modelo, insight.tokensEntrada, insight.tokensSalida)
      : null;

  return (
    <div className={marco}>
      <div className="space-y-4 p-4">
        {cabecera}
        <div>
          <p className="text-lg font-semibold leading-snug text-zinc-900 dark:text-zinc-50">{c.titular}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{c.resumen}</p>
        </div>

        {c.alertas.length > 0 && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-500/30 dark:bg-rose-500/10">
            <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-rose-800 dark:text-rose-300">
              <AlertTriangle className="h-4 w-4" /> Para mirar con cuidado
            </p>
            <ul className="space-y-2">
              {c.alertas.map((a, i) => (
                <li key={i} className="text-sm text-rose-900 dark:text-rose-200">
                  {a.detalle}
                  {a.cita && <span className="mt-0.5 block text-[13px] italic text-rose-700/90 dark:text-rose-300/80">“{a.cita}”</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <Lista titulo="Lo que funciona" icono={<ThumbsUp className="h-4 w-4 text-emerald-600" />} puntos={c.loMejor} tono="emerald" />
          <Lista titulo="Lo que hay que mejorar" icono={<ThumbsDown className="h-4 w-4 text-rose-600" />} puntos={c.aMejorar} tono="rose" />
        </div>

        {c.propuestas.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">Lo que más piden</p>
            <ul className="space-y-1.5">
              {c.propuestas.map((p, i) => (
                <li key={i} className="flex items-start gap-2.5 rounded-xl bg-white/70 px-3 py-2 ring-1 ring-zinc-200/60 dark:bg-zinc-800/40 dark:ring-zinc-700/60">
                  <span className="mt-0.5 shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold tabular-nums text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                    ×{p.cuantos}
                  </span>
                  <span className="min-w-0 text-sm text-zinc-800 dark:text-zinc-200">
                    {p.propuesta}
                    {p.ejemplo && <span className="mt-0.5 block text-[13px] italic text-zinc-500">“{p.ejemplo}”</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {c.diferencias.length > 0 && (
          <div>
            <p className="mb-1.5 text-sm font-semibold text-zinc-800 dark:text-zinc-200">Diferencias entre grupos</p>
            <ul className="space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
              {c.diferencias.map((d, i) => (
                <li key={i}>· {d}</li>
              ))}
            </ul>
          </div>
        )}

        {c.siguientesPasos.length > 0 && (
          <div>
            <p className="mb-1.5 text-sm font-semibold text-zinc-800 dark:text-zinc-200">Siguientes pasos</p>
            <ul className="space-y-1">
              {c.siguientesPasos.map((d, i) => (
                <li key={i} className="flex items-start gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
                  <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" /> {d}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-violet-100 bg-violet-50/50 px-4 py-2.5 dark:border-violet-500/20 dark:bg-violet-500/5">
        <p className="text-[11px] text-zinc-500">
          {modeloIA(insight.modelo).label} · {FECHA.format(new Date(insight.createdAt))} · {insight.respuestas} respuestas
          {coste !== null && ` · ${coste < 0.01 ? '< 1 céntimo' : `~${coste.toFixed(2)} $`}`}
          {nuevas > 0 && <span className="ml-1 font-semibold text-amber-600 dark:text-amber-400">· {nuevas} nuevas desde entonces</span>}
        </p>
        <div className="flex items-center gap-2">
          {error && <span className="text-xs text-rose-600 dark:text-rose-400">{error}</span>}
          <button
            type="button"
            onClick={analizar}
            disabled={cargando}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50 dark:text-violet-300 dark:hover:bg-violet-500/20"
          >
            {cargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {cargando ? 'Analizando…' : 'Volver a analizar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BotonAnalizar({ cargando, onClick, texto }: { cargando: boolean; onClick: () => void; texto: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={cargando}
      className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 disabled:opacity-60"
    >
      {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      {cargando ? 'Leyendo respuestas y comentarios…' : texto}
    </button>
  );
}

function EnlaceAjustes() {
  return (
    <Link
      href="/gestion/ajustes"
      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700 hover:underline dark:text-violet-300"
    >
      <Settings2 className="h-3.5 w-3.5" /> Ajustes del colegio
    </Link>
  );
}

function Lista({
  titulo,
  icono,
  puntos,
  tono,
}: {
  titulo: string;
  icono: React.ReactNode;
  puntos: { titulo: string; detalle: string }[];
  tono: 'emerald' | 'rose';
}) {
  if (puntos.length === 0) return null;
  return (
    <div className="rounded-xl bg-white/70 p-3 ring-1 ring-zinc-200/60 dark:bg-zinc-800/40 dark:ring-zinc-700/60">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
        {icono} {titulo}
      </p>
      <ul className="space-y-2">
        {puntos.map((p, i) => (
          <li key={i} className="flex gap-2 text-sm">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${tono === 'emerald' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span className="text-zinc-700 dark:text-zinc-300">
              <b className="font-semibold text-zinc-900 dark:text-zinc-100">{p.titulo}.</b> {p.detalle}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
