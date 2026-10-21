'use client';

// La portada del módulo: las evaluaciones de un curso, juntando en una tarjeta los sectores
// de una evaluación conjunta. Recibe los datos ya leídos (la página los trae del servidor).
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BarChart3, CalendarRange, ChevronRight, ClipboardList, ExternalLink, GitCompare, ListChecks, Plus, Send } from 'lucide-react';
import { AUDIENCIAS, COLOR_AUDIENCIA, opcionesAcademicYear, type Audiencia } from '@/lib/evaluaciones';
import type { FormResumen } from '@/lib/evaluaciones-server';
import { buttonVariants } from '@/components/ui/button';
import { Estado, type TonoEstado } from '@/components/ui/estado';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { NavPending } from '@/components/ui/nav-pending';
import { Progreso } from '@/components/ui/progreso';
import { Tarjeta, TarjetaEnlace } from '@/components/ui/tarjeta';
import { Vacio } from '@/components/ui/vacio';
import { EliminarEvaluacion } from '@/components/evaluaciones/eliminar-evaluacion';
import { IconoAudiencia } from '@/components/evaluaciones/ui';

const ESTADO: Record<string, { tono: TonoEstado; texto: string }> = {
  borrador: { tono: 'neutro', texto: 'Borrador' },
  abierto: { tono: 'ok', texto: 'Abierta' },
  cerrado: { tono: 'aviso', texto: 'Cerrada' },
};

function EstadoForm({ estado }: { estado: string }) {
  const e = ESTADO[estado] ?? { tono: 'neutro' as const, texto: estado };
  return <Estado tono={e.tono}>{e.texto}</Estado>;
}

export function ListaEvaluaciones({
  forms,
  actividades,
  year,
  actual,
}: {
  forms: FormResumen[];
  /** Cuántas actividades hay en el curso elegido. */
  actividades: number;
  year: string;
  actual: string;
}) {
  const router = useRouter();
  return (
    <div className="anim-stagger space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Filtros etiqueta="Curso escolar">
          {opcionesAcademicYear(actual).map((y) => (
            <Filtro key={y} activo={y === year} onClick={() => router.push(`/gestion/evaluaciones?anio=${y}`)}>
              {y}
              {y === actual && <span className="text-xs font-normal opacity-80">actual</span>}
            </Filtro>
          ))}
        </Filtros>
        <Link href="/gestion/evaluaciones/actividades" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <ListChecks aria-hidden /> Actividades
          <span className="font-normal text-zinc-500 tabular-nums dark:text-zinc-400">{actividades}</span>
          <NavPending />
        </Link>
      </div>

      {forms.length === 0 ? (
        <Vacio
          icono={<ClipboardList />}
          titulo={`Todavía no hay evaluaciones de ${year}`}
          accion={
            <Link href="/gestion/evaluaciones/nueva" className={buttonVariants()}>
              <Plus aria-hidden /> Crear la primera
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {agrupar(forms).map((g) =>
            g.length === 1 ? <TarjetaForm key={g[0].id} f={g[0]} /> : <TarjetaConjunta key={g[0].grupoId} forms={g} />,
          )}
        </div>
      )}

      <TarjetaEnlace
        href="/gestion/evaluaciones/comparar"
        icono={<GitCompare />}
        titulo="Comparar"
        descripcion="La misma actividad entre cursos, y la visión del alumnado frente a la del profesorado"
      />
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
    <div className="flex flex-wrap items-center gap-1.5">
      {f.estado !== 'borrador' && (
        <Link href={`/evaluaciones/${f.token}`} target="_blank" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <ExternalLink aria-hidden /> Ver enlace
        </Link>
      )}
      <Link href={`/gestion/evaluaciones/${f.id}/enviar`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
        <Send aria-hidden /> Enviar
        <NavPending />
      </Link>
      <Link href={`/gestion/evaluaciones/${f.id}/resultados`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
        <BarChart3 aria-hidden /> Resultados
        <NavPending />
      </Link>
    </div>
  );
}

function Respuestas({ f }: { f: FormResumen }) {
  const pct = porcentaje(f);
  return (
    <p className="text-sm text-zinc-500 dark:text-zinc-400">
      <span className="font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">{f.respuestas}</span> respuestas
      {pct !== null && (
        <span className="tabular-nums">
          {' '}
          de {f.objetivo} ({pct} %)
        </span>
      )}
    </p>
  );
}

function Barra({ f, nombre }: { f: FormResumen; nombre: string }) {
  if (!f.objetivo || f.objetivo <= 0) return null;
  return <Progreso hechos={f.respuestas} total={f.objetivo} etiqueta={`Respuestas de ${nombre}`} className="mt-3" />;
}

function TarjetaForm({ f }: { f: FormResumen }) {
  const audiencia = AUDIENCIAS.find((a) => a.value === f.audiencia);
  return (
    <Tarjeta className="p-4">
      <Link
        href={`/gestion/evaluaciones/${f.id}`}
        className="group -m-2 flex items-start gap-3 rounded-xl p-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span
          aria-hidden
          style={{ background: f.color ?? '#2563eb' }}
          className="mt-1.5 size-2.5 shrink-0 rounded-full"
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-zinc-900 group-hover:text-blue-700 dark:text-zinc-100 dark:group-hover:text-blue-400">
              {f.titulo}
            </span>
            <EstadoForm estado={f.estado} />
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1">
              <IconoAudiencia audiencia={f.audiencia} className="size-3.5" />
              {audiencia?.label}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarRange aria-hidden className="size-3.5" />
              {f.academicYear}
            </span>
            {f.actividades.length > 0 && <span className="truncate">{f.actividades.join(' · ')}</span>}
          </span>
        </span>
        <NavPending className="mt-1" />
        <ChevronRight aria-hidden className="mt-1 size-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Respuestas f={f} />
        <div className="flex flex-wrap items-center gap-1.5">
          <Acciones f={f} />
          <EliminarEvaluacion
            formId={f.id}
            nombre={`«${f.titulo}»`}
            respuestas={f.respuestas}
            etiqueta={`Eliminar «${f.titulo}»`}
            compacto
            volverA={null}
          />
        </div>
      </div>
      <Barra f={f} nombre={f.titulo} />
    </Tarjeta>
  );
}

/**
 * Evaluación conjunta: una sola tarjeta con la cabecera común (qué se evalúa) y una fila
 * por sector. Cada fila lleva el icono de su colectivo en el color de los gráficos y sus
 * propias acciones, porque cada sector se envía y se mira por separado.
 */
function TarjetaConjunta({ forms }: { forms: FormResumen[] }) {
  const primero = forms[0];
  const total = forms.reduce((n, f) => n + f.respuestas, 0);
  return (
    <Tarjeta>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2 p-4">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{tituloBase(primero)}</span>
            <Estado tono="neutro">Conjunta · {forms.length} sectores</Estado>
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1">
              <CalendarRange aria-hidden className="size-3.5" />
              {primero.academicYear}
            </span>
            {primero.actividades.length > 0 && <span className="truncate">{primero.actividades.join(' · ')}</span>}
            <span className="tabular-nums">{total} respuestas en total</span>
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
            <div key={f.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <Link
                  href={`/gestion/evaluaciones/${f.id}`}
                  className="group flex min-h-10 min-w-0 items-center gap-2 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span style={{ color }}>
                    <IconoAudiencia audiencia={f.audiencia} />
                  </span>
                  <span className="text-sm font-semibold text-zinc-900 group-hover:text-blue-700 dark:text-zinc-100 dark:group-hover:text-blue-400">
                    {a?.label}
                  </span>
                  <EstadoForm estado={f.estado} />
                  <NavPending />
                </Link>
                <Respuestas f={f} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
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
              <Barra f={f} nombre={`${tituloBase(f)} · ${a?.label}`} />
            </div>
          );
        })}
      </div>
    </Tarjeta>
  );
}
