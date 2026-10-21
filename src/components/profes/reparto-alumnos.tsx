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
import { Button } from '@/components/ui/button';
import { Estado } from '@/components/ui/estado';
import { Aviso } from '@/components/ui/aviso';
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

// Un color por tutor (hasta tres: David confirma que más no va a haber). Son colores de
// categoría (de quién es cada alumno): tinte suave y sin verde, ámbar ni rojo, que son estados.
const COLORES = [
  {
    activo:
      'bg-sky-100 font-semibold text-sky-900 ring-2 ring-sky-500 dark:bg-sky-500/20 dark:text-sky-100 dark:ring-sky-400',
    linea: 'bg-sky-500',
  },
  {
    activo:
      'bg-violet-100 font-semibold text-violet-900 ring-2 ring-violet-500 dark:bg-violet-500/20 dark:text-violet-100 dark:ring-violet-400',
    linea: 'bg-violet-500',
  },
  {
    activo:
      'bg-fuchsia-100 font-semibold text-fuchsia-900 ring-2 ring-fuchsia-500 dark:bg-fuchsia-500/20 dark:text-fuchsia-100 dark:ring-fuchsia-400',
    linea: 'bg-fuchsia-500',
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
  const [enElAire, setEnElAire] = useState<number | null>(null); // corte bajo el ratón (vista previa)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ultimaFila = useRef<number | null>(null); // para el clic con Mayúsculas (tramos)

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
      <p className="flex items-center gap-2 py-3 text-sm text-zinc-500 dark:text-zinc-400">
        <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Cargando el alumnado de la clase…
      </p>
    );
  }
  if (!datos) return null;
  if (datos.alumnos.length === 0) {
    return <p className="py-3 text-sm text-zinc-500 dark:text-zinc-400">Esta clase no tiene alumnado activo.</p>;
  }

  const ids = datos.alumnos.map((a) => a.id);
  const cuentas = repartoPorTutor(ids, reparto, tutorIds);
  const huecos = sinTutorPersonal(ids, reparto);
  const cortes = new Set(cortesDeReparto(ids, reparto));
  const indiceDe = (teacherId: string | null | undefined) =>
    teacherId ? tutorIds.indexOf(teacherId) : -1;

  // Con el ratón por encima de una línea de corte se ve cómo quedaría ANTES de tocar: se
  // calcula con la misma función que se aplicaría, así que la vista previa no miente.
  const previa = enElAire === null ? null : aplicarCorte(ids, tutorIds, reparto, enElAire);
  const efectivo = previa ?? reparto;

  /** Un clic asigna a ese alumno; con Mayúsculas, a todo el tramo desde el último tocado. */
  function tocarChip(indice: number, teacherId: string, conMayusculas: boolean) {
    if (conMayusculas && ultimaFila.current !== null && ultimaFila.current !== indice) {
      const [desde, hasta] = [ultimaFila.current, indice].sort((a, b) => a - b);
      const nuevo = { ...reparto };
      for (let i = desde; i <= hasta; i++) nuevo[ids[i]] = teacherId;
      ultimaFila.current = indice;
      aplicar(nuevo);
      return;
    }
    ultimaFila.current = indice;
    aplicar({ ...reparto, [ids[indice]]: reparto[ids[indice]] === teacherId ? null : teacherId });
  }

  return (
    <div className="anim-up mt-3 space-y-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
      {/* Quién lleva a cuántos */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {tutores.map((t, i) => (
          <span key={t.teacherId} className="inline-flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
            <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${COLORES[i % COLORES.length].linea}`} />
            {t.nombre} <strong className="tabular-nums">{cuentas[t.teacherId] ?? 0}</strong>
          </span>
        ))}
        {huecos > 0 && <Estado tono="aviso">{huecos} sin asignar</Estado>}
      </div>

      {/* Acciones rápidas del reparto */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => aplicar(repartoPorMitades(ids, tutorIds))}>
          <SplitSquareVertical aria-hidden />
          {tutores.length > 2 ? 'Repartir en partes iguales' : 'Repartir por mitades'}
        </Button>
        <Button variant="outline" size="sm" onClick={() => aplicar(invertirReparto(reparto, tutorIds))}>
          <ArrowUpDown aria-hidden /> Invertir el orden
        </Button>
        {huecos > 0 && huecos < ids.length && (
          <Button variant="outline" size="sm" onClick={() => aplicar(completarHuecos(ids, reparto))}>
            <UserPlus aria-hidden /> Completar los {huecos} que faltan
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => aplicar(Object.fromEntries(ids.map((id) => [id, null])))}>
          <Eraser aria-hidden /> Limpiar
        </Button>
        <span className="ml-auto text-sm text-zinc-500 dark:text-zinc-400" aria-live="polite">
          {guardando ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Guardando…
            </span>
          ) : guardado ? (
            <Estado tono="ok" icono={<Check aria-hidden />}>
              Guardado
            </Estado>
          ) : null}
        </span>
      </div>

      {datos.descolgados > 0 && (
        <Aviso tono="aviso">
          {datos.descolgados} {datos.descolgados === 1 ? 'alumno tenía' : 'alumnos tenían'} como tutor personal a
          alguien que ya no tutoriza esta clase. Se ha dejado en blanco: reasígnalo.
        </Aviso>
      )}

      <p className="text-sm leading-snug text-zinc-600 dark:text-zinc-400">
        Toca la línea entre dos alumnos para cortar ahí: de ese punto hacia arriba son de un tutor y hacia abajo del
        otro (con ratón, al pasar por encima se ve cómo quedaría). Y toca un tutor en cualquier fila para cambiar solo
        a ese alumno, o con <kbd className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">Mayús</kbd> para asignar de
        golpe todo el tramo desde el último que tocaste.
      </p>

      {/* La lista, en orden alfabético (el mismo que se usa para repartir) */}
      <ul className="rounded-xl bg-zinc-50 p-1.5 dark:bg-zinc-800/50">
        {datos.alumnos.map((a, i) => {
          const idx = indiceDe(efectivo[a.id]);
          const color = idx >= 0 ? COLORES[idx % COLORES.length] : null;
          const cambiaEnLaPrevia = previa !== null && previa[a.id] !== reparto[a.id];
          return (
            <li key={a.id}>
              {i > 0 && (
                <Corte
                  numero={i}
                  total={ids.length}
                  esCorte={cortes.has(i)}
                  arriba={tutores[indiceDe(efectivo[datos.alumnos[i - 1].id])]?.nombre}
                  abajo={tutores[idx]?.nombre}
                  colorAbajo={color?.linea}
                  enElAire={enElAire === i}
                  onCortar={() => aplicar(aplicarCorte(ids, tutorIds, reparto, i))}
                  onEntrar={() => setEnElAire(i)}
                  onSalir={() => setEnElAire((n) => (n === i ? null : n))}
                />
              )}
              <div className="flex items-center gap-2">
                {/* Barra de color: quién lleva a este alumno de un vistazo, sin leer chips */}
                <span
                  aria-hidden
                  className={`h-6 w-1 shrink-0 rounded-full transition-colors ${color?.linea ?? 'bg-zinc-200 dark:bg-zinc-700'} ${
                    cambiaEnLaPrevia ? 'opacity-60' : ''
                  }`}
                />
                <span className="w-5 shrink-0 text-right text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{i + 1}</span>
                <span
                  className={`min-w-0 flex-1 truncate text-sm ${
                    indiceDe(reparto[a.id]) >= 0
                      ? 'text-zinc-800 dark:text-zinc-100'
                      : 'text-zinc-500 italic dark:text-zinc-400'
                  }`}
                >
                  {a.nombre}
                </span>
                <span className="flex shrink-0 gap-1.5">
                  {tutores.map((t, j) => {
                    const activo = reparto[a.id] === t.teacherId;
                    const c = COLORES[j % COLORES.length];
                    return (
                      <button
                        key={t.teacherId}
                        type="button"
                        aria-pressed={activo}
                        aria-label={`${t.nombre} para ${a.nombre}`}
                        onClick={(e) => tocarChip(i, t.teacherId, e.shiftKey)}
                        className={`h-10 cursor-pointer rounded-full px-3 text-xs outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 ${
                          activo
                            ? c.activo
                            : 'bg-white font-medium text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700 dark:hover:bg-zinc-800'
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
      <div className="flex flex-wrap items-center gap-2">
        {datos.confirmadoAt ? (
          <>
            <Estado tono="ok" icono={<Check aria-hidden />}>
              Reparto confirmado el {new Date(datos.confirmadoAt).toLocaleDateString('es-ES')}
              {datos.confirmadoPor ? ` por ${datos.confirmadoPor}` : ''}
            </Estado>
            <Button variant="ghost" size="sm" disabled={confirmando} onClick={() => void confirmar(false)}>
              Quitar la confirmación
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            cargando={confirmando}
            disabled={guardando}
            onClick={() => void confirmar(true)}
          >
            {!confirmando && <Check aria-hidden />}
            Confirmar el reparto de este curso
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Franja entre dos alumnos: "de aquí hacia arriba, uno; hacia abajo, el otro".
 *
 * Con ratón se comporta como una regla que se recorre: al pasar por encima se ilumina y la
 * lista entera enseña cómo quedaría (la vista previa la calcula el padre). En táctil no hay
 * hover, así que la tijera y la línea se ven siempre y basta con tocar.
 */
function Corte({
  numero,
  total,
  esCorte,
  arriba,
  abajo,
  colorAbajo,
  enElAire,
  onCortar,
  onEntrar,
  onSalir,
}: {
  numero: number;
  total: number;
  esCorte: boolean;
  arriba?: string;
  abajo?: string;
  colorAbajo?: string;
  enElAire: boolean;
  onCortar: () => void;
  onEntrar: () => void;
  onSalir: () => void;
}) {
  const etiqueta = enElAire || esCorte;
  return (
    <button
      type="button"
      onClick={onCortar}
      onMouseEnter={onEntrar}
      onMouseLeave={onSalir}
      onFocus={onEntrar}
      onBlur={onSalir}
      aria-label={`Cortar aquí: los ${numero} de arriba para un tutor y los ${total - numero} de abajo para otro`}
      className="group relative flex h-6 w-full cursor-pointer items-center rounded-md px-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span
        className={
          esCorte || enElAire
            ? `h-0.5 w-full rounded-full ${colorAbajo ?? 'bg-zinc-400'} ${enElAire && !esCorte ? 'opacity-70' : ''}`
            : 'h-px w-full bg-zinc-200 transition-colors dark:bg-zinc-700'
        }
      />
      {etiqueta && arriba && abajo && (
        <span className="absolute left-7 whitespace-nowrap rounded-full bg-white px-2 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700">
          {numero} ↑ {etiquetaCorta(arriba)} · {total - numero} ↓ {etiquetaCorta(abajo)}
        </span>
      )}
      <Scissors
        aria-hidden
        className={`absolute right-1.5 h-3.5 w-3.5 transition-colors ${
          esCorte || enElAire ? 'text-zinc-500 dark:text-zinc-300' : 'text-zinc-300 dark:text-zinc-600'
        }`}
      />
    </button>
  );
}
