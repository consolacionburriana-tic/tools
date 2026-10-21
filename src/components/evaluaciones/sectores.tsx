'use client';

// Sectores de una evaluación conjunta: el formulario del alumnado, el del profesorado y
// el de las familias de la MISMA evaluación. Cada uno es un formulario independiente (su
// preset, su anonimato, su enlace, su estado); aquí solo se enseñan juntos para saltar de
// uno a otro sin volver al listado.
//
// El color de cada sector NO es el del formulario (ese es decorativo y al azar): es el de
// la paleta de datos por colectivo (`--eval-alumnos`, `--eval-profesores`,
// `--eval-familias`), la misma que usan los gráficos de resultados. Así el naranja es
// "profesorado" en el editor, en el envío y en la comparativa, sin tener que leer nada.
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { IconoAudiencia } from '@/components/evaluaciones/ui';
import { AUDIENCIAS, COLOR_AUDIENCIA, RASGOS_AUDIENCIA, type Audiencia } from '@/lib/evaluaciones';
import type { SectorGrupo } from '@/lib/evaluaciones-server';

const QUIEN: Record<Audiencia, string> = {
  alumnos: 'el alumnado',
  profesores: 'el profesorado',
  familias: 'las familias',
};

const ESTADO_PUNTO: Record<string, string> = {
  borrador: 'bg-zinc-400 dark:bg-zinc-500',
  abierto: 'bg-emerald-500',
  cerrado: 'bg-amber-500',
};

const ESTADO_TEXTO: Record<string, string> = { borrador: 'Borrador', abierto: 'Abierta', cerrado: 'Cerrada' };

type Destino = 'editor' | 'enviar' | 'resultados';

function hrefSector(id: string, destino: Destino, query?: string): string {
  if (destino === 'editor') return `/gestion/evaluaciones/${id}`;
  return `/gestion/evaluaciones/${id}/${destino}${query ? `?${query}` : ''}`;
}

/**
 * Pestañas de sector. Se pintan solo si la evaluación es conjunta (o si se puede añadir un
 * colectivo desde el editor). `destino` decide a qué pantalla del otro sector se salta:
 * desde "Enviar" del alumnado se va a "Enviar" del profesorado, no a su editor.
 */
export function SectoresTabs({
  sectores,
  actualId,
  destino,
  anadirDesde,
  query,
}: {
  sectores: SectorGrupo[];
  actualId: string;
  destino: Destino;
  /** Parámetros que se conservan al saltar al otro sector (en resultados, la etapa). */
  query?: string;
  /** Si se pasa, se ofrecen los colectivos que faltan (copiando la estructura desde este form). */
  anadirDesde?: { formId: string; audiencia: Audiencia };
}) {
  const router = useRouter();
  const [creando, setCreando] = useState<Audiencia | null>(null);
  const presentes = new Set(sectores.map((s) => s.audiencia));
  if (anadirDesde) presentes.add(anadirDesde.audiencia);
  const faltan = anadirDesde ? AUDIENCIAS.filter((a) => !presentes.has(a.value)) : [];

  if (sectores.length < 2 && faltan.length === 0) return null;

  async function anadir(audiencia: Audiencia) {
    if (!anadirDesde) return;
    setCreando(audiencia);
    try {
      const res = await fetch(`/api/evaluaciones/admin/forms/${anadirDesde.formId}/duplicar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audiencia }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo crear');
      haptic.success();
      toast.success(`Sector de ${AUDIENCIAS.find((a) => a.value === audiencia)?.label.toLowerCase()} creado con sus preguntas de siempre`);
      router.push(`/gestion/evaluaciones/${data.form.id}`);
      router.refresh();
    } catch (e) {
      haptic.warning();
      toast.error(e instanceof Error ? e.message : 'Error inesperado');
    } finally {
      setCreando(null);
    }
  }

  // Si el form va suelto todavía, se pinta él solo como pestaña activa para que "añadir"
  // se lea como "añadir otro sector a ESTA evaluación".
  const lista: SectorGrupo[] =
    sectores.length > 0
      ? sectores
      : anadirDesde
        ? [{ id: actualId, titulo: '', audiencia: anadirDesde.audiencia, estado: '', color: null, respuestas: 0, huecos: 0 }]
        : [];

  return (
    <nav aria-label="Sectores de la evaluación" className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className="flex min-w-max items-stretch gap-1.5">
        {lista.map((s) => {
          const a = AUDIENCIAS.find((x) => x.value === s.audiencia);
          const activo = s.id === actualId;
          const color = COLOR_AUDIENCIA[s.audiencia];
          const contenido = (
            <>
              <span
                aria-hidden
                style={{ background: `color-mix(in oklab, ${color} 14%, transparent)`, color }}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg"
              >
                <IconoAudiencia audiencia={s.audiencia} />
              </span>
              <span className="min-w-0 text-left">
                <span
                  className={cn(
                    'block text-sm font-semibold',
                    activo ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-700 dark:text-zinc-300',
                  )}
                >
                  {a?.label}
                </span>
                {s.estado && (
                  <span className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                    <span aria-hidden className={cn('size-1.5 rounded-full', ESTADO_PUNTO[s.estado] ?? ESTADO_PUNTO.borrador)} />
                    {ESTADO_TEXTO[s.estado] ?? s.estado}
                    {s.respuestas > 0 && <span className="tabular-nums">· {s.respuestas} resp.</span>}
                    {s.huecos > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-400">
                        <TriangleAlert aria-hidden className="size-3" />
                        {s.huecos} a medias
                      </span>
                    )}
                  </span>
                )}
              </span>
            </>
          );
          const base =
            'flex min-h-12 items-center gap-2.5 rounded-xl border px-3 py-2 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50';
          return activo ? (
            <span
              key={s.id}
              aria-current="page"
              className={cn(base, 'border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-900')}
            >
              {contenido}
            </span>
          ) : (
            <Link
              key={s.id}
              href={hrefSector(s.id, destino, query)}
              className={cn(
                base,
                'border-transparent bg-zinc-200/60 hover:bg-white dark:bg-zinc-800/60 dark:hover:bg-zinc-900',
              )}
            >
              {contenido}
            </Link>
          );
        })}
        {faltan.map((a) => (
          <Button
            key={a.value}
            type="button"
            variant="outline"
            disabled={creando !== null}
            cargando={creando === a.value}
            onClick={() => void anadir(a.value)}
            className="h-auto min-h-12 border-dashed"
          >
            {creando !== a.value && <Plus aria-hidden />}
            Añadir {a.label.toLowerCase()}
          </Button>
        ))}
      </div>
    </nav>
  );
}

/**
 * Banda de identidad del sector, arriba del panel de cabecera del editor. Dice en una
 * línea para quién son estas preguntas y qué rasgos tiene ese colectivo, con su color.
 * Es lo que evita editar las del profesorado creyendo que son las del alumnado.
 */
export function BandaSector({ audiencia }: { audiencia: Audiencia }) {
  const a = AUDIENCIAS.find((x) => x.value === audiencia);
  const color = COLOR_AUDIENCIA[audiencia];
  const r = RASGOS_AUDIENCIA[audiencia];
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-4 py-2.5 sm:px-5"
      style={{
        background: `color-mix(in oklab, ${color} 9%, transparent)`,
        borderColor: `color-mix(in oklab, ${color} 22%, transparent)`,
      }}
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        <span style={{ color }}>
          <IconoAudiencia audiencia={audiencia} />
        </span>
        Preguntas para {QUIEN[audiencia]}
        <span className="sr-only">({a?.label})</span>
      </p>
      <div className="flex flex-wrap gap-1">
        {r.rasgos.map((x) => (
          <span
            key={x}
            className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium text-zinc-700 ring-1 ring-black/5 dark:bg-zinc-900/60 dark:text-zinc-300 dark:ring-white/10"
          >
            {x}
          </span>
        ))}
      </div>
    </div>
  );
}
