'use client';

// La portada del módulo: las evaluaciones de un curso, juntando en una tarjeta los sectores
// de una evaluación conjunta. Recibe los datos ya leídos (la página los trae del servidor).
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BarChart3, ClipboardList, ExternalLink, GitCompare, ListChecks, Lock, Plus, Send } from 'lucide-react';
import { AUDIENCIAS, COLOR_AUDIENCIA, opcionesAcademicYear, type Audiencia } from '@/lib/evaluaciones';
import type { FormResumen } from '@/lib/evaluaciones-server';
import { buttonVariants } from '@/components/ui/button';
import { Estado, type TonoEstado } from '@/components/ui/estado';
import { Anillo } from '@/components/ui/anillo';
import { Segmentado } from '@/components/ui/segmentado';
import { NavPending } from '@/components/ui/nav-pending';
import { Tarjeta, TarjetaEnlace } from '@/components/ui/tarjeta';
import { Vacio } from '@/components/ui/vacio';
import { EliminarEvaluacion } from '@/components/evaluaciones/eliminar-evaluacion';
import { IconoAudiencia } from '@/components/evaluaciones/ui';

const ESTADO: Record<string, { tono: TonoEstado; texto: string }> = {
  borrador: { tono: 'neutro', texto: 'Borrador' },
  abierto: { tono: 'ok', texto: 'Abierta' },
  cerrado: { tono: 'neutro', texto: 'Cerrada' },
};

function EstadoForm({ estado }: { estado: string }) {
  const e = ESTADO[estado] ?? { tono: 'neutro' as const, texto: estado };
  return (
    <Estado tono={e.tono} icono={estado === 'cerrado' ? <Lock /> : undefined}>
      {e.texto}
    </Estado>
  );
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
        <Segmentado
          etiqueta="Curso escolar"
          valor={year}
          onChange={(y) => y !== year && router.push(`/gestion/evaluaciones?anio=${y}`)}
          opciones={opcionesAcademicYear(actual).map((y) => ({ valor: y, etiqueta: y === actual ? `${y} · actual` : y }))}
        />
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

/** El color de una evaluación: el de su actividad o, si no tiene, el de su colectivo. */
function colorDe(f: FormResumen): string {
  return f.color ?? COLOR_AUDIENCIA[f.audiencia as Audiencia] ?? 'var(--color-blue-600)';
}

/**
 * Lo que se puede hacer con una evaluación. Solo una acción destaca, la que toca ahora:
 * enviarla si es un borrador, mirar los resultados si ya está abierta o cerrada.
 */
function Acciones({ f }: { f: FormResumen }) {
  const borrador = f.estado === 'borrador';
  return (
    <div className="flex shrink-0 items-center gap-1">
      {!borrador && (
        <Link
          href={`/evaluaciones/${f.token}`}
          target="_blank"
          aria-label="Abrir el enlace de la encuesta"
          className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
        >
          <ExternalLink aria-hidden />
        </Link>
      )}
      <Link href={`/gestion/evaluaciones/${f.id}/enviar`} className={buttonVariants({ variant: borrador ? 'suave' : 'ghost', size: 'sm' })}>
        <Send aria-hidden /> Enviar
        <NavPending />
      </Link>
      {!borrador && (
        <Link href={`/gestion/evaluaciones/${f.id}/resultados`} className={buttonVariants({ variant: 'suave', size: 'sm' })}>
          <BarChart3 aria-hidden /> Resultados
          <NavPending />
        </Link>
      )}
    </div>
  );
}

function textoRespuestas(f: FormResumen): string {
  const pct = porcentaje(f);
  return pct !== null ? `${f.respuestas} de ${f.objetivo} respuestas` : `${f.respuestas} ${f.respuestas === 1 ? 'respuesta' : 'respuestas'}`;
}

function TarjetaForm({ f }: { f: FormResumen }) {
  const audiencia = AUDIENCIAS.find((a) => a.value === f.audiencia);
  return (
    <Tarjeta className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
      <Anillo hechos={f.respuestas} total={f.objetivo} color={colorDe(f)} etiqueta={textoRespuestas(f)} />
      <Link
        href={`/gestion/evaluaciones/${f.id}`}
        className="group min-w-0 flex-[1_1_16rem] rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-zinc-900 group-hover:text-blue-700 dark:text-zinc-100 dark:group-hover:text-blue-400">{f.titulo}</span>
          <EstadoForm estado={f.estado} />
          <NavPending />
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-zinc-500 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1" style={{ color: COLOR_AUDIENCIA[f.audiencia as Audiencia] }}>
            <IconoAudiencia audiencia={f.audiencia} className="size-4" />
            <span className="text-zinc-600 dark:text-zinc-300">{audiencia?.label}</span>
          </span>
          <span className="tabular-nums">{textoRespuestas(f)}</span>
          {f.actividades.length > 0 && <span className="truncate">{f.actividades.join(' · ')}</span>}
        </span>
      </Link>
      <div className="flex items-center gap-1">
        <Acciones f={f} />
        <EliminarEvaluacion formId={f.id} nombre={`«${f.titulo}»`} respuestas={f.respuestas} etiqueta={`Eliminar «${f.titulo}»`} compacto volverA={null} />
      </div>
    </Tarjeta>
  );
}

/**
 * Evaluación conjunta: una sola tarjeta con lo que se evalúa arriba y una fila por sector,
 * cada una con su anillo en el color de su colectivo (el mismo de los gráficos), porque cada
 * sector se envía y se mira por separado.
 */
function TarjetaConjunta({ forms }: { forms: FormResumen[] }) {
  const primero = forms[0];
  const total = forms.reduce((n, f) => n + f.respuestas, 0);
  return (
    <Tarjeta>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-4 pb-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{tituloBase(primero)}</span>
            <Estado tono="neutro">Conjunta · {forms.length} sectores</Estado>
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            <span className="tabular-nums">{total} respuestas en total</span>
            {primero.actividades.length > 0 && <span className="truncate">{primero.actividades.join(' · ')}</span>}
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
          const color = COLOR_AUDIENCIA[f.audiencia as Audiencia] ?? 'var(--color-blue-600)';
          return (
            <div key={f.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <Anillo hechos={f.respuestas} total={f.objetivo} color={color} tamano="sm" etiqueta={`${a?.label}: ${textoRespuestas(f)}`} />
              <Link
                href={`/gestion/evaluaciones/${f.id}`}
                className="group min-w-0 flex-[1_1_12rem] rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span style={{ color }}>
                    <IconoAudiencia audiencia={f.audiencia} className="size-4" />
                  </span>
                  <span className="text-sm font-semibold text-zinc-900 group-hover:text-blue-700 dark:text-zinc-100 dark:group-hover:text-blue-400">
                    {a?.label}
                  </span>
                  <EstadoForm estado={f.estado} />
                  <NavPending />
                </span>
                <span className="mt-0.5 block text-sm text-zinc-500 tabular-nums dark:text-zinc-400">{textoRespuestas(f)}</span>
              </Link>
              <div className="flex items-center gap-1">
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
            </div>
          );
        })}
      </div>
    </Tarjeta>
  );
}
