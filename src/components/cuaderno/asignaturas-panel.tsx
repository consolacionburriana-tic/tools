'use client';

// Pestaña «Asignaturas»: qué asignaturas tiene cada curso y con qué nombre salen en las hojas.
//
// De dónde salen: del horario (`hor_materias` a través de las asignaciones), con un botón que
// las trae y **no pisa nada** de lo editado a mano. A partir de ahí se añaden, se quitan, se
// reordenan y se les pone un nombre corto — el horario dice "Valencià: Llengua i Literatura"
// y en una casilla impresa cabe "Valencià".
//
// El código de cada una (`<<asignatura1>>`) es su POSICIÓN en el curso, así que se enseña
// siempre al lado: cambiar el orden cambia lo que imprime la plantilla.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, BookOpen, Check, ChevronDown, DownloadCloud, Loader2, Plus, Trash2, TriangleAlert, Users } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Aviso } from '@/components/ui/aviso';
import { Button } from '@/components/ui/button';
import { ConfirmarEnLinea } from '@/components/ui/confirmar';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Input } from '@/components/ui/input';
import { EnCurso } from '@/components/ui/progreso';
import { Rotulo } from '@/components/ui/rotulo';
import { Tarjeta } from '@/components/ui/tarjeta';
import { ETAPA_LABEL, ETAPA_ORDEN } from '@/components/cuaderno/tipos';
import { ASIGNATURAS_MAX } from '@/lib/cuaderno/campos';
import { etapaDeCurso, type Etapa } from '@/lib/cursos';
import { haptic } from '@/lib/haptics';

interface AsignaturaUI {
  id: string;
  curso: string;
  codigo: number;
  nombre: string;
  nombreCorto: string | null;
  enLaHoja: string;
  origen: string;
  alumnos: number | null;
  /** La abreviatura del horario, limpia. Se ofrece, no se impone. */
  sugerenciaCorto: string | null;
}

interface MateriaHorario {
  curso: string;
  materiaId: string;
  nombre: string;
  abreviatura: string | null;
  alumnos: number;
  yaEsta: boolean;
}

interface Datos {
  academicYear: string;
  asignaturas: Record<string, AsignaturaUI[]>;
  materiasHorario: MateriaHorario[];
  cursos: { curso: string; alumnos: number }[];
}

export function AsignaturasPanel({ cursoEscolar }: { cursoEscolar: string }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);

  // Recarga tras cada cambio (la llaman los botones, no el efecto).
  const cargar = useCallback(async () => {
    try {
      const res = await fetch('/api/cuaderno/admin/asignaturas', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'No se pudo cargar');
      setDatos(json);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cargar');
    } finally {
      setCargando(false);
    }
  }, []);

  // Carga inicial: el estado se toca en el callback de la petición, no en el cuerpo del
  // efecto (si no, cada render encadenaría otro).
  useEffect(() => {
    let vivo = true;
    fetch('/api/cuaderno/admin/asignaturas', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json: Datos & { error?: string }) => {
        if (!vivo) return;
        if (json.error) toast.error(json.error);
        else setDatos(json);
        setCargando(false);
      })
      .catch(() => {
        if (!vivo) return;
        toast.error('No se pudieron cargar las asignaturas');
        setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  async function llamar(metodo: string, cuerpo: Record<string, unknown>, marca: string) {
    setOcupado(marca);
    try {
      const res = await fetch('/api/cuaderno/admin/asignaturas', {
        method: metodo,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'No se pudo guardar');
      await cargar();
      return json;
    } catch (error) {
      haptic.warning();
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar');
      return null;
    } finally {
      setOcupado(null);
    }
  }

  const porEtapa = useMemo(() => {
    const mapa = new Map<string, { curso: string; alumnos: number }[]>();
    for (const c of datos?.cursos ?? []) {
      const k = etapaDeCurso(c.curso) ?? 'otras';
      mapa.set(k, [...(mapa.get(k) ?? []), c]);
    }
    return mapa;
  }, [datos]);

  const conHorario = useMemo(
    () => new Set((datos?.materiasHorario ?? []).map((m) => m.curso)),
    [datos],
  );
  const pendientesDelHorario = (datos?.materiasHorario ?? []).filter((m) => !m.yaEsta);

  if (cargando) {
    return <EnCurso texto="Cargando las asignaturas…" />;
  }
  if (!datos) return <Aviso tono="error">No se pudieron cargar las asignaturas.</Aviso>;

  return (
    <div className="space-y-3">
      <Tarjeta className="p-4">
        <div className="flex items-start gap-3">
          <BookOpen aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
          <div className="space-y-1.5 text-sm text-zinc-600 dark:text-zinc-300">
            <p>
              Las asignaturas van <strong>por curso</strong> (no por clase) y salen en las plantillas como{' '}
              <Etiqueta mono>{'<<asignatura1>>'}</Etiqueta>, <Etiqueta mono>{'<<asignatura2>>'}</Etiqueta>… hasta{' '}
              {ASIGNATURAS_MAX}. La misma plantilla vale para todos: cada clase rellena las suyas.
            </p>
            <p>
              El número <strong>es la posición</strong>: si borras la 2, la que era 3 pasa a ser 2. Los huecos que
              sobran salen en blanco, así que una tabla de doce filas no imprime nada raro en un curso de diez
              asignaturas. Si pones nombre corto, es el que se imprime, y se copia solo a las asignaturas que se llaman
              igual en los demás cursos.
            </p>
          </div>
        </div>
      </Tarjeta>

      {pendientesDelHorario.length > 0 && (
        <Tarjeta className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-zinc-700 dark:text-zinc-200">
              El horario tiene <strong>{pendientesDelHorario.length}</strong> asignatura(s) que aquí todavía no están,
              en {new Set(pendientesDelHorario.map((m) => m.curso)).size} curso(s).
            </p>
            <Button
              size="sm"
              onClick={async () => {
                const r = await llamar('POST', { accion: 'sincronizar' }, 'sync');
                if (r) {
                  haptic.success();
                  toast.success(`${r.anadidas} asignatura(s) traídas del horario`);
                }
              }}
              disabled={ocupado !== null}
              cargando={ocupado === 'sync'}
            >
              {ocupado !== 'sync' && <DownloadCloud />}
              Traerlas todas
            </Button>
          </div>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            No pisa nada: las que ya están se quedan como las tengas, solo se añaden las nuevas al final.
          </p>
        </Tarjeta>
      )}

      {[...ETAPA_ORDEN, 'otras'].map((etapa) => {
        const cursos = porEtapa.get(etapa);
        if (!cursos || cursos.length === 0) return null;
        return (
          <div key={etapa} className="space-y-2">
            <Rotulo className="px-1">{ETAPA_LABEL[etapa as Etapa] ?? 'Sin etapa'}</Rotulo>
            {cursos.map(({ curso, alumnos }) => (
              <FilaCurso
                key={curso}
                curso={curso}
                alumnosDelCurso={alumnos}
                asignaturas={datos.asignaturas[curso] ?? []}
                tieneHorario={conHorario.has(curso)}
                abierto={abierto === curso}
                ocupado={ocupado}
                onAbrir={() => setAbierto(abierto === curso ? null : curso)}
                onLlamar={llamar}
              />
            ))}
          </div>
        );
      })}

      <p className="px-1 text-xs text-zinc-500 dark:text-zinc-400">Curso escolar {cursoEscolar}.</p>
    </div>
  );
}

/**
 * Guarda el nombre corto y lo lleva a las asignaturas que se llaman igual en los demás
 * cursos: «Biología» es «BG» en 1º, 3º y 4º, y escribirlo tres veces es una pérdida de
 * tiempo. Solo rellena las que están en blanco; las que ya tenían otro se quedan como
 * estaban y el aviso ofrece pisarlas de una vez.
 */
async function guardarNombreCorto(
  asignatura: AsignaturaUI,
  valor: string,
  onLlamar: (metodo: string, cuerpo: Record<string, unknown>, marca: string) => Promise<unknown>,
) {
  const respuesta = (await onLlamar('PATCH', { id: asignatura.id, nombreCorto: valor }, asignatura.id)) as {
    propagadas?: number;
    conOtro?: number;
  } | null;
  if (!respuesta) return;
  const corto = valor.trim();
  const { propagadas = 0, conOtro = 0 } = respuesta;
  if (propagadas > 0) {
    toast.success(
      corto
        ? `«${corto}» puesto también en ${propagadas} curso(s) más`
        : `Nombre corto quitado también en ${propagadas} curso(s) más`,
    );
  }
  if (conOtro > 0) {
    toast(`${conOtro} «${asignatura.nombre}» de otros cursos tienen otro nombre corto`, {
      action: {
        label: 'Poner el mismo',
        onClick: () => {
          void onLlamar('PATCH', { id: asignatura.id, nombreCorto: valor, pisar: true }, asignatura.id).then(() =>
            toast.success(`«${corto}» aplicado a todos los cursos`),
          );
        },
      },
    });
  }
}

function FilaCurso({
  curso,
  alumnosDelCurso,
  asignaturas,
  tieneHorario,
  abierto,
  ocupado,
  onAbrir,
  onLlamar,
}: {
  curso: string;
  alumnosDelCurso: number;
  asignaturas: AsignaturaUI[];
  tieneHorario: boolean;
  abierto: boolean;
  ocupado: string | null;
  onAbrir: () => void;
  onLlamar: (metodo: string, cuerpo: Record<string, unknown>, marca: string) => Promise<unknown>;
}) {
  const [nuevoNombre, setNuevoNombre] = useState('');

  return (
    <Tarjeta>
      <button
        type="button"
        onClick={onAbrir}
        aria-expanded={abierto}
        className="flex min-h-14 w-full items-center gap-3 rounded-2xl p-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="min-w-16 shrink-0 rounded-md bg-zinc-100 px-2 py-1 text-center text-sm font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          {curso}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-zinc-900 dark:text-zinc-100">
            {asignaturas.length === 0 ? (
              <span className="text-zinc-500 dark:text-zinc-400">Sin asignaturas todavía</span>
            ) : (
              asignaturas.map((a) => a.enLaHoja).join(' · ')
            )}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1">
              <Users aria-hidden className="h-3 w-3" /> {alumnosDelCurso} alumnos en el curso
            </span>
            <span>· {asignaturas.length} asignaturas</span>
            {!tieneHorario && (
              <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                <TriangleAlert aria-hidden className="h-3 w-3" /> sin horario cargado
              </span>
            )}
            {asignaturas.length > ASIGNATURAS_MAX && (
              <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                <TriangleAlert aria-hidden className="h-3 w-3" /> más de {ASIGNATURAS_MAX}: las últimas no saldrán
              </span>
            )}
          </span>
        </span>
        <ChevronDown aria-hidden className={cn('h-4 w-4 shrink-0 text-zinc-500 transition-transform', abierto && 'rotate-180')} />
      </button>

      {abierto && (
        <div className="space-y-2 border-t border-zinc-100 p-4 dark:border-zinc-800">
          {asignaturas.length === 0 && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {tieneHorario
                ? 'El horario tiene asignaturas de este curso: usa «Traerlas del horario».'
                : 'Este curso no tiene horario cargado. Añádelas a mano abajo.'}
            </p>
          )}

          {asignaturas.map((a, i) => (
            <Asignatura
              key={a.id}
              asignatura={a}
              primera={i === 0}
              ultima={i === asignaturas.length - 1}
              fueraDeRango={a.codigo > ASIGNATURAS_MAX}
              ocupado={ocupado}
              onLlamar={onLlamar}
            />
          ))}

          <div className="flex flex-col gap-2 pt-2 sm:flex-row">
            <Input
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              placeholder="Añadir una asignatura a mano…"
              aria-label={`Nueva asignatura de ${curso}`}
              className="sm:flex-1"
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || nuevoNombre.trim() === '') return;
                void onLlamar('POST', { accion: 'crear', curso, nombre: nuevoNombre.trim() }, `nueva-${curso}`).then(
                  () => setNuevoNombre(''),
                );
              }}
            />
            <Button
              variant="outline"
              disabled={ocupado !== null || nuevoNombre.trim() === ''}
              onClick={async () => {
                await onLlamar('POST', { accion: 'crear', curso, nombre: nuevoNombre.trim() }, `nueva-${curso}`);
                setNuevoNombre('');
              }}
            >
              <Plus /> Añadir
            </Button>
            {tieneHorario && (
              <Button
                variant="outline"
                disabled={ocupado !== null}
                cargando={ocupado === `sync-${curso}`}
                onClick={async () => {
                  const r = (await onLlamar('POST', { accion: 'sincronizar', curso }, `sync-${curso}`)) as {
                    anadidas: number;
                  } | null;
                  if (r) toast.success(`${r.anadidas} traída(s) del horario`);
                }}
              >
                {ocupado !== `sync-${curso}` && <DownloadCloud />}
                Traerlas del horario
              </Button>
            )}
          </div>
        </div>
      )}
    </Tarjeta>
  );
}

function Asignatura({
  asignatura,
  primera,
  ultima,
  fueraDeRango,
  ocupado,
  onLlamar,
}: {
  asignatura: AsignaturaUI;
  primera: boolean;
  ultima: boolean;
  fueraDeRango: boolean;
  ocupado: string | null;
  onLlamar: (metodo: string, cuerpo: Record<string, unknown>, marca: string) => Promise<unknown>;
}) {
  const a = asignatura;
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-xl px-2 py-2',
        fueraDeRango ? 'bg-amber-50 dark:bg-amber-500/10' : 'bg-zinc-50 dark:bg-zinc-800/40',
      )}
    >
      <Etiqueta mono>{`<<asignatura${a.codigo}>>`}</Etiqueta>
      {fueraDeRango && <span className="text-xs text-amber-700 dark:text-amber-400">Pasa de {ASIGNATURAS_MAX}: no se imprimirá</span>}

      <Input
        defaultValue={a.nombre}
        aria-label={`Nombre de ${a.nombre}`}
        onBlur={(e) => e.target.value.trim() !== a.nombre && onLlamar('PATCH', { id: a.id, nombre: e.target.value }, a.id)}
        className="h-10 min-w-40 flex-1"
      />
      <Input
        key={a.nombreCorto ?? ''}
        defaultValue={a.nombreCorto ?? ''}
        placeholder="Corto (opcional)"
        aria-label={`Nombre corto de ${a.nombre}`}
        onBlur={(e) => {
          if ((e.target.value.trim() || null) === a.nombreCorto) return;
          void guardarNombreCorto(a, e.target.value, onLlamar);
        }}
        className="h-10 w-36"
      />
      {/* La del horario, por si sirve. Son códigos de Untis, así que se ofrece y ya. */}
      {!a.nombreCorto && a.sugerenciaCorto && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            haptic.tap();
            void guardarNombreCorto(a, a.sugerenciaCorto as string, onLlamar);
          }}
        >
          Usar «{a.sugerenciaCorto}»
        </Button>
      )}

      <span className="w-24 shrink-0 text-right text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
        {a.alumnos === null ? 'a mano' : `${a.alumnos} alumnos`}
      </span>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={primera || ocupado !== null}
          onClick={() => onLlamar('POST', { accion: 'mover', id: a.id, direccion: 'arriba' }, a.id)}
          aria-label={`Subir ${a.nombre} (cambia su número)`}
        >
          <ArrowUp />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={ultima || ocupado !== null}
          onClick={() => onLlamar('POST', { accion: 'mover', id: a.id, direccion: 'abajo' }, a.id)}
          aria-label={`Bajar ${a.nombre} (cambia su número)`}
        >
          <ArrowDown />
        </Button>
        <ConfirmarEnLinea
          etiqueta={<span className="sr-only">Quitar {a.nombre}</span>}
          icono={<Trash2 />}
          variante="ghost"
          disabled={ocupado !== null}
          pregunta={`¿Quitar «${a.nombre}»? Las de debajo subirán un número.`}
          confirmar="Sí, quitar"
          onConfirmar={() => onLlamar('DELETE', { id: a.id }, a.id)}
        />
        <span aria-hidden className="flex w-4 justify-center">
          {ocupado === a.id ? <Loader2 className="h-4 w-4 animate-spin text-zinc-500" /> : <Check className="h-4 w-4 text-transparent" />}
        </span>
      </div>
    </div>
  );
}
