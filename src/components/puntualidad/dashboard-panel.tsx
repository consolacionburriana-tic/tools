'use client';

// Dashboard del módulo. Mismo lenguaje que el informe del ABC (recharts, tarjetas, rankings)
// porque es el que David ya lee bien, con el acento naranja de Puntualidad.
//
// Las preguntas que tiene que contestar de un vistazo: ¿va a peor esta semana?, ¿qué día de
// la semana se acumulan?, ¿en qué asignatura y en qué clase?, y ¿quiénes son los de siempre?
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, CalendarDays, Clock, Users } from 'lucide-react';
import type { DashboardPuntualidad } from '@/lib/puntualidad-server';
import { ClaseChip } from './ui';

const NARANJA = '#ea580c';
const NARANJA_CLARO = '#fdba74';

function Kpi({
  icono,
  etiqueta,
  valor,
  sub,
  href,
}: {
  icono: React.ReactNode;
  etiqueta: string;
  valor: string | number;
  sub?: string;
  href?: string;
}) {
  const cuerpo = (
    <div
      className={`h-full space-y-2 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 ${
        href ? 'transition-colors hover:border-orange-300 hover:bg-orange-50/40 dark:hover:border-orange-800 dark:hover:bg-orange-500/5' : ''
      }`}
    >
      <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500">
        {icono}
        <span className="text-xs font-medium">{etiqueta}</span>
      </div>
      <p className="text-3xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{valor}</p>
      {sub && <p className="text-xs text-zinc-400">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{cuerpo}</Link> : cuerpo;
}

function Panel({ titulo, children, vacio }: { titulo: string; children: React.ReactNode; vacio?: boolean }) {
  return (
    <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{titulo}</h2>
      {vacio ? <p className="py-6 text-center text-sm text-zinc-400">Sin datos en este periodo.</p> : children}
    </div>
  );
}

function Ranking({ filas, total }: { filas: { nombre: string; valor: number }[]; total: number }) {
  return (
    <ul className="space-y-2">
      {filas.slice(0, 8).map((f) => (
        <li key={f.nombre} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate text-zinc-700 dark:text-zinc-200">{f.nombre}</span>
            <span className="shrink-0 tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">{f.valor}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-orange-400"
              style={{ width: `${Math.round((f.valor / Math.max(1, total)) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Tooltip propio: el de recharts trae fondo blanco fijo y en modo oscuro deslumbra.
 * Con esto hereda el tema como cualquier otra tarjeta del panel.
 */
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
    <div className="rounded-xl border border-zinc-200 bg-white/95 px-2.5 py-1.5 text-xs shadow-lg backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95">
      {label !== undefined && <p className="font-medium text-zinc-500 dark:text-zinc-400">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
          {p.value} {p.name?.toLowerCase()}
        </p>
      ))}
    </div>
  );
}

const EJE = { fontSize: 11, fill: '#a1a1aa' } as const;

export function DashboardPanel({ datos, rangoActivo }: { datos: DashboardPuntualidad; rangoActivo: string }) {
  const rangos = [
    { clave: '7', label: '7 días' },
    { clave: '30', label: '30 días' },
    { clave: '90', label: '90 días' },
    { clave: 'curso', label: 'Todo el curso' },
  ];

  const tendencia = datos.porFecha.map((d) => ({
    fecha: format(parseISO(d.fecha), 'd MMM', { locale: es }),
    total: d.total,
  }));
  const maxDia = Math.max(1, ...datos.porDiaSemana.map((d) => d.total));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Puntualidad</h1>
        <div className="flex flex-wrap gap-1.5">
          {rangos.map((r) => (
            <Link
              key={r.clave}
              href={`/gestion/puntualidad?rango=${r.clave}`}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                rangoActivo === r.clave
                  ? 'bg-orange-500 text-white'
                  : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      {datos.total === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
            Ni un retraso en este periodo 🎉
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
            En cuanto se registre el primero, aquí saldrán la tendencia, los días de la semana con más retrasos, las
            asignaturas y quién acumula. Prueba a ampliar el periodo si buscas algo más antiguo.
          </p>
          <Link
            href="/puntualidad"
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
          >
            Registrar un retraso
          </Link>
        </div>
      ) : (
      <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi
          icono={<Clock className="h-4 w-4" />}
          etiqueta="Retrasos"
          valor={datos.total}
          sub={`${datos.noJustificados} sin justificar · ${datos.justificados} justificados`}
        />
        <Kpi
          icono={<Users className="h-4 w-4" />}
          etiqueta="Alumnos distintos"
          valor={datos.alumnosDistintos}
          sub={datos.total > 0 ? `${(datos.total / Math.max(1, datos.alumnosDistintos)).toFixed(1)} de media` : undefined}
        />
        <Kpi
          icono={<CalendarDays className="h-4 w-4" />}
          etiqueta="Retraso medio"
          valor={`${datos.minutosMedios} min`}
          sub="sobre la hora límite (08:05)"
        />
        <Kpi
          icono={<AlertTriangle className="h-4 w-4" />}
          etiqueta="Consecuencias sin fecha"
          valor={datos.consecuenciasPendientes}
          sub="esperando que el tutor ponga el día"
          href="/gestion/puntualidad/consecuencias"
        />
      </div>

      <Panel titulo={`Tendencia · ${datos.rango.dias} días`} vacio={tendencia.length === 0}>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={tendencia} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="gradPuntualidad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={NARANJA} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={NARANJA} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#a1a1aa" strokeOpacity={0.25} vertical={false} />
              <XAxis dataKey="fecha" tick={EJE} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={EJE} tickLine={false} axisLine={false} />
              <Tooltip content={<TooltipCard />} cursor={{ fill: '#a1a1aa', fillOpacity: 0.08 }} />
              <Area type="monotone" dataKey="total" name="Retrasos" stroke={NARANJA} strokeWidth={2} fill="url(#gradPuntualidad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel titulo="Por día de la semana" vacio={datos.total === 0}>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datos.porDiaSemana} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#a1a1aa" strokeOpacity={0.25} vertical={false} />
                <XAxis dataKey="dia" tick={EJE} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={EJE} tickLine={false} axisLine={false} />
                <Tooltip content={<TooltipCard />} cursor={{ fill: '#a1a1aa', fillOpacity: 0.08 }} />
                <Bar dataKey="total" name="Retrasos" radius={[6, 6, 0, 0]}>
                  {datos.porDiaSemana.map((d) => (
                    <Cell key={d.dia} fill={d.total === maxDia ? NARANJA : NARANJA_CLARO} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel titulo="Hora de llegada" vacio={datos.porHora.length === 0}>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datos.porHora} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#a1a1aa" strokeOpacity={0.25} vertical={false} />
                <XAxis dataKey="hora" tick={{ ...EJE, fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={EJE} tickLine={false} axisLine={false} />
                <Tooltip content={<TooltipCard />} cursor={{ fill: '#a1a1aa', fillOpacity: 0.08 }} />
                <Bar dataKey="total" name="Retrasos" fill={NARANJA} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel titulo="Asignaturas con más retrasos" vacio={datos.porAsignatura.length === 0}>
          <Ranking
            filas={datos.porAsignatura.map((a) => ({ nombre: a.asignatura, valor: a.total }))}
            total={datos.porAsignatura[0]?.total ?? 1}
          />
        </Panel>

        <Panel titulo="Clases con más retrasos" vacio={datos.porClase.length === 0}>
          <Ranking
            filas={datos.porClase.map((c) => ({ nombre: c.clase, valor: c.total }))}
            total={datos.porClase[0]?.total ?? 1}
          />
        </Panel>

        <Panel titulo="Quién registra" vacio={datos.porProfe.length === 0}>
          <Ranking
            filas={datos.porProfe.map((p) => ({ nombre: p.profe, valor: p.total }))}
            total={datos.porProfe[0]?.total ?? 1}
          />
        </Panel>

        <Panel titulo="Los que más acumulan" vacio={datos.reincidentes.length === 0}>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {datos.reincidentes.map((a) => (
              <li key={a.eduStudentId}>
                <Link
                  href={`/gestion/puntualidad/alumno/${a.eduStudentId}`}
                  className="flex items-center gap-2 py-2 text-sm transition-colors hover:text-orange-600"
                >
                  <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-200">{a.alumno}</span>
                  <ClaseChip clase={a.clase} />
                  <span className="w-8 shrink-0 text-right tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">
                    {a.total}
                  </span>
                  <span className="w-16 shrink-0 text-right text-xs text-zinc-400">
                    {a.noJustificados} s/j
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      </>
      )}
    </div>
  );
}
