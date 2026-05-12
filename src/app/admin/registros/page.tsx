'use client';

import { useEffect, useState } from 'react';
import { format, subDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { BEHAVIORS, REASONS, TIME_SLOTS, STAGES } from '@/lib/constants';
import type { BehaviorReport } from '@/db/schema';

// Tipos mínimos para las vistas agregadas
interface ReportWithJoins extends BehaviorReport {
  studentDisplayName?: string;
}

const TEAL = '#0d9488';
const COLORS = ['#0d9488', '#0891b2', '#7c3aed', '#db2777', '#f59e0b', '#84cc16'];

export default function RegistrosPage() {
  const [reports, setReports] = useState<ReportWithJoins[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'list' | 'informe'>('list');
  const [page, setPage] = useState(1);

  const fetchReports = async (p = 1) => {
    setLoading(true);
    const res = await fetch(`/api/reports?page=${p}&limit=20`);
    const data: ReportWithJoins[] = await res.json();
    setReports(data);
    setLoading(false);
  };

  useEffect(() => { fetchReports(page); }, [page]);

  // Estadísticas para el informe
  const behaviorCounts = BEHAVIORS.map((b) => ({
    name: b.label,
    count: reports.filter((r) => (r.behaviors as string[]).includes(b.value)).length,
  })).sort((a, b) => b.count - a.count);

  const weekdayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const weekdayCounts = weekdayNames.map((name, idx) => ({
    name,
    count: reports.filter((r) => r.dayOfWeek === idx).length,
  }));

  const slotCounts = TIME_SLOTS.map((s) => ({
    name: s.label.split(' ').slice(0, 2).join(' '),
    count: reports.filter((r) => r.timeSlot === s.value).length,
  }));

  const contextCounts = [
    { name: 'Aula', value: reports.filter((r) => r.context === 'aula').length },
    { name: 'Patio', value: reports.filter((r) => r.context === 'patio').length },
    { name: 'Comedor', value: reports.filter((r) => r.context === 'comedor').length },
    { name: 'Otros', value: reports.filter((r) => r.context === 'otros').length },
  ].filter((c) => c.value > 0);

  const reasonCounts = REASONS.map((r) => ({
    name: r.label,
    count: reports.filter((rpt) => (rpt.reasons as string[])?.includes(r.value)).length,
  })).sort((a, b) => b.count - a.count);

  const effectivenessVals = reports
    .map((r) => r.effectivenessRating)
    .filter((v): v is string => v !== null && v !== undefined);
  const avgEffectiveness = effectivenessVals.length > 0
    ? (effectivenessVals.reduce((s, v) => s + parseFloat(v), 0) / effectivenessVals.length).toFixed(1)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Registros</h1>
        <div className="flex rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden text-sm">
          <button
            onClick={() => setMode('list')}
            className={`px-4 py-2 transition-colors ${mode === 'list' ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 font-medium' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50'}`}
          >
            Listado
          </button>
          <button
            onClick={() => setMode('informe')}
            className={`px-4 py-2 transition-colors ${mode === 'informe' ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 font-medium' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50'}`}
          >
            Informe agregado
          </button>
        </div>
      </div>

      {mode === 'list' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            {loading ? (
              <p className="p-6 text-sm text-zinc-400 text-center">Cargando…</p>
            ) : reports.length === 0 ? (
              <p className="p-6 text-sm text-zinc-400 text-center">Sin registros todavía.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium text-zinc-500">Fecha</th>
                    <th className="text-left px-5 py-3 font-medium text-zinc-500">Contexto</th>
                    <th className="text-left px-5 py-3 font-medium text-zinc-500">Conductas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {reports.map((r) => {
                    const behaviors = (r.behaviors as string[]) ?? [];
                    return (
                      <tr key={r.id}>
                        <td className="px-5 py-3 text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                          {format(new Date(r.reportDate), "d MMM yyyy", { locale: es })}
                        </td>
                        <td className="px-5 py-3">
                          <span className="capitalize text-zinc-600 dark:text-zinc-400">{r.context}</span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-1">
                            {behaviors.slice(0, 3).map((b) => (
                              <span
                                key={b}
                                className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400"
                              >
                                {b.replace(/_/g, ' ')}
                              </span>
                            ))}
                            {behaviors.length > 3 && (
                              <span className="text-[10px] text-zinc-400">+{behaviors.length - 3}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Anterior
            </button>
            <span className="text-sm text-zinc-500">Página {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={reports.length < 20}
              className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {mode === 'informe' && (
        <div className="space-y-8">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Mostrando datos de los últimos <strong>{reports.length}</strong> registros cargados.
          </p>

          {/* Efectividad media */}
          {avgEffectiveness && (
            <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-center">
              <p className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-2">
                Efectividad media de reconducción
              </p>
              <p className="text-5xl font-bold font-mono text-teal-600 dark:text-teal-400">{avgEffectiveness}</p>
              <p className="text-xs text-zinc-400 mt-1">sobre 5.0</p>
            </div>
          )}

          {/* Conductas */}
          <ChartCard title="Conductas más frecuentes">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={behaviorCounts} layout="vertical" margin={{ left: 8, right: 24 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={160} />
                <Tooltip />
                <Bar dataKey="count" fill={TEAL} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Día de la semana */}
          <ChartCard title="Por día de la semana">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weekdayCounts} margin={{ left: 0, right: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill={TEAL} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Franja horaria */}
          <ChartCard title="Por franja horaria">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={slotCounts} margin={{ left: 0, right: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#0891b2" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Contexto */}
          {contextCounts.length > 0 && (
            <ChartCard title="Contexto">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={contextCounts} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {contextCounts.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Motivos */}
          <ChartCard title="Motivos atribuidos">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={reasonCounts} layout="vertical" margin={{ left: 8, right: 24 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={160} />
                <Tooltip />
                <Bar dataKey="count" fill="#7c3aed" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
      <h3 className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm">{title}</h3>
      {children}
    </div>
  );
}
