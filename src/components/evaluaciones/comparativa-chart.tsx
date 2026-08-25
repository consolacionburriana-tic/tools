'use client';

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { audienciaLabel } from '@/lib/evaluaciones';

export interface PuntoChart {
  formId: string;
  titulo: string;
  academicYear: string;
  audiencia: string;
  respuestas: number;
  mediaPct: number | null;
}

// Alumnado en azul, profesorado en verde, familias en violeta: el mismo color en todas
// las vistas para que "visión alumnos vs visión profes" se lea de un vistazo.
const COLOR: Record<string, string> = {
  alumnos: '#2563eb',
  profesores: '#059669',
  familias: '#7c3aed',
};

export default function ComparativaChart({ puntos }: { puntos: PuntoChart[] }) {
  const datos = puntos.map((p) => ({
    etiqueta: `${p.academicYear} · ${audienciaLabel(p.audiencia)}`,
    media: p.mediaPct === null ? 0 : Math.round(p.mediaPct),
    respuestas: p.respuestas,
    audiencia: p.audiencia,
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} margin={{ top: 8, right: 8, left: -20, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
          <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} stroke="#a1a1aa" />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#a1a1aa" />
          <Tooltip
            formatter={(valor) => [`${valor} / 100`, 'Valoración']}
            contentStyle={{ borderRadius: 12, border: '1px solid #e4e4e7', fontSize: 12 }}
          />
          <Bar dataKey="media" radius={[6, 6, 0, 0]}>
            {datos.map((d, i) => (
              <Cell key={i} fill={COLOR[d.audiencia] ?? '#2563eb'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
