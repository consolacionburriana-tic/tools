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
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  DownloadCloud,
  Loader2,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Aviso, Tarjeta } from '@/components/cuaderno/cuaderno-panel';
import { ETAPA_LABEL, ETAPA_ORDEN } from '@/components/cuaderno/tipos';
import { ASIGNATURAS_MAX } from '@/lib/cuaderno/campos';
import { etapaDeCurso } from '@/lib/cursos';
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
    return (
      <Tarjeta>
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando las asignaturas…
        </div>
      </Tarjeta>
    );
  }
  if (!datos) return <Aviso tono="rojo">No se pudieron cargar las asignaturas.</Aviso>;

  return (
    <div className="space-y-3">
      <Tarjeta>
        <div className="flex items-start gap-2">
          <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
          <div className="space-y-1.5 text-sm text-zinc-600 dark:text-zinc-300">
            <p>
              Las asignaturas van <strong>por curso</strong> (no por clase) y salen en las plantillas como{' '}
              <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">{'<<asignatura1>>'}</code>,{' '}
              <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">{'<<asignatura2>>'}</code>…
              hasta {ASIGNATURAS_MAX}. La misma plantilla vale para todos: cada clase rellena las suyas.
            </p>
            <p className="text-xs">
              El número <strong>es la posición</strong>: si borras la 2, la que era 3 pasa a ser 2. Los huecos que
              sobran salen en blanco, así que una tabla de doce filas no imprime nada raro en un curso de diez
              asignaturas. Si pones nombre corto, es el que se imprime.
            </p>
          </div>
        </div>
      </Tarjeta>

      {pendientesDelHorario.length > 0 && (
        <Tarjeta>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-zinc-700 dark:text-zinc-200">
              El horario tiene <strong>{pendientesDelHorario.length}</strong> asignatura(s) que aquí todavía no están,
              en {new Set(pendientesDelHorario.map((m) => m.curso)).size} curso(s).
            </p>
            <button
              type="button"
              onClick={async () => {
                const r = await llamar('POST', { accion: 'sincronizar' }, 'sync');
                if (r) {
                  haptic.success();
                  toast.success(`${r.anadidas} asignatura(s) traídas del horario`);
                }
              }}
              disabled={ocupado !== null}
              className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {ocupado === 'sync' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DownloadCloud className="h-3.5 w-3.5" />}
              Traerlas todas
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            No pisa nada: las que ya están se quedan como las tengas, solo se añaden las nuevas al final.
          </p>
        </Tarjeta>
      )}

      {[...ETAPA_ORDEN, 'otras'].map((etapa) => {
        const cursos = porEtapa.get(etapa);
        if (!cursos || cursos.length === 0) return null;
        return (
          <div key={etapa} className="space-y-2">
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              {ETAPA_LABEL[etapa as 'EI' | 'EP' | 'ESO'] ?? 'Sin etapa'}
            </p>
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

      <p className="px-1 text-xs text-zinc-400">Curso escolar {cursoEscolar}.</p>
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
      <button type="button" onClick={onAbrir} className="flex w-full items-center gap-3 text-left">
        <span className="min-w-16 shrink-0 rounded-lg bg-zinc-100 px-2 py-1 text-center text-sm font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          {curso}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-zinc-900 dark:text-zinc-100">
            {asignaturas.length === 0 ? (
              <span className="text-zinc-400">sin asignaturas todavía</span>
            ) : (
              asignaturas.map((a) => a.enLaHoja).join(' · ')
            )}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" /> {alumnosDelCurso} alumnos en el curso
            </span>
            <span>· {asignaturas.length} asignaturas</span>
            {!tieneHorario && (
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3" /> sin horario cargado
              </span>
            )}
            {asignaturas.length > ASIGNATURAS_MAX && (
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3" /> más de {ASIGNATURAS_MAX}: las últimas no saldrán
              </span>
            )}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {abierto && (
        <div className="mt-4 space-y-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          {asignaturas.length === 0 && (
            <p className="text-sm text-zinc-500">
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
            <input
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              placeholder="Añadir una asignatura a mano…"
              className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || nuevoNombre.trim() === '') return;
                void onLlamar('POST', { accion: 'crear', curso, nombre: nuevoNombre.trim() }, `nueva-${curso}`).then(
                  () => setNuevoNombre(''),
                );
              }}
            />
            <button
              type="button"
              disabled={ocupado !== null || nuevoNombre.trim() === ''}
              onClick={async () => {
                await onLlamar('POST', { accion: 'crear', curso, nombre: nuevoNombre.trim() }, `nueva-${curso}`);
                setNuevoNombre('');
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-600 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
            >
              <Plus className="h-4 w-4" /> Añadir
            </button>
            {tieneHorario && (
              <button
                type="button"
                disabled={ocupado !== null}
                onClick={async () => {
                  const r = (await onLlamar('POST', { accion: 'sincronizar', curso }, `sync-${curso}`)) as {
                    anadidas: number;
                  } | null;
                  if (r) toast.success(`${r.anadidas} traída(s) del horario`);
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-600 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
              >
                {ocupado === `sync-${curso}` ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <DownloadCloud className="h-4 w-4" />
                )}
                Traerlas del horario
              </button>
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
      className={`flex flex-wrap items-center gap-2 rounded-xl px-2 py-1.5 ${
        fueraDeRango ? 'bg-amber-50 dark:bg-amber-950/30' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
      }`}
    >
      <code
        title={fueraDeRango ? `Pasa de ${ASIGNATURAS_MAX}: esta no se imprimirá` : `Etiqueta <<asignatura${a.codigo}>>`}
        className="shrink-0 rounded bg-zinc-100 px-1.5 py-1 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
      >
        {`<<asignatura${a.codigo}>>`}
      </code>

      <input
        defaultValue={a.nombre}
        onBlur={(e) => e.target.value.trim() !== a.nombre && onLlamar('PATCH', { id: a.id, nombre: e.target.value }, a.id)}
        className="min-w-40 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm outline-none hover:border-zinc-200 focus:border-zinc-400 dark:hover:border-zinc-700"
      />
      <span className="flex w-40 shrink-0 items-center gap-1">
        <input
          key={a.nombreCorto ?? ''}
          defaultValue={a.nombreCorto ?? ''}
          placeholder="corto (opcional)"
          title="Se copia solo a las asignaturas que se llaman igual en los demás cursos"
          onBlur={(e) => {
            if ((e.target.value.trim() || null) === a.nombreCorto) return;
            void guardarNombreCorto(a, e.target.value, onLlamar);
          }}
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm outline-none hover:border-zinc-200 focus:border-zinc-400 dark:hover:border-zinc-700"
        />
        {/* La del horario, por si sirve. Son códigos de Untis, así que se ofrece y ya. */}
        {!a.nombreCorto && a.sugerenciaCorto && (
          <button
            type="button"
            title={`Usar «${a.sugerenciaCorto}», que es lo que el horario tiene para esta materia`}
            onClick={() => {
              haptic.tap();
              void guardarNombreCorto(a, a.sugerenciaCorto as string, onLlamar);
            }}
            className="shrink-0 rounded-lg bg-zinc-100 px-1.5 py-1 font-mono text-[11px] text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            {a.sugerenciaCorto}
          </button>
        )}
      </span>

      <span className="w-28 shrink-0 text-right text-xs text-zinc-400">
        {a.alumnos === null ? 'a mano' : `${a.alumnos} alumnos`}
      </span>

      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          disabled={primera || ocupado !== null}
          onClick={() => onLlamar('POST', { accion: 'mover', id: a.id, direccion: 'arriba' }, a.id)}
          title="Subir (cambia su número)"
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 disabled:opacity-20 dark:hover:bg-zinc-800"
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={ultima || ocupado !== null}
          onClick={() => onLlamar('POST', { accion: 'mover', id: a.id, direccion: 'abajo' }, a.id)}
          title="Bajar (cambia su número)"
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 disabled:opacity-20 dark:hover:bg-zinc-800"
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={ocupado !== null}
          onClick={() => {
            if (!confirm(`¿Quitar «${a.nombre}»? Las de debajo subirán un número.`)) return;
            void onLlamar('DELETE', { id: a.id }, a.id);
          }}
          title="Quitar"
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-20 dark:hover:bg-red-950/40"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        {ocupado === a.id ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
        ) : (
          <Check className="h-3.5 w-3.5 text-transparent" />
        )}
      </div>
    </div>
  );
}
