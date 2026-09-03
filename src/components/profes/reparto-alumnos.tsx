'use client';

// Reparto de alumnos entre los dos (o tres) tutores de una clase: cada alumno tiene un
// **tutor personal**, que es a quien se avisa de lo que le pasa a ese alumno concreto.
//
// La pantalla está pensada para hacerlo rápido en iPad y sin arrastrar nada (en táctil no
// hay hover que valga): la lista va en orden alfabético y entre cada dos alumnos hay una
// franja de corte que se toca para decir "de aquí hacia arriba, uno; hacia abajo, el otro".
// Los botones de arriba hacen el resto: mitades, invertir, completar huecos y limpiar.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpDown, Check, Eraser, Loader2, Scissors, SplitSquareVertical, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import {
  aplicarCorte,
  type ClaseConTutoresUI,
  completarHuecos,
  cortesDeReparto,
  invertirReparto,
  type Reparto,
  repartoPorMitades,
  repartoPorTutor,
  sinTutorPersonal,
} from '@/lib/tutorias';

export interface TutorClase {
  teacherId: string;
  nombre: string;
}

interface AlumnoReparto {
  id: string;
  nombre: string;
  tutorPersonal: string | null;
}

interface RepartoRespuesta {
  alumnos: AlumnoReparto[];
  tutores: TutorClase[];
  confirmadoAt: string | null;
  confirmadoPor: string | null;
  descolgados: number;
}

// Un color por tutor (hasta tres: David confirma que más no va a haber).
const COLORES = [
  {
    activo: 'bg-blue-600 text-white ring-blue-600',
    suave: 'text-blue-700 ring-blue-300 hover:bg-blue-50 dark:text-blue-300 dark:ring-blue-500/40 dark:hover:bg-blue-500/10',
    linea: 'bg-blue-500',
    punto: 'bg-blue-500',
  },
  {
    activo: 'bg-amber-500 text-white ring-amber-500',
    suave: 'text-amber-700 ring-amber-300 hover:bg-amber-50 dark:text-amber-300 dark:ring-amber-500/40 dark:hover:bg-amber-500/10',
    linea: 'bg-amber-500',
    punto: 'bg-amber-500',
  },
  {
    activo: 'bg-violet-600 text-white ring-violet-600',
    suave: 'text-violet-700 ring-violet-300 hover:bg-violet-50 dark:text-violet-300 dark:ring-violet-500/40 dark:hover:bg-violet-500/10',
    linea: 'bg-violet-500',
    punto: 'bg-violet-500',
  },
];

/** "Ana Vidal Bort" → "Ana V." — cabe en el chip de cada fila sin partirse. */
function etiquetaCorta(nombre: string): string {
  const [pila, ...resto] = nombre.split(' ').filter(Boolean);
  return resto[0] ? `${pila} ${resto[0][0]}.` : pila ?? nombre;
}

export function RepartoAlumnos({
  curso,
  letra,
  tutores,
  onClases,
}: {
  curso: string;
  letra: string | null;
  tutores: TutorClase[];
  /** El servidor devuelve la rejilla recalculada: así el aviso de la tarjeta se actualiza solo. */
  onClases: (clases: ClaseConTutoresUI[]) => void;
}) {
  const [datos, setDatos] = useState<RepartoRespuesta | null>(null);
  const [reparto, setReparto] = useState<Reparto>({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tutorIds = useMemo(() => tutores.map((t) => t.teacherId), [tutores]);

  useEffect(() => {
    let vivo = true;
    const params = new URLSearchParams({ curso, ...(letra ? { letra } : {}) });
    fetch(`/api/profes/admin/tutorias/reparto?${params}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'No se pudo cargar el reparto');
        return data.reparto as RepartoRespuesta;
      })
      .then((r) => {
        if (!vivo) return;
        setDatos(r);
        setReparto(Object.fromEntries(r.alumnos.map((a) => [a.id, a.tutorPersonal])));
      })
      .catch((e: unknown) => {
        if (vivo) toast.error(e instanceof Error ? e.message : 'No se pudo cargar el reparto');
      })
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [curso, letra]);

  // Se guarda solo: en esta pantalla se dan muchos toques seguidos (mitades, un corte, dos
  // arreglos a mano) y pedir "Guardar" después de cada uno sobraría. El PUT manda el mapa
  // completo de la clase, así que el último gana y no hay estados a medias.
  const guardar = useCallback(
    (nuevo: Reparto) => {
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(async () => {
        setGuardando(true);
        setGuardado(false);
        try {
          const res = await fetch('/api/profes/admin/tutorias/reparto', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ curso, letra, reparto: nuevo }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? 'No se pudo guardar');
          onClases(data.clases);
          setGuardado(true);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'No se pudo guardar el reparto');
          haptic.warning();
        } finally {
          setGuardando(false);
        }
      }, 700);
    },
    [curso, letra, onClases],
  );

  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    },
    [],
  );

  function aplicar(nuevo: Reparto) {
    setReparto(nuevo);
    haptic.tap();
    guardar(nuevo);
  }

  async function confirmar(confirmado: boolean) {
    setConfirmando(true);
    try {
      const res = await fetch('/api/profes/admin/tutorias/reparto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ curso, letra, confirmado }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo confirmar');
      setDatos((d) => (d ? { ...d, confirmadoAt: data.confirmadoAt ?? null } : d));
      onClases(data.clases);
      haptic.success();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo confirmar');
      haptic.warning();
    } finally {
      setConfirmando(false);
    }
  }

  if (cargando) {
    return (
      <p className="flex items-center gap-1.5 py-3 text-xs text-zinc-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando el alumnado de la clase…
      </p>
    );
  }
  if (!datos) return null;
  if (datos.alumnos.length === 0) {
    return <p className="py-3 text-xs text-zinc-400">Esta clase no tiene alumnado activo.</p>;
  }

  const ids = datos.alumnos.map((a) => a.id);
  const cuentas = repartoPorTutor(ids, reparto, tutorIds);
  const huecos = sinTutorPersonal(ids, reparto);
  const cortes = new Set(cortesDeReparto(ids, reparto));
  const indiceDe = (teacherId: string | null | undefined) =>
    teacherId ? tutorIds.indexOf(teacherId) : -1;

  return (
    <div className="anim-up mt-2.5 space-y-2 border-t border-zinc-100 pt-2.5 dark:border-zinc-800">
      {/* Quién lleva a cuántos */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {tutores.map((t, i) => (
          <span key={t.teacherId} className="inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
            <span className={`h-2 w-2 rounded-full ${COLORES[i % COLORES.length].punto}`} />
            {t.nombre} <strong className="tabular-nums">{cuentas[t.teacherId] ?? 0}</strong>
          </span>
        ))}
        {huecos > 0 && (
          <span className="inline-flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-300">
            <span className="h-2 w-2 rounded-full bg-amber-400/60 ring-1 ring-amber-500" />
            {huecos} sin asignar
          </span>
        )}
      </div>

      {/* Acciones rápidas del reparto */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <button
          type="button"
          onClick={() => aplicar(repartoPorMitades(ids, tutorIds))}
          className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-300"
        >
          <SplitSquareVertical className="h-3.5 w-3.5" />
          {tutores.length > 2 ? 'Repartir en partes iguales' : 'Repartir por mitades'}
        </button>
        <button
          type="button"
          onClick={() => aplicar(invertirReparto(reparto, tutorIds))}
          className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 font-medium text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          <ArrowUpDown className="h-3.5 w-3.5" /> Invertir el orden
        </button>
        {huecos > 0 && huecos < ids.length && (
          <button
            type="button"
            onClick={() => aplicar(completarHuecos(ids, reparto))}
            className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-800 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-300"
          >
            <UserPlus className="h-3.5 w-3.5" /> Completar los {huecos} que faltan
          </button>
        )}
        <button
          type="button"
          onClick={() => aplicar(Object.fromEntries(ids.map((id) => [id, null])))}
          className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 font-medium text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          <Eraser className="h-3.5 w-3.5" /> Limpiar
        </button>
        <span className="ml-auto text-zinc-400">
          {guardando ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Guardando…
            </span>
          ) : guardado ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <Check className="h-3 w-3" /> Guardado
            </span>
          ) : null}
        </span>
      </div>

      {datos.descolgados > 0 && (
        <p className="rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          {datos.descolgados} {datos.descolgados === 1 ? 'alumno tenía' : 'alumnos tenían'} como tutor personal a
          alguien que ya no tutoriza esta clase. Se ha dejado en blanco: reasígnalo.
        </p>
      )}

      <p className="text-[11px] leading-snug text-zinc-400">
        Toca la línea entre dos alumnos para cortar ahí: de ese punto hacia arriba son de un tutor y hacia abajo del
        otro. Y toca un nombre de tutor en cualquier fila para cambiar solo a ese alumno.
      </p>

      {/* La lista, en orden alfabético (el mismo que se usa para repartir) */}
      <ul className="rounded-xl bg-zinc-50 p-1.5 dark:bg-zinc-800/50">
        {datos.alumnos.map((a, i) => {
          const idx = indiceDe(reparto[a.id]);
          const color = idx >= 0 ? COLORES[idx % COLORES.length] : null;
          return (
            <li key={a.id}>
              {i > 0 && (
                <Corte
                  numero={i}
                  total={ids.length}
                  esCorte={cortes.has(i)}
                  arriba={tutores[indiceDe(reparto[datos.alumnos[i - 1].id])]?.nombre}
                  abajo={tutores[idx]?.nombre}
                  colorAbajo={color?.linea}
                  onCortar={() => aplicar(aplicarCorte(ids, tutorIds, reparto, i))}
                />
              )}
              <div className="flex items-center gap-2 py-0.5">
                <span className="w-5 shrink-0 text-right text-[11px] tabular-nums text-zinc-400">{i + 1}</span>
                <span
                  className={`min-w-0 flex-1 truncate text-xs ${
                    idx >= 0 ? 'text-zinc-800 dark:text-zinc-100' : 'text-zinc-500 italic dark:text-zinc-400'
                  }`}
                >
                  {a.nombre}
                </span>
                <span className="flex shrink-0 gap-1">
                  {tutores.map((t, j) => {
                    const activo = reparto[a.id] === t.teacherId;
                    const c = COLORES[j % COLORES.length];
                    return (
                      <button
                        key={t.teacherId}
                        type="button"
                        aria-pressed={activo}
                        title={`Tutor personal: ${t.nombre}`}
                        onClick={() =>
                          aplicar({ ...reparto, [a.id]: activo ? null : t.teacherId })
                        }
                        className={`rounded-full px-2 py-1 text-[11px] font-medium ring-1 transition-colors ${
                          activo ? c.activo : `bg-white ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700 ${c.suave}`
                        }`}
                      >
                        {etiquetaCorta(t.nombre)}
                      </button>
                    );
                  })}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Confirmación de "esto ya está revisado para este curso" */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {datos.confirmadoAt ? (
          <>
            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
              <Check className="h-3.5 w-3.5" /> Reparto confirmado el{' '}
              {new Date(datos.confirmadoAt).toLocaleDateString('es-ES')}
              {datos.confirmadoPor ? ` por ${datos.confirmadoPor}` : ''}
            </span>
            <button
              type="button"
              disabled={confirmando}
              onClick={() => void confirmar(false)}
              className="text-zinc-400 underline hover:text-zinc-600 disabled:opacity-50 dark:hover:text-zinc-300"
            >
              Quitar la confirmación
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={confirmando || guardando}
            onClick={() => void confirmar(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {confirmando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Confirmar el reparto de este curso
          </button>
        )}
      </div>
    </div>
  );
}

/** Franja tocable entre dos alumnos: "de aquí hacia arriba, uno; hacia abajo, el otro". */
function Corte({
  numero,
  total,
  esCorte,
  arriba,
  abajo,
  colorAbajo,
  onCortar,
}: {
  numero: number;
  total: number;
  esCorte: boolean;
  arriba?: string;
  abajo?: string;
  colorAbajo?: string;
  onCortar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onCortar}
      aria-label={`Cortar aquí: los ${numero} de arriba para un tutor y los ${total - numero} de abajo para otro`}
      className="group relative flex h-5 w-full items-center px-1"
    >
      <span
        className={
          esCorte
            ? `h-0.5 w-full rounded-full ${colorAbajo ?? 'bg-zinc-400'}`
            : 'h-px w-full bg-zinc-200 transition-colors group-hover:bg-zinc-400 dark:bg-zinc-700 dark:group-hover:bg-zinc-500'
        }
      />
      {esCorte && arriba && abajo && (
        <span className="absolute left-6 rounded-full bg-white px-1.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
          ↑ {etiquetaCorta(arriba)} · ↓ {etiquetaCorta(abajo)}
        </span>
      )}
      <Scissors
        className={`absolute right-1.5 h-3 w-3 transition-colors ${
          esCorte ? 'text-zinc-400' : 'text-zinc-300 group-hover:text-zinc-500 dark:text-zinc-600'
        }`}
      />
    </button>
  );
}
