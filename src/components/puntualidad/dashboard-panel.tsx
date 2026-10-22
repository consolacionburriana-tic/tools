'use client';

// Panel del módulo. Mismo lenguaje que el informe del ABC (recharts, tarjetas, rankings)
// porque es el que David ya lee bien, con la paleta de datos común.
//
// Las preguntas que tiene que contestar de un vistazo: ¿va a peor esta semana?, ¿qué día de
// la semana se acumulan?, ¿en qué asignatura y en qué clase?, y ¿quiénes son los de siempre?
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { AlertTriangle, CalendarDays, CalendarOff, Clock, Plus, Settings2, Users } from 'lucide-react';
import type { DashboardPuntualidad } from '@/lib/puntualidad-server';
import { CONFIGURACION } from '@/lib/configuracion';
import { buttonVariants } from '@/components/ui/button';
import { Cifra, Cifras } from '@/components/ui/cifra';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Tarjeta, TarjetaCabecera, TarjetaCuerpo } from '@/components/ui/tarjeta';
import { Vacio } from '@/components/ui/vacio';

// Paleta de datos común (globals.css): una sola serie, así que el primer color; el resto de
// barras del gráfico por día, el mismo tono más suave para que destaque el día peor.
const SERIE = 'var(--datos-1)';
const SERIE_SUAVE = 'color-mix(in oklab, var(--datos-1) 45%, transparent)';
const REJILLA = '#a1a1aa';

function Panel({ titulo, children, vacio }: { titulo: string; children: React.ReactNode; vacio?: boolean }) {
  return (
    <Tarjeta as="section">
      <TarjetaCabecera titulo={titulo} />
      <TarjetaCuerpo>
        {vacio ? <p className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">Sin datos en este periodo.</p> : children}
      </TarjetaCuerpo>
    </Tarjeta>
  );
}

function Ranking({ filas, total }: { filas: { nombre: string; valor: number }[]; total: number }) {
  return (
    <ul className="space-y-2.5">
      {filas.slice(0, 8).map((f) => (
        <li key={f.nombre} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate text-zinc-700 dark:text-zinc-200">{f.nombre}</span>
            <span className="shrink-0 font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">{f.valor}</span>
          </div>
          <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.round((f.valor / Math.max(1, total)) * 100)}%`, background: SERIE }}
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
    <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      {label !== undefined && <p className="font-medium text-zinc-600 dark:text-zinc-400">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">
          {p.value} {p.name?.toLowerCase()}
        </p>
      ))}
    </div>
  );
}

const EJE = { fontSize: 12, fill: '#71717a' } as const;
const CURSOR = { fill: '#a1a1aa', fillOpacity: 0.12 } as const;

export function DashboardPanel({
  datos,
  rangoActivo,
  puedeAjustar = false,
}: {
  datos: DashboardPuntualidad;
  rangoActivo: string;
  /** Quien ve todo el centro lleva también las asignaturas (los ajustes del módulo). */
  puedeAjustar?: boolean;
}) {
  const router = useRouter();
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
    <div className="space-y-5">
      <h1 className="sr-only">Panel de Puntualidad</h1>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Filtros etiqueta="Periodo">
          {rangos.map((r) => (
            <Filtro
              key={r.clave}
              activo={rangoActivo === r.clave}
              onClick={() => router.push(`/gestion/puntualidad?rango=${r.clave}`)}
            >
              {r.label}
            </Filtro>
          ))}
        </Filtros>
        {puedeAjustar && (
          <Link
            href="/gestion/puntualidad/asignaturas"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <Settings2 aria-hidden /> Asignaturas
          </Link>
        )}
      </div>

      {datos.total === 0 ? (
        <Vacio
          icono={<CalendarOff />}
          titulo="Ni un retraso en este periodo"
          accion={
            <Link href="/puntualidad" className={buttonVariants()}>
              <Plus aria-hidden /> Registrar un retraso
            </Link>
          }
        >
          En cuanto se registre el primero, aquí saldrán la tendencia, los días de la semana con más retrasos, las
          asignaturas y quién acumula. Prueba a ampliar el periodo si buscas algo más antiguo.
        </Vacio>
      ) : (
      <>
      <Cifras>
        <Cifra
          icono={<Clock />}
          etiqueta="Retrasos"
          valor={datos.total}
          nota={`${datos.noJustificados} sin justificar · ${datos.justificados} justificados`}
        />
        <Cifra
          icono={<Users />}
          etiqueta="Alumnos distintos"
          valor={datos.alumnosDistintos}
          nota={datos.total > 0 ? `${(datos.total / Math.max(1, datos.alumnosDistintos)).toFixed(1)} de media` : undefined}
        />
        <Cifra
          icono={<CalendarDays />}
          etiqueta="Retraso medio"
          valor={`${datos.minutosMedios} min`}
          nota={`sobre la hora límite (${CONFIGURACION.puntualidad.horaLimite})`}
        />
        <Cifra
          icono={<AlertTriangle />}
          etiqueta="Consecuencias sin fecha"
          valor={datos.consecuenciasPendientes}
          tono={datos.consecuenciasPendientes > 0 ? 'aviso' : undefined}
          nota="esperando que el tutor ponga el día"
          href="/gestion/puntualidad/consecuencias"
        />
      </Cifras>

      <Panel titulo={`Tendencia · ${datos.rango.dias} días`} vacio={tendencia.length === 0}>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={tendencia} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="gradPuntualidad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SERIE} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={SERIE} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={REJILLA} strokeOpacity={0.25} vertical={false} />
              <XAxis dataKey="fecha" tick={EJE} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={EJE} tickLine={false} axisLine={false} />
              <Tooltip content={<TooltipCard />} cursor={CURSOR} />
              <Area type="monotone" dataKey="total" name="Retrasos" stroke={SERIE} strokeWidth={2} fill="url(#gradPuntualidad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel titulo="Por día de la semana" vacio={datos.total === 0}>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datos.porDiaSemana} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={REJILLA} strokeOpacity={0.25} vertical={false} />
                <XAxis dataKey="dia" tick={EJE} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={EJE} tickLine={false} axisLine={false} />
                <Tooltip content={<TooltipCard />} cursor={CURSOR} />
                <Bar dataKey="total" name="Retrasos" radius={[6, 6, 0, 0]}>
                  {datos.porDiaSemana.map((d) => (
                    <Cell key={d.dia} fill={d.total === maxDia ? SERIE : SERIE_SUAVE} />
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
                <CartesianGrid strokeDasharray="3 3" stroke={REJILLA} strokeOpacity={0.25} vertical={false} />
                <XAxis dataKey="hora" tick={EJE} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={EJE} tickLine={false} axisLine={false} />
                <Tooltip content={<TooltipCard />} cursor={CURSOR} />
                <Bar dataKey="total" name="Retrasos" fill={SERIE} radius={[4, 4, 0, 0]} />
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
                  className="-mx-2 flex min-h-11 items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors outline-none hover:bg-zinc-50 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-zinc-800/60"
                >
                  <span className="min-w-0 flex-1 truncate text-zinc-800 dark:text-zinc-200">{a.alumno}</span>
                  <Etiqueta>{a.clase}</Etiqueta>
                  <span className="w-8 shrink-0 text-right font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">
                    {a.total}
                  </span>
                  <span className="w-24 shrink-0 text-right text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
                    {a.noJustificados} sin justificar
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
