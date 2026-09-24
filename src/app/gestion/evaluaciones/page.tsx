export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { BarChart3, CalendarRange, ChevronRight, Link2, Plus, Send, Users } from 'lucide-react';
import { academicYearActual } from '@/lib/constants';
import { AUDIENCIAS, COLOR_AUDIENCIA, opcionesAcademicYear, type Audiencia } from '@/lib/evaluaciones';
import { getActividades, getForms, type FormResumen } from '@/lib/evaluaciones-server';
import { NavPending } from '@/components/ui/nav-pending';
import { BTN_SUAVE } from '@/components/evaluaciones/ui';
import { EliminarEvaluacion } from '@/components/evaluaciones/eliminar-evaluacion';

export const metadata = { title: 'Evaluaciones · Gestión' };

const ESTADO_ESTILO: Record<string, string> = {
  borrador: 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300',
  abierto: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  cerrado: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
};

export default async function EvaluacionesPage({ searchParams }: { searchParams: Promise<{ anio?: string }> }) {
  const { anio } = await searchParams;
  const actual = academicYearActual();
  const year = anio ?? actual;
  const [forms, actividades] = await Promise.all([getForms({ academicYear: year }), getActividades({ academicYear: year })]);

  return (
    <div className="anim-stagger space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {opcionesAcademicYear(actual).map((y) => (
            <Link
              key={y}
              href={`/gestion/evaluaciones?anio=${y}`}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                y === year
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
              }`}
            >
              {y}
              {y === actual && <span className="ml-1 text-[10px] opacity-70">actual</span>}
            </Link>
          ))}
        </div>
        <Link href="/gestion/evaluaciones/actividades" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          Ver actividades ({actividades.length}) →
        </Link>
      </div>

      {forms.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">Todavía no hay evaluaciones de {year}.</p>
          <Link
            href="/gestion/evaluaciones/nueva"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> Crear la primera
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {agrupar(forms).map((g) =>
            g.length === 1 ? (
              <TarjetaForm key={g[0].id} f={g[0]} />
            ) : (
              <TarjetaConjunta key={g[0].grupoId} forms={g} />
            ),
          )}
        </div>
      )}

      <Link
        href="/gestion/evaluaciones/comparar"
        className="flex items-center gap-3 rounded-2xl bg-white p-4 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.03)] ring-1 ring-zinc-200/70 transition-shadow duration-150 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:bg-zinc-900 dark:ring-zinc-800"
      >
        <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <span className="flex-1">
          <span className="block font-medium text-zinc-900 dark:text-zinc-100">Comparar</span>
          <span className="block text-xs text-zinc-500">
            La misma actividad entre cursos, y visión del alumnado frente a la del profesorado
          </span>
        </span>
        <ChevronRight className="h-5 w-5 text-zinc-400" />
      </Link>
    </div>
  );
}

/**
 * Junta los formularios de una misma evaluación conjunta (mismo `grupoId`) en un solo
 * grupo, en el sitio del más reciente y con sus sectores en orden alumnado → profesorado
 * → familias. Los sueltos quedan como grupos de uno.
 */
function agrupar(forms: FormResumen[]): FormResumen[][] {
  const orden = AUDIENCIAS.map((a) => a.value as string);
  const out: FormResumen[][] = [];
  const porGrupo = new Map<string, FormResumen[]>();
  for (const f of forms) {
    if (!f.grupoId) {
      out.push([f]);
      continue;
    }
    const g = porGrupo.get(f.grupoId);
    if (g) g.push(f);
    else {
      const nuevo = [f];
      porGrupo.set(f.grupoId, nuevo);
      out.push(nuevo);
    }
  }
  for (const g of porGrupo.values()) g.sort((a, b) => orden.indexOf(a.audiencia) - orden.indexOf(b.audiencia));
  return out;
}

/** "Convivencia · Alumnado" → "Convivencia": el título común de la evaluación conjunta. */
function tituloBase(f: FormResumen): string {
  const sufijo = ` · ${AUDIENCIAS.find((a) => a.value === f.audiencia)?.label}`;
  return f.titulo.endsWith(sufijo) ? f.titulo.slice(0, -sufijo.length) : f.titulo;
}

function porcentaje(f: FormResumen): number | null {
  return f.objetivo && f.objetivo > 0 ? Math.round((f.respuestas / f.objetivo) * 100) : null;
}

function Acciones({ f }: { f: FormResumen }) {
  return (
    <div className="ml-auto flex items-center gap-1.5">
      {f.estado !== 'borrador' && (
        <Link href={`/evaluaciones/${f.token}`} target="_blank" className={BTN_SUAVE}>
          <Link2 className="h-3.5 w-3.5" /> Ver enlace
        </Link>
      )}
      <Link href={`/gestion/evaluaciones/${f.id}/enviar`} className={BTN_SUAVE}>
        <Send className="h-3.5 w-3.5" /> Enviar
      </Link>
      <Link
        href={`/gestion/evaluaciones/${f.id}/resultados`}
        className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-300"
      >
        <BarChart3 className="h-3.5 w-3.5" /> Resultados
      </Link>
    </div>
  );
}

function Respuestas({ f }: { f: FormResumen }) {
  const pct = porcentaje(f);
  return (
    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
      {f.respuestas} <span className="text-xs font-normal text-zinc-500">respuestas</span>
      {pct !== null && <span className="ml-1 text-xs font-normal text-zinc-400">de {f.objetivo} ({pct} %)</span>}
    </p>
  );
}

function BarraProgreso({ f, color }: { f: FormResumen; color: string }) {
  const pct = porcentaje(f);
  if (pct === null) return null;
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
      <div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
    </div>
  );
}

const TARJETA_LISTADO =
  'relative overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] ring-1 ring-zinc-200/70 transition-shadow duration-150 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:bg-zinc-900 dark:ring-zinc-800';

function TarjetaForm({ f }: { f: FormResumen }) {
  const audiencia = AUDIENCIAS.find((a) => a.value === f.audiencia);
  return (
    <div className={`${TARJETA_LISTADO} p-4 pl-5`}>
      <span aria-hidden style={{ background: f.color ?? '#2563eb' }} className="absolute inset-y-0 left-0 w-1" />
      <div className="flex items-start justify-between gap-3">
        <Link href={`/gestion/evaluaciones/${f.id}`} className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-100">
            <span>{audiencia?.emoji}</span>
            {f.titulo}
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ESTADO_ESTILO[f.estado] ?? ''}`}>{f.estado}</span>
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-500">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {audiencia?.label}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarRange className="h-3.5 w-3.5" />
              {f.academicYear}
            </span>
            {f.actividades.length > 0 && <span className="truncate">{f.actividades.join(' · ')}</span>}
          </p>
        </Link>
        <NavPending className="mt-1 shrink-0" />
        <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-zinc-400" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Respuestas f={f} />
        <Acciones f={f} />
        <EliminarEvaluacion formId={f.id} nombre={`«${f.titulo}»`} respuestas={f.respuestas} compacto volverA={null} />
      </div>
      <BarraProgreso f={f} color={f.color ?? '#2563eb'} />
    </div>
  );
}

/**
 * Evaluación conjunta: una sola tarjeta con la cabecera común (qué se evalúa) y una fila
 * por sector. Cada fila lleva el color de su colectivo —el mismo de los gráficos— y sus
 * propias acciones, porque cada sector se envía y se mira por separado.
 */
function TarjetaConjunta({ forms }: { forms: FormResumen[] }) {
  const primero = forms[0];
  const total = forms.reduce((n, f) => n + f.respuestas, 0);
  return (
    <div className={TARJETA_LISTADO}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2 px-4 pb-3 pt-4 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-100">
            {tituloBase(primero)}
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              conjunta · {forms.length} sectores
            </span>
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-500">
            <span className="inline-flex items-center gap-1">
              <CalendarRange className="h-3.5 w-3.5" />
              {primero.academicYear}
            </span>
            {primero.actividades.length > 0 && <span className="truncate">{primero.actividades.join(' · ')}</span>}
            <span>{total} respuestas en total</span>
          </p>
        </div>
        <EliminarEvaluacion
          formId={primero.id}
          grupo
          nombre={`la evaluación entera (${forms.length} sectores)`}
          respuestas={total}
          etiqueta="Eliminar la evaluación entera"
          compacto
          volverA={null}
        />
      </div>
      <div className="divide-y divide-zinc-100 border-t border-zinc-100 dark:divide-zinc-800 dark:border-zinc-800">
        {forms.map((f) => {
          const a = AUDIENCIAS.find((x) => x.value === f.audiencia);
          const color = COLOR_AUDIENCIA[f.audiencia as Audiencia] ?? '#2563eb';
          return (
            <div key={f.id} className="relative px-4 py-3 pl-5 sm:px-5 sm:pl-6">
              <span aria-hidden style={{ background: color }} className="absolute inset-y-0 left-0 w-1" />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <Link href={`/gestion/evaluaciones/${f.id}`} className="group flex min-w-0 items-center gap-2">
                  <span aria-hidden>{a?.emoji}</span>
                  <span className="text-sm font-semibold text-zinc-800 group-hover:text-blue-600 dark:text-zinc-200 dark:group-hover:text-blue-400">
                    {a?.label}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ESTADO_ESTILO[f.estado] ?? ''}`}>{f.estado}</span>
                  <NavPending className="shrink-0" />
                </Link>
                <Respuestas f={f} />
                <Acciones f={f} />
                <EliminarEvaluacion
                  formId={f.id}
                  nombre={`el sector de ${a?.label.toLowerCase()}`}
                  respuestas={f.respuestas}
                  etiqueta={`Eliminar solo el sector de ${a?.label.toLowerCase()}`}
                  compacto
                  volverA={null}
                />
              </div>
              <BarraProgreso f={f} color={color} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
