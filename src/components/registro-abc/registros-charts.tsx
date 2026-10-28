'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { format, parseISO, eachDayOfInterval, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid,
} from 'recharts';
import { Calendar as CalendarIcon, AlertTriangle, TrendingUp, FileText, ChevronRight } from 'lucide-react';
import { buttonVariants, Button } from '@/components/ui/button';
import { Cifra, Cifras } from '@/components/ui/cifra';
import { Etiqueta } from '@/components/ui/etiqueta';
import { SkeletonCard, Skeleton } from '@/components/ui/skeleton';
import { Tarjeta, TarjetaCabecera, TarjetaCuerpo } from '@/components/ui/tarjeta';
import { Vacio } from '@/components/ui/vacio';
import { BEHAVIORS, REASONS, TIME_SLOTS, CONTEXTS, PRESENT_PEOPLE, STAGE_LABELS, type StageValue } from '@/lib/constants';
import type { Teacher } from '@/db/schema';
import type { AbcStudentPanel } from '@/lib/abc-server';
import { getDateRange, label, TIME_PRESETS, type ReportRow } from '@/app/gestion/abc/registros/page';

// Paleta de datos común (globals.css, docs/diseno.md): categórica en orden fijo y ordinal de
// un solo tono (los pasos intermedios salen por color-mix). Una sola serie → el primer color.
const SERIE = 'var(--datos-1)';
const CATEGORIAS = ['var(--datos-1)', 'var(--datos-2)', 'var(--datos-3)', '#a1a1aa'];
const REJILLA = '#a1a1aa';
const EJE = { fontSize: 12, fill: '#71717a' } as const;
const CURSOR = { fill: '#a1a1aa', fillOpacity: 0.12 } as const;
/** Un paso de la escala ordinal (0 = poco, 1 = mucho). */
const ordinal = (t: number) =>
  `color-mix(in oklab, var(--datos-ord-hi) ${Math.round(Math.max(0, Math.min(1, t)) * 100)}%, var(--datos-ord-lo))`;

/** Tooltip propio: el de recharts trae fondo blanco fijo y en modo oscuro deslumbra. */
function TooltipCard({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value?: number | string; name?: string }[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      {label !== undefined && <p className="font-medium text-zinc-600 dark:text-zinc-400">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">
          {p.name && p.name !== 'count' && p.name !== 'value' ? `${p.name}: ` : ''}
          {p.value}
        </p>
      ))}
    </div>
  );
}
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
    return (
      <div role="status" aria-busy="true" className="grid gap-4 lg:grid-cols-2">
        <span className="sr-only">Cargando datos…</span>
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i}>
            <Skeleton className="h-4 w-36" />
            <Skeleton className="mt-4 h-44 w-full rounded-xl" />
          </SkeletonCard>
        ))}
      </div>
    );
  }
  if (!stats) {
    return <Vacio titulo="Sin datos para estos filtros." />;
  }

  const displayedReports = showAllRecords ? reports : reports.slice(0, 20);

  return (
    <div className="space-y-4">
      {/* ── Perfil del alumno (cuando hay UNO seleccionado) ────────────── */}
      {focusedStudent && (
        <div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Informe individual</p>
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{focusedStudent.siglas}</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {focusedStudent.clase} · {TIME_PRESETS.find((p) => p.value === timePreset)?.label}
          </p>
        </div>
      )}

      {/* ── Cifras adaptativas ─────────────────────────────────────────── */}
      <Cifras>
        <Cifra etiqueta="Registros" valor={stats.total} nota="en el período" />
        {focusedStudent ? (
          <Cifra
            etiqueta="Último registro"
            valor={stats.lastDate ? format(parseISO(stats.lastDate), 'd MMM', { locale: es }) : '—'}
            nota={stats.lastDate ? format(parseISO(stats.lastDate), 'EEEE', { locale: es }) : undefined}
          />
        ) : (
          <Cifra etiqueta="Alumnos" valor={stats.uniqueStudents} nota="con registros" />
        )}
        <Cifra etiqueta="Profesores" valor={stats.uniqueTeachers} nota="que registran" />
        <Cifra
          etiqueta="Conducta más frecuente"
          valor={stats.topBehavior?.count || 0}
          nota={stats.topBehavior?.label}
        />
      </Cifras>

      {/* Tendencia */}
      <Card title="Tendencia" icon={<TrendingUp />}>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={stats.trendData} margin={{ top: 8, right: 8, left: -28, bottom: 0 }}>
            <defs>
              <linearGradient id="gradAbc" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIE} stopOpacity={0.35} />
                <stop offset="100%" stopColor={SERIE} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={REJILLA} strokeOpacity={0.25} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={EJE} axisLine={false} tickLine={false} />
            <YAxis tick={EJE} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<TooltipCard />} cursor={CURSOR} />
            <Area type="monotone" dataKey="count" name="Registros" stroke={SERIE} strokeWidth={2} fill="url(#gradAbc)" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Heatmap */}
      <Card title="Patrones · Día × franja horaria" icon={<CalendarIcon />}>
        <Heatmap data={stats.heatmap} max={stats.heatmapMax} />
      </Card>

      {/* Conductas + Contexto */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Conductas más frecuentes" icon={<AlertTriangle />} className="lg:col-span-2">
          <div className="space-y-2">
            {stats.behaviorRanking.map((b) => (
              <ProgressBar key={b.name} label={b.name} count={b.count} max={stats.maxBehavior} />
            ))}
          </div>
        </Card>

        <Card title="Contexto">
          {stats.contextData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={stats.contextData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={70} paddingAngle={2}>
                  {stats.contextData.map((_, i) => <Cell key={i} fill={CATEGORIAS[i % CATEGORIAS.length]} />)}
                </Pie>
                <Tooltip content={<TooltipCard />} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyHint />}
          <div className="flex flex-wrap gap-2 mt-2 justify-center">
            {stats.contextData.map((c, i) => (
              <div key={c.name} className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                <span aria-hidden className="size-2.5 rounded-full" style={{ background: CATEGORIAS[i % CATEGORIAS.length] }} />
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
              return <ProgressBar key={r.name} label={r.name} count={r.count} max={maxReason} />;
            })}
          </div>
        ) : <EmptyHint />}
      </Card>

      {/* Día semana + Franja horaria */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Por día de la semana">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stats.weekdayData} margin={{ top: 8, right: 8, left: -28, bottom: 0 }}>
              <CartesianGrid stroke={REJILLA} strokeOpacity={0.25} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={EJE} axisLine={false} tickLine={false} />
              <YAxis tick={EJE} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<TooltipCard />} cursor={CURSOR} />
              <Bar dataKey="count" name="Registros" fill={SERIE} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Por franja horaria">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stats.slotData} margin={{ top: 8, right: 8, left: -28, bottom: 24 }}>
              <CartesianGrid stroke={REJILLA} strokeOpacity={0.25} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={EJE} axisLine={false} tickLine={false} angle={-20} textAnchor="end" height={50} interval={0} />
              <YAxis tick={EJE} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<TooltipCard />} cursor={CURSOR} />
              <Bar dataKey="count" name="Registros" fill={SERIE} radius={[6, 6, 0, 0]} />
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
              />
            ))}
          </div>
        ) : <EmptyHint />}
      </Card>

      {/* ── Efectividad · indicador subjetivo (de tono bajado) ──────────── */}
      {stats.effValsCount > 0 && (
        <Card
          title="Efectividad de reconducción"
          descripcion={`Indicador subjetivo y opcional · ${stats.effValsCount} de ${stats.total} valoraron`}
        >
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <p className="font-mono text-2xl leading-none font-bold text-zinc-700 tabular-nums dark:text-zinc-300">
                {stats.avgEff?.toFixed(1)}
                <span className="ml-1 text-sm text-zinc-500 dark:text-zinc-400">/ 5.0</span>
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">media</p>
            </div>
            <div className="min-w-[240px] flex-1">
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={stats.effBuckets} margin={{ top: 4, right: 0, left: -36, bottom: 0 }}>
                  <XAxis dataKey="label" tick={EJE} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip content={<TooltipCard />} cursor={CURSOR} />
                  <Bar dataKey="count" name="Registros" radius={[4, 4, 0, 0]}>
                    {stats.effBuckets.map((_, i) => (
                      <Cell key={i} fill={ordinal(i / (stats.effBuckets.length - 1))} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      )}

      {/* ── Detalle de cada registro · TODA la info ──────────────────────── */}
      <Card
        title={`Detalle de cada registro · ${reports.length} ${reports.length === 1 ? 'entrada' : 'entradas'}`}
        icon={<FileText />}
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
            <Button variant="outline" className="w-full" onClick={() => setShowAllRecords(!showAllRecords)}>
              {showAllRecords
                ? `Mostrar solo los 20 más recientes`
                : `Mostrar los ${reports.length - 20} registros restantes`}
            </Button>
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
    { label: 'Situación problemática', value: report.situationDescription },
    { label: 'A · Antecedentes', value: report.antecedents },
    { label: 'C · Consecuencias aplicadas al alumno/a por su conducta', value: report.consequences },
    { label: 'Acciones de reconducción', value: report.redirectActions },
    { label: 'Comentarios', value: report.comments },
    { label: 'Personas presentes (nombres)', value: report.presentNames },
    { label: 'Contexto especificado', value: report.contextNote },
    { label: 'Hipótesis · otro', value: report.reasonOther },
  ].filter((f) => f.value && String(f.value).trim().length > 0);

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {/* Cabecera del registro */}
      <div className="flex items-center gap-3 border-b border-zinc-100 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 capitalize">
            {format(dateObj, "EEE d 'de' MMM yyyy", { locale: es })}
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {!hideStudent && student && <>{student.siglas} · </>}
            {teacherName}
            {teacher && <span className="ml-1">({STAGE_LABELS[teacher.stage as StageValue] ?? teacher.stage})</span>}
          </span>
        </div>
        <div className="flex-1" />
        <Link
          href={`/gestion/abc/registros/${report.id}`}
          className={buttonVariants({ variant: 'ghost', size: 'sm', className: '-mr-2' })}
        >
          Ver completo
          <ChevronRight aria-hidden />
        </Link>
      </div>

      <div className="p-4 space-y-3 text-sm">
        {/* Conductas como pills destacadas */}
        <div className="flex flex-wrap gap-1.5">
          {behaviors.map((b) => (
            <Etiqueta key={b}>{label(BEHAVIORS, b)}</Etiqueta>
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
            <span className="text-xs font-medium tracking-wider text-zinc-500 uppercase dark:text-zinc-400">Por qué:</span>
            {reasons.map((r) => (
              <Etiqueta key={r}>{label(REASONS, r)}</Etiqueta>
            ))}
          </div>
        )}

        {/* Efectividad si existe */}
        {report.effectivenessRating != null && (
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            <span className="mr-2 text-xs font-medium tracking-wider uppercase">
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
                <p className="mb-0.5 text-xs font-medium tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
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
          <p className="border-t border-zinc-100 pt-1 text-xs text-zinc-500 italic dark:border-zinc-800 dark:text-zinc-400">
            Sin textos libres registrados en este parte.
          </p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function Card({ title, descripcion, icon, children, className }: {
  title: string; descripcion?: string; icon?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <Tarjeta as="section" className={className}>
      <TarjetaCabecera titulo={title} descripcion={descripcion} icono={icon} />
      <TarjetaCuerpo>{children}</TarjetaCuerpo>
    </Tarjeta>
  );
}

function ProgressBar({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 truncate text-sm text-zinc-700 sm:w-40 dark:text-zinc-300">{label}</span>
      <div aria-hidden className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: SERIE }} />
      </div>
      <span className="w-8 text-right font-mono text-xs font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">
        {count}
      </span>
    </div>
  );
}

function Heatmap({ data, max }: { data: { day: number; slot: string; count: number }[]; max: number }) {
  const days = [1, 2, 3, 4, 5];

  // Escala ordinal de la paleta de datos. El texto, claro u oscuro según el extremo: en
  // claro la rampa oscurece hacia «mucho», en oscuro aclara.
  function celda(c: number): { className: string; style?: React.CSSProperties } {
    if (c === 0) return { className: 'bg-zinc-50 dark:bg-zinc-800/50' };
    const r = c / max;
    return {
      className: r >= 0.5 ? 'text-white dark:text-zinc-900' : 'text-zinc-900 dark:text-white',
      style: { background: ordinal(r) },
    };
  }

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="text-xs w-full min-w-[480px]">
        <thead>
          <tr>
            <th className="w-12"></th>
            {TIME_SLOTS.map((s) => (
              <th key={s.value} className="px-1 pb-1.5 text-center text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {s.label.split(' ').slice(0, 2).join(' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d}>
              <td className="pr-2 text-right text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                {WEEKDAY_NAMES[d]}
              </td>
              {TIME_SLOTS.map((s) => {
                const cell = data.find((x) => x.day === d && x.slot === s.value);
                const count = cell?.count ?? 0;
                const estilo = celda(count);
                return (
                  <td key={s.value} className="p-0.5">
                    <div
                      className={`flex h-9 items-center justify-center rounded-md text-xs font-semibold tabular-nums ${estilo.className}`}
                      style={estilo.style}
                      aria-label={`${WEEKDAY_NAMES[d]} · ${s.label}: ${count}`}
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
      <div className="mt-2 flex items-center justify-end gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
        <span>Menos</span>
        <span aria-hidden className="size-3 rounded-sm bg-zinc-100 dark:bg-zinc-800" />
        {[0.1, 0.4, 0.7, 1].map((t) => (
          <span key={t} aria-hidden className="size-3 rounded-sm" style={{ background: ordinal(t) }} />
        ))}
        <span>Más</span>
      </div>
    </div>
  );
}

function EmptyHint() {
  return <p className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">Sin datos suficientes</p>;
}
