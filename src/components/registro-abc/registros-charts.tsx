'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { format, parseISO, eachDayOfInterval, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid,
} from 'recharts';
import { Calendar as CalendarIcon, AlertTriangle, TrendingUp, FileText, ExternalLink } from 'lucide-react';
import { BEHAVIORS, REASONS, TIME_SLOTS, CONTEXTS, PRESENT_PEOPLE, STAGE_LABELS, type StageValue } from '@/lib/constants';
import type { Teacher } from '@/db/schema';
import type { AbcStudentPanel } from '@/lib/abc-server';
import { getDateRange, label, TIME_PRESETS, type ReportRow } from '@/app/gestion/abc/registros/page';

const TEAL = '#0d9488';
const PALETTE = ['#0d9488', '#0891b2', '#06b6d4', '#22d3ee', '#67e8f9', '#a5f3fc'];
const WEEKDAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// Informe agregado del listado de registros ABC: KPIs, tendencia, heatmap día×franja,
// rankings de conductas/hipótesis y detalle completo de cada parte. Aislado en su propio
// chunk (recharts es la dependencia de cliente más pesada del repo) y cargado con
// next/dynamic desde la página — el listado, que es el modo por defecto, nunca lo descarga.
export default function RegistrosCharts({
  reports, loading, timePreset, studentMap, teacherMap, selectedStudentIds,
}: {
  reports: ReportRow[];
  loading: boolean;
  timePreset: string;
  studentMap: Map<string, AbcStudentPanel>;
  teacherMap: Map<string, Teacher>;
  selectedStudentIds: string[];
}) {
  const [showAllRecords, setShowAllRecords] = useState(false);

  // Modo "un solo alumno seleccionado" → vista enfocada en ese alumno
  const focusedStudent = selectedStudentIds.length === 1
    ? studentMap.get(selectedStudentIds[0]) ?? null
    : null;

  const stats = useMemo(() => {
    if (reports.length === 0) return null;

    const total = reports.length;
    const uniqueStudents = new Set(reports.map((r) => r.studentId)).size;
    const uniqueTeachers = new Set(reports.map((r) => r.teacherId).filter(Boolean)).size;

    const effVals = reports.map((r) => r.effectivenessRating).filter((v): v is string => !!v).map(parseFloat);
    const avgEff = effVals.length > 0 ? effVals.reduce((s, v) => s + v, 0) / effVals.length : null;

    // Última fecha de registro
    const lastReport = reports[0]; // ya vienen ordenados desc
    const lastDate = lastReport ? lastReport.reportDate : null;

    // Conducta más frecuente
    const behaviorCount0 = new Map<string, number>();
    reports.forEach((r) => (r.behaviors ?? []).forEach((b) => behaviorCount0.set(b, (behaviorCount0.get(b) ?? 0) + 1)));
    const topBehavior = BEHAVIORS
      .map((b) => ({ value: b.value, label: b.label, count: behaviorCount0.get(b.value) ?? 0 }))
      .sort((a, b) => b.count - a.count)[0];

    const behaviorCount = new Map<string, number>();
    reports.forEach((r) => (r.behaviors ?? []).forEach((b) => behaviorCount.set(b, (behaviorCount.get(b) ?? 0) + 1)));
    const behaviorRanking = BEHAVIORS
      .map((b) => ({ name: b.label, count: behaviorCount.get(b.value) ?? 0 }))
      .sort((a, b) => b.count - a.count);
    const maxBehavior = Math.max(1, ...behaviorRanking.map((b) => b.count));

    const reasonCount = new Map<string, number>();
    reports.forEach((r) => (r.reasons ?? []).forEach((x) => reasonCount.set(x, (reasonCount.get(x) ?? 0) + 1)));
    const reasonRanking = REASONS
      .map((r) => ({ name: r.label, count: reasonCount.get(r.value) ?? 0 }))
      .sort((a, b) => b.count - a.count);

    const contextData = CONTEXTS.map((c) => ({
      name: c.label,
      value: reports.filter((r) => r.context === c.value).length,
    })).filter((c) => c.value > 0);

    const weekdayData = [1, 2, 3, 4, 5].map((d) => ({
      name: WEEKDAY_NAMES[d],
      count: reports.filter((r) => r.dayOfWeek === d).length,
    }));

    const slotData = TIME_SLOTS.map((s) => ({
      name: s.label.split(' ').slice(0, 2).join(' '),
      count: reports.filter((r) => r.timeSlot === s.value).length,
    }));

    const heatmap: { day: number; slot: string; count: number }[] = [];
    for (let day = 1; day <= 5; day++) {
      for (const s of TIME_SLOTS) {
        heatmap.push({
          day, slot: s.value,
          count: reports.filter((r) => r.dayOfWeek === day && r.timeSlot === s.value).length,
        });
      }
    }
    const heatmapMax = Math.max(1, ...heatmap.map((h) => h.count));

    const range = getDateRange(timePreset);
    let trendData: { label: string; count: number }[] = [];
    if (range && differenceInDays(range.to, range.from) <= 92) {
      const days = eachDayOfInterval({ start: range.from, end: range.to });
      trendData = days.map((d) => {
        const dStr = format(d, 'yyyy-MM-dd');
        return {
          label: format(d, days.length > 31 ? 'd MMM' : 'd', { locale: es }),
          count: reports.filter((r) => r.reportDate === dStr).length,
        };
      });
    } else {
      const byWeek = new Map<string, number>();
      reports.forEach((r) => {
        const d = parseISO(r.reportDate);
        const key = format(d, 'yyyy-ww');
        byWeek.set(key, (byWeek.get(key) ?? 0) + 1);
      });
      trendData = Array.from(byWeek.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, count]) => ({ label: `s${k.split('-')[1]}`, count }));
    }

    const effBuckets = [
      { label: '0-1', count: effVals.filter((v) => v < 1).length },
      { label: '1-2', count: effVals.filter((v) => v >= 1 && v < 2).length },
      { label: '2-3', count: effVals.filter((v) => v >= 2 && v < 3).length },
      { label: '3-4', count: effVals.filter((v) => v >= 3 && v < 4).length },
      { label: '4-5', count: effVals.filter((v) => v >= 4).length },
    ];

    const peopleCount = new Map<string, number>();
    reports.forEach((r) => (r.presentPeople ?? []).forEach((p) => peopleCount.set(p, (peopleCount.get(p) ?? 0) + 1)));
    const peopleData = PRESENT_PEOPLE
      .map((p) => ({ name: p.label, count: peopleCount.get(p.value) ?? 0 }))
      .filter((p) => p.count > 0)
      .sort((a, b) => b.count - a.count);

    return {
      total, uniqueStudents, uniqueTeachers, avgEff, lastDate, topBehavior,
      behaviorRanking, maxBehavior, reasonRanking, contextData,
      weekdayData, slotData, heatmap, heatmapMax, trendData,
      effBuckets, effValsCount: effVals.length, peopleData,
    };
  }, [reports, timePreset]);

  if (loading) {
    return <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-12 text-center text-sm text-zinc-400">Cargando datos…</div>;
  }
  if (!stats) {
    return <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-12 text-center text-sm text-zinc-400">Sin datos para estos filtros.</div>;
  }

  const displayedReports = showAllRecords ? reports : reports.slice(0, 20);

  return (
    <div className="space-y-4">
      {/* ── Perfil del alumno (cuando hay UNO seleccionado) ────────────── */}
      {focusedStudent && (
        <div className="rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 dark:from-teal-600 dark:to-cyan-700 text-white p-5 shadow-sm">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center text-xl font-bold shrink-0">
              {focusedStudent.siglas.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium uppercase tracking-widest text-teal-100/80">Informe individual</p>
              <h2 className="text-2xl font-bold leading-tight">{focusedStudent.siglas}</h2>
              <p className="text-sm text-teal-50/90 mt-0.5">{focusedStudent.clase}</p>
            </div>
            <div className="text-right text-xs">
              <p className="text-teal-100/80 uppercase tracking-widest">Período</p>
              <p className="font-semibold text-sm">{TIME_PRESETS.find((p) => p.value === timePreset)?.label}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── KPIs adaptativos ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Registros" value={stats.total} hint="en el período" accent />
        {focusedStudent ? (
          <>
            <KpiCard
              label="Último registro"
              value={stats.lastDate ? format(parseISO(stats.lastDate), "d MMM", { locale: es }) : '—'}
              hint={stats.lastDate ? format(parseISO(stats.lastDate), "EEEE", { locale: es }) : ''}
            />
            <KpiCard label="Profesores" value={stats.uniqueTeachers} hint="que registran" />
            <KpiCard
              label="Conducta más frecuente"
              value={stats.topBehavior?.count || 0}
              hint={stats.topBehavior?.label}
              valueClass="text-rose-600 dark:text-rose-400"
            />
          </>
        ) : (
          <>
            <KpiCard label="Alumnos" value={stats.uniqueStudents} hint="con registros" />
            <KpiCard label="Profesores" value={stats.uniqueTeachers} hint="que registran" />
            <KpiCard
              label="Conducta más frecuente"
              value={stats.topBehavior?.count || 0}
              hint={stats.topBehavior?.label}
              valueClass="text-rose-600 dark:text-rose-400"
            />
          </>
        )}
      </div>

      {/* Tendencia */}
      <Card title="Tendencia" icon={<TrendingUp className="w-3.5 h-3.5" />}>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={stats.trendData} margin={{ top: 8, right: 8, left: -28, bottom: 0 }}>
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={TEAL} stopOpacity={0.5} />
                <stop offset="100%" stopColor={TEAL} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e4e4e7" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#a1a1aa' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e4e4e7', fontSize: 12, padding: '6px 10px' }} labelStyle={{ fontWeight: 600 }} />
            <Area type="monotone" dataKey="count" stroke={TEAL} strokeWidth={2} fill="url(#grad)" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Heatmap */}
      <Card title="Patrones · Día × franja horaria" icon={<CalendarIcon className="w-3.5 h-3.5" />}>
        <Heatmap data={stats.heatmap} max={stats.heatmapMax} />
      </Card>

      {/* Conductas + Contexto */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Conductas más frecuentes" icon={<AlertTriangle className="w-3.5 h-3.5 text-rose-500" />} className="lg:col-span-2">
          <div className="space-y-2">
            {stats.behaviorRanking.map((b) => (
              <ProgressBar key={b.name} label={b.name} count={b.count} max={stats.maxBehavior} color="rose" />
            ))}
          </div>
        </Card>

        <Card title="Contexto">
          {stats.contextData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={stats.contextData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={70} paddingAngle={2}>
                  {stats.contextData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e4e4e7', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyHint />}
          <div className="flex flex-wrap gap-2 mt-2 justify-center">
            {stats.contextData.map((c, i) => (
              <div key={c.name} className="flex items-center gap-1 text-[10px] text-zinc-500">
                <span className="w-2 h-2 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                {c.name} ({c.value})
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Hipótesis · sin la efectividad al lado (se baja de tono) */}
      <Card title="¿Por qué? · Hipótesis registradas">
        {stats.reasonRanking.some((r) => r.count > 0) ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {stats.reasonRanking.map((r) => {
              const maxReason = stats.reasonRanking[0]?.count || 1;
              return <ProgressBar key={r.name} label={r.name} count={r.count} max={maxReason} color="teal" />;
            })}
          </div>
        ) : <EmptyHint />}
      </Card>

      {/* Día semana + Franja horaria */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Por día de la semana">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stats.weekdayData} margin={{ top: 8, right: 8, left: -28, bottom: 0 }}>
              <CartesianGrid stroke="#e4e4e7" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#a1a1aa' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e4e4e7', fontSize: 12 }} />
              <Bar dataKey="count" fill={TEAL} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Por franja horaria">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stats.slotData} margin={{ top: 8, right: 8, left: -28, bottom: 24 }}>
              <CartesianGrid stroke="#e4e4e7" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#a1a1aa' }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" height={50} interval={0} />
              <YAxis tick={{ fontSize: 10, fill: '#a1a1aa' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e4e4e7', fontSize: 12 }} />
              <Bar dataKey="count" fill="#0891b2" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Personas presentes */}
      <Card title="Personas presentes durante el incidente">
        {stats.peopleData.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {stats.peopleData.map((p) => (
              <ProgressBar
                key={p.name}
                label={p.name}
                count={p.count}
                max={stats.peopleData[0].count}
                color="zinc"
              />
            ))}
          </div>
        ) : <EmptyHint />}
      </Card>

      {/* ── Efectividad · indicador subjetivo (de tono bajado) ──────────── */}
      {stats.effValsCount > 0 && (
        <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-dashed border-zinc-200 dark:border-zinc-800 p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              Efectividad de reconducción
            </h3>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-600 italic">
              indicador subjetivo y opcional · {stats.effValsCount} de {stats.total} valoraron
            </span>
          </div>
          <div className="flex items-center gap-6 flex-wrap">
            <div>
              <p className="text-2xl font-bold font-mono text-zinc-500 dark:text-zinc-400 tabular-nums leading-none">
                {stats.avgEff?.toFixed(1)}
                <span className="text-sm text-zinc-400 dark:text-zinc-600 ml-1">/ 5.0</span>
              </p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-1">media</p>
            </div>
            <div className="flex-1 min-w-[240px]">
              <ResponsiveContainer width="100%" height={70}>
                <BarChart data={stats.effBuckets} margin={{ top: 4, right: 0, left: -36, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e4e4e7', fontSize: 12 }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {stats.effBuckets.map((_, i) => (
                      <Cell key={i} fill={i < 2 ? '#fda4af' : i < 3 ? '#fcd34d' : '#86efac'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ── Detalle de cada registro · TODA la info ──────────────────────── */}
      <Card
        title={`Detalle de cada registro · ${reports.length} ${reports.length === 1 ? 'entrada' : 'entradas'}`}
        icon={<FileText className="w-3.5 h-3.5" />}
      >
        <div className="space-y-3">
          {displayedReports.map((r) => (
            <RecordDetail
              key={r.id}
              report={r}
              student={studentMap.get(r.studentId) ?? null}
              teacher={r.teacherId ? teacherMap.get(r.teacherId) ?? null : null}
              hideStudent={!!focusedStudent}
            />
          ))}
          {reports.length > 20 && (
            <button
              onClick={() => setShowAllRecords(!showAllRecords)}
              className="w-full py-3 text-xs font-medium text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-xl transition-colors border border-dashed border-teal-200 dark:border-teal-900/50"
            >
              {showAllRecords
                ? `Mostrar solo los 20 más recientes`
                : `Mostrar los ${reports.length - 20} registros restantes`}
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function RecordDetail({
  report, student, teacher, hideStudent,
}: {
  report: ReportRow;
  student: AbcStudentPanel | null;
  teacher: Teacher | null;
  hideStudent: boolean;
}) {
  const behaviors = report.behaviors ?? [];
  const presentPeople = report.presentPeople ?? [];
  const reasons = report.reasons ?? [];
  const dateObj = parseISO(report.reportDate);

  const teacherName = teacher
    ? `${teacher.firstName} ${teacher.lastName}`
    : report.otherTeacherName ?? 'Desconocido';

  // Solo renderiza los campos de texto libre con contenido
  const freeTexts = [
    { label: 'Producido con', value: report.involvedWith },
    { label: 'A · Antecedentes', value: report.antecedents },
    { label: 'C · Consecuencias', value: report.consequences },
    { label: 'Acciones de reconducción', value: report.redirectActions },
    { label: 'Comentarios', value: report.comments },
    { label: 'Personas presentes (nombres)', value: report.presentNames },
    { label: 'Contexto especificado', value: report.contextNote },
    { label: 'Hipótesis · otro', value: report.reasonOther },
  ].filter((f) => f.value && String(f.value).trim().length > 0);

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      {/* Header del registro */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 capitalize">
            {format(dateObj, "EEE d 'de' MMM yyyy", { locale: es })}
          </span>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
            {!hideStudent && student && <>{student.siglas} · </>}
            {teacherName}
            {teacher && <span className="text-zinc-300 dark:text-zinc-600 ml-1">({STAGE_LABELS[teacher.stage as StageValue] ?? teacher.stage})</span>}
          </span>
        </div>
        <div className="flex-1" />
        <Link
          href={`/admin/registros/${report.id}`}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
        >
          Ver completo
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      <div className="p-4 space-y-3 text-sm">
        {/* Conductas como pills destacadas */}
        <div className="flex flex-wrap gap-1.5">
          {behaviors.map((b) => (
            <span
              key={b}
              className="text-xs font-medium px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50"
            >
              {label(BEHAVIORS, b)}
            </span>
          ))}
        </div>

        {/* Línea de contexto · franja · presentes */}
        <div className="text-xs text-zinc-500 dark:text-zinc-400 flex flex-wrap gap-x-3 gap-y-1">
          <span><strong className="text-zinc-700 dark:text-zinc-300">{label(CONTEXTS, report.context)}</strong></span>
          <span>{label(TIME_SLOTS, report.timeSlot)}</span>
          {presentPeople.length > 0 && (
            <span>
              Presentes: {presentPeople.map((p) => label(PRESENT_PEOPLE, p)).join(', ')}
            </span>
          )}
        </div>

        {/* Hipótesis como pills (si las hay) */}
        {reasons.length > 0 && (
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[10px] uppercase tracking-widest text-zinc-400 dark:text-zinc-500 font-medium">
              Por qué:
            </span>
            {reasons.map((r) => (
              <span
                key={r}
                className="text-[11px] px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/60"
              >
                {label(REASONS, r)}
              </span>
            ))}
          </div>
        )}

        {/* Efectividad si existe */}
        {report.effectivenessRating != null && (
          <div className="text-xs text-zinc-500">
            <span className="text-[10px] uppercase tracking-widest text-zinc-400 dark:text-zinc-500 font-medium mr-2">
              Efectividad:
            </span>
            <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300">
              {parseFloat(report.effectivenessRating).toFixed(1)} / 5.0
            </span>
          </div>
        )}

        {/* Textos libres — TODOS los que tengan contenido */}
        {freeTexts.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            {freeTexts.map((f) => (
              <div key={f.label}>
                <p className="text-[10px] uppercase tracking-widest text-zinc-400 dark:text-zinc-500 font-medium mb-0.5">
                  {f.label}
                </p>
                <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                  {f.value}
                </p>
              </div>
            ))}
          </div>
        )}

        {freeTexts.length === 0 && (
          <p className="text-[11px] text-zinc-400 dark:text-zinc-600 italic pt-1 border-t border-zinc-100 dark:border-zinc-800">
            Sin textos libres registrados en este parte.
          </p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function KpiCard({ label, value, hint, accent, valueClass }: {
  label: string; value: string | number; hint?: string; accent?: boolean; valueClass?: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${
      accent
        ? 'bg-gradient-to-br from-teal-500 to-cyan-600 text-white border-transparent'
        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
    }`}>
      <p className={`text-[10px] font-bold uppercase tracking-widest ${accent ? 'text-teal-100/80' : 'text-zinc-400 dark:text-zinc-500'}`}>
        {label}
      </p>
      <p className={`text-3xl font-bold tabular-nums mt-1.5 ${accent ? 'text-white' : valueClass ?? 'text-zinc-900 dark:text-zinc-100'}`}>
        {value}
      </p>
      {hint && (
        <p className={`text-[10px] mt-1 ${accent ? 'text-teal-100/80' : 'text-zinc-400 dark:text-zinc-500'}`}>
          {hint}
        </p>
      )}
    </div>
  );
}

function Card({ title, icon, children, className = '' }: {
  title: string; icon?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 ${className}`}>
      <div className="flex items-center gap-1.5 mb-3">
        {icon}
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function ProgressBar({ label, count, max, color }: {
  label: string; count: number; max: number; color: 'rose' | 'teal' | 'zinc';
}) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  const colors = {
    rose: 'bg-rose-500 dark:bg-rose-600',
    teal: 'bg-teal-500 dark:bg-teal-600',
    zinc: 'bg-zinc-400 dark:bg-zinc-500',
  };
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-zinc-700 dark:text-zinc-300 w-32 sm:w-40 truncate shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${colors[color]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums w-8 text-right">
        {count}
      </span>
    </div>
  );
}

function Heatmap({ data, max }: { data: { day: number; slot: string; count: number }[]; max: number }) {
  const days = [1, 2, 3, 4, 5];

  function intensityClass(c: number): string {
    if (c === 0) return 'bg-zinc-50 dark:bg-zinc-800/50 text-zinc-300 dark:text-zinc-600';
    const r = c / max;
    if (r < 0.2) return 'bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400';
    if (r < 0.4) return 'bg-teal-200 dark:bg-teal-900/70 text-teal-800 dark:text-teal-300';
    if (r < 0.6) return 'bg-teal-300 dark:bg-teal-800 text-teal-900 dark:text-teal-100';
    if (r < 0.8) return 'bg-teal-400 dark:bg-teal-700 text-white';
    return 'bg-teal-600 dark:bg-teal-500 text-white';
  }

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="text-xs w-full min-w-[480px]">
        <thead>
          <tr>
            <th className="w-12"></th>
            {TIME_SLOTS.map((s) => (
              <th key={s.value} className="font-medium text-[10px] text-zinc-400 dark:text-zinc-500 px-1 pb-1.5 text-center">
                {s.label.split(' ').slice(0, 2).join(' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d}>
              <td className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 pr-2 text-right">
                {WEEKDAY_NAMES[d]}
              </td>
              {TIME_SLOTS.map((s) => {
                const cell = data.find((x) => x.day === d && x.slot === s.value);
                const count = cell?.count ?? 0;
                return (
                  <td key={s.value} className="p-0.5">
                    <div
                      className={`rounded-md h-9 flex items-center justify-center text-[11px] font-semibold tabular-nums ${intensityClass(count)}`}
                      title={`${WEEKDAY_NAMES[d]} · ${s.label}: ${count}`}
                    >
                      {count > 0 ? count : ''}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-1.5 mt-2 text-[10px] text-zinc-400 dark:text-zinc-500 justify-end">
        <span>Menos</span>
        <span className="w-3 h-3 rounded-sm bg-zinc-100 dark:bg-zinc-800" />
        <span className="w-3 h-3 rounded-sm bg-teal-100 dark:bg-teal-900/60" />
        <span className="w-3 h-3 rounded-sm bg-teal-300 dark:bg-teal-800" />
        <span className="w-3 h-3 rounded-sm bg-teal-500 dark:bg-teal-600" />
        <span className="w-3 h-3 rounded-sm bg-teal-700 dark:bg-teal-500" />
        <span>Más</span>
      </div>
    </div>
  );
}

function EmptyHint() {
  return <p className="text-xs text-zinc-400 dark:text-zinc-500 italic text-center py-6">Sin datos suficientes</p>;
}
