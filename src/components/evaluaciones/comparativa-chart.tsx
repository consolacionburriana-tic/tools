'use client';

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { audienciaLabel } from '@/lib/evaluaciones';

export interface PuntoChart {
  formId: string;
  titulo: string;
  academicYear: string;
  audiencia: string;
  respuestas: number;
  mediaPct: number | null;
}

/**
 * Color por colectivo, en orden fijo y el mismo en todas las vistas, para que
 * "visión alumnos vs visión profes" se lea de un golpe. Los valores salen de las
 * variables CSS de `globals.css`, validadas para daltonismo en claro y oscuro
 * (el trío anterior azul/verde/violeta confundía alumnado con familias).
 */
const COLOR: Record<string, string> = {
  alumnos: 'var(--eval-alumnos)',
  profesores: 'var(--eval-profesores)',
  familias: 'var(--eval-familias)',
};

interface Fila {
  etiqueta: string;
  anio: string;
  media: number | null;
  respuestas: number;
  audiencia: string;
}

function CajaTooltip({ active, payload }: { active?: boolean; payload?: { payload: Fila }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      <p className="font-semibold text-zinc-900 dark:text-zinc-100">{d.anio}</p>
      <p className="text-zinc-500">
        {audienciaLabel(d.audiencia)} · {d.respuestas} respuestas
      </p>
      <p className="mt-0.5 font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
        {d.media === null ? 'sin datos' : `${d.media} / 100`}
      </p>
    </div>
  );
}

export default function ComparativaChart({ puntos }: { puntos: PuntoChart[] }) {
  const datos: Fila[] = puntos.map((p) => ({
    etiqueta: `${p.academicYear} · ${audienciaLabel(p.audiencia)}`,
    anio: p.academicYear,
    media: p.mediaPct === null ? null : Math.round(p.mediaPct),
    respuestas: p.respuestas,
    audiencia: p.audiencia,
  }));
  const colectivos = [...new Set(puntos.map((p) => p.audiencia))];

  return (
    <div>
      {/* Con dos colectivos o más la leyenda va siempre: la identidad no puede
          depender solo del color. */}
      {colectivos.length > 1 && (
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          {colectivos.map((a) => (
            <span key={a} className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLOR[a] }} />
              {audienciaLabel(a)}
            </span>
          ))}
        </div>
      )}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} margin={{ top: 18, right: 8, left: -22, bottom: 4 }}>
            {/* Rejilla recesiva: solo horizontal y muy tenue, para leer alturas sin competir. */}
            <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" vertical={false} />
            <XAxis
              dataKey="etiqueta"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              className="fill-zinc-400"
            />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} className="fill-zinc-400" />
            <Tooltip cursor={{ fill: 'rgba(127,127,127,.08)' }} content={<CajaTooltip />} />
            <Bar dataKey="media" radius={[4, 4, 0, 0]} maxBarSize={54} isAnimationActive={false}>
              {/* Etiqueta directa sobre cada barra: pocas barras, así que el valor
                  siempre visible sale más a cuenta que obligar a pasar el ratón. */}
              <LabelList dataKey="media" position="top" className="fill-zinc-500" fontSize={11} />
              {datos.map((d, i) => (
                <Cell key={i} fill={COLOR[d.audiencia] ?? 'var(--eval-alumnos)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
