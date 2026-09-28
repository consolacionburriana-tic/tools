'use client';

// Histórico de «Números del cole»: las fotos mensuales (y las hechas a mano) para ver cómo
// evolucionan los números. Va aparte de «Hoy» a propósito, para no mezclar nunca lo de hoy
// con lo congelado (docs/24-numeros.md, decisión 7).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { copiarTexto } from '@/components/alumnado/copiable';
import { haptic } from '@/lib/haptics';
import {
  construirTabla,
  ETAPA_HEX,
  ETAPA_NOMBRE,
  ETAPAS_ORDEN,
  METRICAS_HISTORICO,
  porEtapa,
  type DatosNumeros,
  type PermisosNumeros,
} from '@/lib/numeros';
import type { Etapa } from '@/lib/cursos';

interface Foto {
  id: string;
  tomadaAt: string;
  origen: string;
  nota: string | null;
  datos: DatosNumeros;
}

interface Punto {
  id: string;
  etiqueta: string;
  largo: string;
  datos: DatosNumeros;
  hoy: boolean;
}

const PUNTO_ETAPA: Record<Etapa, string> = {
  EI: 'bg-[#d97316] dark:bg-[#d4772c]',
  EP: 'bg-[#2563eb] dark:bg-[#4f80ee]',
  ESO: 'bg-[#0e9f6e] dark:bg-[#1f9f6d]',
};
// El trazo sale de una variable CSS para que cambie con el tema sin repintar nada.
const TRAZO: Record<Etapa, string> = { EI: 'var(--num-ei)', EP: 'var(--num-ep)', ESO: 'var(--num-eso)' };

const corta = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Europe/Madrid' });
const larga = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' });

function primeroDelMesQueViene(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
}

export function Historico({
  permisos,
  puedeFoto,
  etapasPropias,
}: {
  permisos: PermisosNumeros;
  puedeFoto: boolean;
  etapasPropias: Etapa[];
}) {
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [hoy, setHoy] = useState<DatosNumeros | null>(null);
  const [metrica, setMetrica] = useState(METRICAS_HISTORICO[0].id);
  const [a, setA] = useState<string | null>(null);
  const [b, setB] = useState<string>('hoy');
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let vivo = true;
    fetch('/api/numeros/fotos')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { fotos: Foto[]; hoy: DatosNumeros }) => {
        if (!vivo) return;
        setFotos(j.fotos);
        setHoy(j.hoy);
        setEstado('listo');
      })
      .catch(() => vivo && setEstado('error'));
    return () => {
      vivo = false;
    };
  }, [recarga]);

  const puntos: Punto[] = useMemo(() => {
    const ps: Punto[] = fotos.map((f) => ({
      id: f.id,
      etiqueta: corta(f.tomadaAt),
      largo: `${larga(f.tomadaAt)}${f.origen === 'manual' ? ' (a mano)' : ''}${f.nota ? ` · ${f.nota}` : ''}`,
      datos: f.datos,
      hoy: false,
    }));
    if (hoy) ps.push({ id: 'hoy', etiqueta: 'Hoy', largo: 'Hoy', datos: hoy, hoy: true });
    return ps;
  }, [fotos, hoy]);

  const met = METRICAS_HISTORICO.find((m) => m.id === metrica) ?? METRICAS_HISTORICO[0];
  const etapas = ETAPAS_ORDEN.filter(
    (e) => (!etapasPropias.length || etapasPropias.includes(e)) && puntos.some((p) => p.datos.filas.some((f) => f.etapa === e)),
  );
  const series = puntos.map((p) => porEtapa(p.datos.filas, met.valor));

  async function guardarFoto() {
    setGuardando(true);
    try {
      const r = await fetch('/api/numeros/fotos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nota: nota.trim() || undefined }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Error');
      haptic.success();
      toast.success('Foto guardada: ya sale en el histórico');
      setNota('');
      setRecarga((x) => x + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar la foto');
    } finally {
      setGuardando(false);
    }
  }

  async function copiarSerie() {
    const cab = ['Foto', ...etapas.map((e) => ETAPA_NOMBRE[e]), 'Total'];
    const filas = puntos.map((p, i) => [p.hoy ? 'Hoy' : p.largo, ...etapas.map((e) => String(series[i][e])), String(etapas.reduce((s, e) => s + series[i][e], 0))]);
    if (await copiarTexto([cab, ...filas].map((r) => r.join('\t')).join('\n'))) {
      haptic.tap();
      toast.success('Serie copiada: pégala en una hoja y haz tu gráfico');
    }
  }

  if (estado === 'cargando') {
    return <div className="h-80 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900" />;
  }
  if (estado === 'error') {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900 dark:bg-red-500/10 dark:text-red-200">
        No se pudo leer el histórico. Vuelve a probar en un momento.
      </div>
    );
  }

  const botonFoto = puedeFoto && (
    <div className="flex flex-wrap items-center gap-2">
      <input
        id="nota-foto"
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        maxLength={200}
        placeholder="Nota (opcional): «para la memoria»"
        className="w-60 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
      />
      <button
        type="button"
        onClick={guardarFoto}
        disabled={guardando}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        Guardar una foto ahora
      </button>
    </div>
  );

  if (fotos.length === 0) {
    return (
      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Todavía no hay fotos</h2>
        <p className="max-w-prose text-sm text-zinc-600 dark:text-zinc-400">
          El día 1 de cada mes se guarda sola una foto de todos los números, por clase. La primera será el{' '}
          <b className="font-semibold">{primeroDelMesQueViene()}</b>, y a partir de ahí aquí verás cómo evoluciona cada
          etapa y podrás comparar dos meses cualquiera.
          {puedeFoto && ' Si quieres empezar ya, guarda una a mano.'}
        </p>
        {botonFoto}
      </section>
    );
  }

  const ia = puntos.findIndex((p) => p.id === (a ?? puntos[0].id));
  const ib = puntos.findIndex((p) => p.id === b);
  const pa = puntos[ia >= 0 ? ia : 0];
  const pb = puntos[ib >= 0 ? ib : puntos.length - 1];

  return (
    <section
      className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm [--num-ei:#d97316] [--num-ep:#2563eb] [--num-eso:#0e9f6e] dark:border-zinc-800 dark:bg-zinc-900 dark:[--num-ei:#d4772c] dark:[--num-ep:#4f80ee] dark:[--num-eso:#1f9f6d]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-zinc-200 px-3 py-3 dark:border-zinc-800">
        <div role="group" aria-label="Qué número" className="inline-flex flex-wrap gap-0.5 rounded-xl border border-zinc-200 bg-zinc-100 p-0.5 dark:border-zinc-800 dark:bg-zinc-900">
          {METRICAS_HISTORICO.filter((m) => m.id !== 'licencias' || permisos.licencias).map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={m.id === met.id}
              onClick={() => setMetrica(m.id)}
              className={`cursor-pointer rounded-[10px] px-2.5 py-1.5 text-[13px] ${
                m.id === met.id ? 'bg-white font-semibold text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400'
              }`}
            >
              {m.titulo}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {botonFoto}
          <button
            type="button"
            onClick={copiarSerie}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Copy className="h-4 w-4" /> Copiar la serie
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.6fr_1fr]">
        <div className="border-b border-zinc-200 p-4 lg:border-b-0 lg:border-r dark:border-zinc-800">
          <div className="mb-2 flex flex-wrap gap-4 text-[12.5px] text-zinc-600 dark:text-zinc-400">
            {etapas.map((e) => (
              <span key={e} className="inline-flex items-center gap-1.5">
                <i className={`h-[3px] w-3.5 rounded-full ${PUNTO_ETAPA[e]}`} />
                {ETAPA_NOMBRE[e]}
              </span>
            ))}
          </div>
          <Grafico puntos={puntos} series={series} etapas={etapas} titulo={met.titulo} />
        </div>

        <div className="space-y-3 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Comparar dos fotos</p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select
              aria-label="Foto de antes"
              value={pa.id}
              onChange={(e) => setA(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-950"
            >
              {puntos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.hoy ? 'Hoy' : p.largo}
                </option>
              ))}
            </select>
            <span className="text-zinc-400">→</span>
            <select
              aria-label="Foto de después"
              value={pb.id}
              onChange={(e) => setB(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-950"
            >
              {puntos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.hoy ? 'Hoy' : p.largo}
                </option>
              ))}
            </select>
          </div>
          <Comparacion a={pa} b={pb} valor={met.valor} titulo={met.titulo} etapasPropias={etapasPropias} />
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto border-t border-zinc-200 px-3 py-3 dark:border-zinc-800">
        {puntos.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setA(p.id)}
            title={p.largo}
            className={`shrink-0 cursor-pointer rounded-xl border px-2.5 py-1.5 text-left text-xs ${
              p.hoy
                ? 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-500/10 dark:text-blue-200'
                : p.id === pa.id
                  ? 'border-zinc-400 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800'
                  : 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400'
            }`}
          >
            <b className="block text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">{p.etiqueta}</b>
            {p.hoy ? 'en vivo' : fotos.find((f) => f.id === p.id)?.origen === 'manual' ? 'a mano' : 'mensual'}
          </button>
        ))}
      </div>
    </section>
  );
}

function Grafico({
  puntos,
  series,
  etapas,
  titulo,
}: {
  puntos: Punto[];
  series: Record<Etapa | 'total', number>[];
  etapas: Etapa[];
  titulo: string;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const W = 640;
  const H = 280;
  const L = 44;
  const R = 70;
  const T = 14;
  const B = 32;
  const valores = series.flatMap((s) => etapas.map((e) => s[e]));
  let lo = Math.min(...valores, 0);
  let hi = Math.max(...valores, 1);
  const holgura = Math.max(2, (hi - lo) * 0.12);
  lo = Math.max(0, Math.floor((lo - holgura) / 5) * 5);
  hi = Math.ceil((hi + holgura) / 5) * 5;
  const rango = hi - lo || 1;
  const paso = rango > 300 ? 100 : rango > 120 ? 50 : rango > 50 ? 20 : rango > 20 ? 10 : 5;
  const n = puntos.length;
  const X = (i: number) => (n === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (n - 1));
  const Y = (v: number) => T + (H - T - B) * (1 - (v - lo) / rango);
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / paso) * paso; v <= hi; v += paso) ticks.push(v);
  const cadaEtiqueta = Math.max(1, Math.ceil(n / 7));

  // Etiquetas al final de cada línea, separadas si caen encima.
  const finales = etapas
    .map((e) => ({ e, y: Y(series[n - 1][e]), v: series[n - 1][e] }))
    .sort((p, q) => p.y - q.y);
  for (let i = 1; i < finales.length; i++) if (finales[i].y - finales[i - 1].y < 15) finales[i].y = finales[i - 1].y + 15;

  const mover = (clientX: number) => {
    const r = caja.current?.getBoundingClientRect();
    if (!r) return;
    const px = ((clientX - r.left) * W) / r.width;
    const i = n === 1 ? 0 : Math.round(((px - L) * (n - 1)) / (W - L - R));
    setCursor(Math.max(0, Math.min(n - 1, i)));
  };

  return (
    <div
      ref={caja}
      className="relative"
      onPointerMove={(e) => mover(e.clientX)}
      onPointerDown={(e) => mover(e.clientX)}
      onPointerLeave={() => setCursor(null)}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full touch-pan-y" role="img" aria-label={`${titulo} por etapa, foto a foto`}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} className="stroke-zinc-200 dark:stroke-zinc-800" strokeWidth={1} />
            <text x={L - 8} y={Y(v) + 4} textAnchor="end" fontSize={11} className="fill-zinc-400">
              {v}
            </text>
          </g>
        ))}
        {puntos.map((p, i) =>
          i % cadaEtiqueta === 0 || i === n - 1 ? (
            <text
              key={p.id}
              x={X(i)}
              y={H - 10}
              textAnchor="middle"
              fontSize={11}
              className={p.hoy ? 'fill-zinc-900 font-semibold dark:fill-zinc-100' : 'fill-zinc-400'}
            >
              {p.etiqueta}
            </text>
          ) : null,
        )}
        {etapas.map((e) => (
          <g key={e}>
            {n > 1 && (
              <polyline
                points={series.map((s, i) => `${X(i)},${Y(s[e])}`).join(' ')}
                fill="none"
                stroke={TRAZO[e]}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            <circle cx={X(n - 1)} cy={Y(series[n - 1][e])} r={4.5} fill={TRAZO[e]} className="stroke-white dark:stroke-zinc-900" strokeWidth={2} />
          </g>
        ))}
        {finales.map((f) => (
          <text key={f.e} x={X(n - 1) + 10} y={f.y + 4} fontSize={12} className="fill-zinc-900 font-semibold dark:fill-zinc-100">
            {f.v}
            <tspan className="fill-zinc-400 font-normal" fontSize={11}>
              {' '}
              {ETAPA_NOMBRE[f.e].slice(0, 3)}.
            </tspan>
          </text>
        ))}
        {cursor !== null && <line x1={X(cursor)} x2={X(cursor)} y1={T} y2={H - B} className="stroke-zinc-400" strokeWidth={1} />}
      </svg>
      {cursor !== null && (
        <div
          className="pointer-events-none absolute top-2 z-10 min-w-40 rounded-xl border border-zinc-200 bg-white p-2.5 text-xs tabular-nums shadow-md dark:border-zinc-700 dark:bg-zinc-900"
          style={{ left: `${Math.min(70, (X(cursor) / W) * 100)}%` }}
        >
          <b className="mb-1 block font-semibold text-zinc-900 dark:text-zinc-100">{puntos[cursor].largo}</b>
          {etapas.map((e) => (
            <div key={e} className="flex justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                <i className="h-2 w-2 rounded-full" style={{ background: ETAPA_HEX[e].claro }} />
                {ETAPA_NOMBRE[e]}
              </span>
              <b>{series[cursor][e]}</b>
            </div>
          ))}
          {etapas.length > 1 && (
            <div className="mt-0.5 flex justify-between gap-3 border-t border-zinc-100 pt-0.5 dark:border-zinc-800">
              <span className="text-zinc-600 dark:text-zinc-400">Total</span>
              <b>{etapas.reduce((s, e) => s + series[cursor][e], 0)}</b>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Comparacion({
  a,
  b,
  valor,
  titulo,
  etapasPropias,
}: {
  a: Punto;
  b: Punto;
  valor: (v: Record<string, number>) => number;
  titulo: string;
  etapasPropias: Etapa[];
}) {
  const filtrar = (d: DatosNumeros) =>
    etapasPropias.length ? d.filas.filter((f) => etapasPropias.includes(f.etapa)) : d.filas;
  const ta = construirTabla(filtrar(a.datos), 'cursos');
  const tb = construirTabla(filtrar(b.datos), 'cursos');
  const claves = [...new Set([...tb.map((f) => f.clave), ...ta.map((f) => f.clave)])];
  const filas = claves
    .map((k) => {
      const fa = ta.find((f) => f.clave === k);
      const fb = tb.find((f) => f.clave === k);
      const base = fb ?? fa!;
      return { clave: k, nombre: base.nombre, tipo: base.tipo, va: fa ? valor(fa.v) : 0, vb: fb ? valor(fb.v) : 0 };
    })
    // El orden de la foto nueva manda; lo que solo existía en la vieja va detrás.
    .sort((x, y) => {
      const ix = tb.findIndex((f) => f.clave === x.clave);
      const iy = tb.findIndex((f) => f.clave === y.clave);
      return (ix < 0 ? 999 : ix) - (iy < 0 ? 999 : iy);
    });
  return (
    <div className="max-h-96 overflow-auto">
      <table className="w-full border-collapse text-[13px] tabular-nums">
        <thead>
          <tr className="text-[11.5px] text-zinc-400">
            <th className="py-1.5 pr-2 text-left font-semibold">{titulo}</th>
            <th className="px-2 py-1.5 text-right font-semibold">{a.etiqueta}</th>
            <th className="px-2 py-1.5 text-right font-semibold">{b.etiqueta}</th>
            <th className="py-1.5 pl-2 text-right font-semibold">Cambio</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => {
            const d = f.vb - f.va;
            const grupo = f.tipo === 'etapa' || f.tipo === 'total';
            return (
              <tr key={f.clave} className={`border-t border-zinc-100 dark:border-zinc-800 ${grupo ? 'font-semibold' : ''}`}>
                <td className="py-1.5 pr-2">{f.nombre}</td>
                <td className="px-2 py-1.5 text-right">{Math.round(f.va)}</td>
                <td className="px-2 py-1.5 text-right">{Math.round(f.vb)}</td>
                <td
                  className={`py-1.5 pl-2 text-right ${d > 0 ? 'text-green-700 dark:text-green-400' : d < 0 ? 'text-red-600 dark:text-red-400' : 'text-zinc-400'}`}
                >
                  {d > 0 ? '+' : ''}
                  {Math.round(d)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
