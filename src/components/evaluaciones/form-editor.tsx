'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BarChart3, Check, ChevronDown, ChevronUp, Copy, ExternalLink, Eye, Link2, ListPlus,
  Loader2, Lock, Plus, Send, Settings2, Sparkles, Trash2, TriangleAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { etapaDeCurso } from '@/lib/cursos';
import { AUDIENCIAS, CATALOGO, claseLabel, huecosPendientes, opcionesAcademicYear, type Audiencia } from '@/lib/evaluaciones';
import type { EvalQuestion } from '@/db/schema';
import type { FormCompleto } from '@/lib/evaluaciones-server';
import { QuestionCard } from '@/components/evaluaciones/question-card';
import { ActividadColorButton, ColorDotButton } from '@/components/evaluaciones/color-picker';
import {
  BTN_ICONO,
  BTN_PRIMARIO,
  BTN_SUAVE,
  CAMPO,
  CAMPO_TITULO,
  Dato,
  GuiaActividad,
  PANEL,
  Plegable,
  Rotulo,
  Segmentado,
} from '@/components/evaluaciones/ui';

/** Letra de posición dentro del formulario: A, B, C… Z, AA, AB… (por si acaso). */
function letraDeIndice(i: number): string {
  let n = i;
  let letra = '';
  do {
    letra = String.fromCharCode(65 + (n % 26)) + letra;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letra;
}

// Tiempo que se espera antes de confirmar un borrado en el servidor: mientras tanto
// el toast ofrece "Deshacer" y el elemento solo se OCULTA (sigue en el estado local,
// no se ha tocado el servidor), así que deshacer es gratis y no hay nada que revertir.
const GRACIA_BORRADO_MS = 4500;

interface Props {
  inicial: FormCompleto;
  clases: { curso: string; letra: string | null }[];
  actividades: { id: string; nombre: string }[];
  respuestas: number;
  baseUrl: string;
  academicYearActual: string;
}

const claseKey = (c: { curso: string; letra: string | null }) => `${c.curso}|${c.letra ?? ''}`;

export function FormEditor({ inicial, clases, actividades, respuestas, baseUrl, academicYearActual }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormCompleto>(inicial);
  const [ocupado, setOcupado] = useState(false);
  const [ajustes, setAjustes] = useState(false);
  const [anadiendo, setAnadiendo] = useState(false);
  const [nuevaActividad, setNuevaActividad] = useState('');
  const arrastrando = useRef<{ blockId: string; id: string } | null>(null);
  const sobre = useRef<string | null>(null);
  // Bloques/preguntas "eliminados" que en realidad siguen en `form` tal cual: solo se
  // ocultan del render mientras corre el plazo de deshacer. El servidor no se entera
  // hasta que el plazo expira sin que se pulse "Deshacer".
  const [bloquesOcultos, setBloquesOcultos] = useState<Set<string>>(new Set());
  const [preguntasOcultas, setPreguntasOcultas] = useState<Set<string>>(new Set());
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // El borrado diferido sigue su curso aunque se navegue fuera de la página (es lo
  // esperable: "eliminar y salir" no debería deshacer el eliminar), pero el estado de
  // React ya no está para recibirlo — este flag evita el warning de setState fantasma.
  const montado = useRef(true);
  useEffect(
    () => () => {
      montado.current = false;
    },
    [],
  );

  const audiencia = form.audiencia as Audiencia;
  const bloqueada = respuestas > 0;
  const enlace = `${baseUrl}/evaluaciones/${form.token}`;
  const pendientesRevision = useMemo(
    () => form.bloques.reduce((n, b) => n + b.preguntas.filter((q) => q.revisar).length, 0),
    [form],
  );
  // Frases del preset que se han quedado a medias ("¿Te ha servido para…"). Mientras
  // haya una, la evaluación no se puede abrir: el servidor también lo rechaza.
  const huecos = useMemo(
    () =>
      huecosPendientes(
        form.bloques.flatMap((b) => b.preguntas.map((q) => ({ id: q.id, texto: q.texto, filas: q.filas }))),
      ),
    [form],
  );

  async function estructura(payload: Record<string, unknown>) {
    setOcupado(true);
    try {
      const res = await fetch(`/api/evaluaciones/admin/forms/${form.id}/estructura`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo guardar');
      setForm(data.form);
    } catch (e) {
      haptic.warning();
      toast.error(e instanceof Error ? e.message : 'Error inesperado');
    } finally {
      setOcupado(false);
    }
  }

  async function patchForm(cambios: Record<string, unknown>, aviso?: string) {
    setForm((f) => ({ ...f, ...cambios }) as FormCompleto);
    const res = await fetch(`/api/evaluaciones/admin/forms/${form.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cambios),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? 'No se pudo guardar');
      return;
    }
    if (aviso) toast.success(aviso);
    router.refresh();
  }

  async function duplicar(opts: Record<string, unknown>) {
    setOcupado(true);
    try {
      const res = await fetch(`/api/evaluaciones/admin/forms/${form.id}/duplicar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo duplicar');
      haptic.success();
      toast.success('Copia creada');
      router.push(`/gestion/evaluaciones/${data.form.id}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error inesperado');
    } finally {
      setOcupado(false);
    }
  }

  /** Borra ya mismo en la BBDD, sin pasar por la papelera de deshacer (uso interno). */
  async function estructuraSilenciosa(payload: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/evaluaciones/admin/forms/${form.id}/estructura`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && montado.current) setForm(data.form);
    } catch {
      // Si falla el borrado silencioso el elemento reaparece solo (sigue en `form`);
      // no hace falta un toast de error para algo que el usuario ya no está mirando.
    }
  }

  function borrarBloqueConDeshacer(bloque: FormCompleto['bloques'][number]) {
    haptic.warning();
    setBloquesOcultos((s) => new Set(s).add(bloque.id));
    timers.current[bloque.id] = setTimeout(() => {
      delete timers.current[bloque.id];
      void estructuraSilenciosa({ accion: 'bloque.remove', blockId: bloque.id });
      if (montado.current) {
        setBloquesOcultos((s) => {
          const n = new Set(s);
          n.delete(bloque.id);
          return n;
        });
      }
    }, GRACIA_BORRADO_MS);
    toast(`"${bloque.titulo}" eliminada del formulario`, {
      duration: GRACIA_BORRADO_MS,
      action: {
        label: 'Deshacer',
        onClick: () => {
          clearTimeout(timers.current[bloque.id]);
          delete timers.current[bloque.id];
          setBloquesOcultos((s) => {
            const n = new Set(s);
            n.delete(bloque.id);
            return n;
          });
          haptic.tap();
        },
      },
    });
  }

  function borrarPreguntaConDeshacer(pregunta: EvalQuestion) {
    haptic.warning();
    setPreguntasOcultas((s) => new Set(s).add(pregunta.id));
    timers.current[pregunta.id] = setTimeout(() => {
      delete timers.current[pregunta.id];
      void estructuraSilenciosa({ accion: 'pregunta.remove', questionId: pregunta.id });
      if (montado.current) {
        setPreguntasOcultas((s) => {
          const n = new Set(s);
          n.delete(pregunta.id);
          return n;
        });
      }
    }, GRACIA_BORRADO_MS);
    toast('Pregunta eliminada', {
      duration: GRACIA_BORRADO_MS,
      action: {
        label: 'Deshacer',
        onClick: () => {
          clearTimeout(timers.current[pregunta.id]);
          delete timers.current[pregunta.id];
          setPreguntasOcultas((s) => {
            const n = new Set(s);
            n.delete(pregunta.id);
            return n;
          });
          haptic.tap();
        },
      },
    });
  }

  /** Cambia el color de la actividad: optimista en el badge, PATCH en segundo plano. */
  function cambiarColorActividad(bloque: FormCompleto['bloques'][number], color: string) {
    if (!bloque.activityId || !bloque.actividad) return;
    haptic.tap();
    setForm((f) => ({
      ...f,
      bloques: f.bloques.map((b) => (b.id === bloque.id && b.actividad ? { ...b, actividad: { ...b.actividad, color } } : b)),
    }));
    void fetch(`/api/evaluaciones/admin/actividades/${bloque.activityId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color }),
    }).then((res) => {
      if (!res.ok) toast.error('No se pudo guardar el color');
    });
  }

  /** Intercambia dos preguntas por id dentro de un bloque (a prueba de huecos ocultos). */
  function moverPregunta(blockId: string, preguntaId: string, vecinoId: string | undefined) {
    if (!vecinoId) return;
    const bloque = form.bloques.find((x) => x.id === blockId);
    if (!bloque) return;
    const ids = bloque.preguntas.map((q) => q.id);
    const i = ids.indexOf(preguntaId);
    const j = ids.indexOf(vecinoId);
    if (i === -1 || j === -1) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    haptic.tap();
    void estructura({ accion: 'pregunta.reorder', blockId, ids });
  }

  /** Igual que arriba pero para el orden de los bloques dentro del formulario. */
  function moverBloque(bloqueId: string, vecinoId: string | undefined) {
    if (!vecinoId) return;
    const ids = form.bloques.map((x) => x.id);
    const i = ids.indexOf(bloqueId);
    const j = ids.indexOf(vecinoId);
    if (i === -1 || j === -1) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    haptic.tap();
    void estructura({ accion: 'bloque.reorder', ids });
  }

  function soltar(blockId: string, idsVisibles: string[]) {
    const origen = arrastrando.current;
    const destinoId = sobre.current;
    arrastrando.current = null;
    sobre.current = null;
    if (!origen || !destinoId || origen.blockId !== blockId || origen.id === destinoId) return;
    const copia = idsVisibles.filter((x) => x !== origen.id);
    const idx = copia.indexOf(destinoId);
    copia.splice(idx < 0 ? copia.length : idx, 0, origen.id);
    void estructura({ accion: 'pregunta.reorder', blockId, ids: copia });
  }

  const bloquesVisibles = useMemo(() => form.bloques.filter((b) => !bloquesOcultos.has(b.id)), [form.bloques, bloquesOcultos]);

  const clasesPorEtapa = useMemo(() => {
    // Secundaria primero: es quien responde de verdad las evaluaciones. Infantil,
    // que casi nunca aplica, queda abajo en vez de comerse la primera pantalla.
    const grupos: { etapa: string; label: string; clases: typeof clases }[] = [
      { etapa: 'ESO', label: 'Secundaria', clases: [] },
      { etapa: 'EP', label: 'Primaria', clases: [] },
      { etapa: 'EI', label: 'Infantil', clases: [] },
    ];
    for (const c of clases) {
      const g = grupos.find((x) => x.etapa === etapaDeCurso(c.curso));
      if (g) g.clases.push(c);
    }
    return grupos.filter((g) => g.clases.length > 0);
  }, [clases]);

  const catalogoAudiencia = CATALOGO.filter((c) => c.audiencias.includes(audiencia));

  return (
    <div className="anim-stagger space-y-4">
      {/* ── Cabecera ──────────────────────────────────────────────────────────
         Antes: chips + título + descripción + 3 botones de estado + 4 acciones,
         todo apilado con el mismo peso. Ahora hay tres franjas con jerarquía
         distinta: identidad (color + título), contexto (datos en gris) y acciones
         (estado a la izquierda, lo que se hace con el formulario a la derecha). */}
      <div className={`${PANEL} overflow-hidden`}>
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-2.5">
            {/* Color del FORMULARIO, no de una actividad: viste el botón de enviar, la
               barra de progreso y el fondo de la página pública entera. */}
            <span className="mt-2 shrink-0">
              <ColorDotButton color={form.color} etiqueta="Color del formulario" onChange={(color) => void patchForm({ color })} />
            </span>
            <div className="min-w-0 flex-1">
              <input
                defaultValue={form.titulo}
                onBlur={(e) => e.target.value !== form.titulo && void patchForm({ titulo: e.target.value })}
                className={CAMPO_TITULO}
              />
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 px-2">
                <Dato etiqueta="Responde">
                  {AUDIENCIAS.find((a) => a.value === audiencia)?.emoji} {AUDIENCIAS.find((a) => a.value === audiencia)?.label}
                </Dato>
                <Dato etiqueta="Curso">{form.academicYear}</Dato>
                <Dato etiqueta="Respuestas">{respuestas}</Dato>
              </div>
            </div>
          </div>

          <textarea
            defaultValue={form.descripcion ?? ''}
            rows={2}
            placeholder="Texto de presentación que ve quien responde"
            onBlur={(e) => e.target.value !== (form.descripcion ?? '') && void patchForm({ descripcion: e.target.value || null })}
            className={`${CAMPO} mt-3`}
          />
        </div>

        {/* Barra de acciones: separada del contenido por una línea, no por aire, para
           que se lea como "la botonera de este formulario" y no como una fila más. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-zinc-100 bg-zinc-50/60 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/20 sm:px-5">
          <Segmentado
            valor={form.estado as 'borrador' | 'abierto' | 'cerrado'}
            onChange={(e) => {
              haptic.tap();
              void patchForm({ estado: e }, e === 'abierto' ? 'Evaluación abierta: ya se puede responder' : undefined);
            }}
            opciones={[
              { valor: 'borrador', label: 'borrador' },
              {
                valor: 'abierto',
                label: 'abierto',
                tono: 'verde',
                deshabilitada: huecos.length > 0,
                pista: huecos.length > 0 ? 'Termina primero las frases que quedan a medias' : undefined,
              },
              { valor: 'cerrado', label: 'cerrado' },
            ]}
          />

          <div className="ml-auto flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(enlace);
                haptic.success();
                toast.success('Enlace copiado');
              }}
              className={BTN_SUAVE}
            >
              <Link2 className="h-3.5 w-3.5" /> Enlace
            </button>
            <Link href={`/evaluaciones/${form.token}`} target="_blank" className={BTN_SUAVE}>
              <Eye className="h-3.5 w-3.5" /> Previsualizar
              <ExternalLink className="h-3 w-3 opacity-60" />
            </Link>
            <Link href={`/gestion/evaluaciones/${form.id}/resultados`} className={BTN_SUAVE}>
              <BarChart3 className="h-3.5 w-3.5" /> Resultados
            </Link>
            <Link href={`/gestion/evaluaciones/${form.id}/enviar`} className={`${BTN_PRIMARIO} ml-1`}>
              <Send className="h-3.5 w-3.5" /> Enviar
            </Link>
          </div>
        </div>

        {/* Avisos: pegados abajo del panel y a todo el ancho, para que se lean como
           un estado del formulario y no como otra tarjeta suelta más. */}
        {huecos.length > 0 ? (
          <div className="border-t border-amber-200/70 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200 sm:px-5">
            <p className="flex items-center gap-2 font-semibold">
              <TriangleAlert className="h-4 w-4 shrink-0" />
              {huecos.length === 1 ? 'Falta terminar una frase' : `Faltan ${huecos.length} frases por terminar`} para poder abrirla
            </p>
            <p className="mt-1 text-amber-800/90 dark:text-amber-300/90">
              El preset las deja a medias a propósito: una evaluación con la pregunta genérica no la contesta nadie con
              cabeza. Termínalas y el botón de &quot;abierto&quot; se activa solo.
            </p>
            <ul className="mt-2 space-y-0.5">
              {huecos.slice(0, 6).map((h, i) => (
                <li key={`${h.questionId}-${i}`} className="font-medium">
                  · {h.texto}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          pendientesRevision > 0 && (
            <p className="flex items-center gap-2 border-t border-amber-200/70 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300 sm:px-5">
              <TriangleAlert className="h-4 w-4 shrink-0" />
              Quedan {pendientesRevision} pregunta(s) del preset por adaptar: son las marcadas en ámbar.
            </p>
          )
        )}
        {bloqueada && (
          <p className="flex items-center gap-2 border-t border-zinc-100 px-4 py-2.5 text-xs text-zinc-500 dark:border-zinc-800 sm:px-5">
            <Lock className="h-3.5 w-3.5 shrink-0" /> Ya hay respuestas: puedes retocar textos, pero no borrar preguntas ni
            cambiar su tipo.
          </p>
        )}
      </div>

      {/* ── Ajustes del formulario ─────────────────────────────────────────── */}
      <Plegable titulo="Ajustes" icono={<Settings2 className="h-4 w-4 text-zinc-400" />} abierto={ajustes} onToggle={() => setAjustes((v) => !v)}>
          <div className="space-y-5">
            {audiencia === 'alumnos' && (
              <div>
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Clases que la responden</p>
                <p className="mb-2.5 text-xs text-zinc-500">Marca el objetivo para saber quién falta y segmentar resultados.</p>
                <div className="space-y-2.5">
                  {clasesPorEtapa.map((g) => (
                    <div key={g.etapa}>
                      <Rotulo className="mb-1.5">{g.label}</Rotulo>
                      <div className="flex flex-wrap gap-1.5">
                        {g.clases.map((c) => {
                          const activa = (form.clases ?? []).some((x) => claseKey(x) === claseKey(c));
                          return (
                            <button
                              key={claseKey(c)}
                              type="button"
                              onClick={() => {
                                const siguiente = activa
                                  ? (form.clases ?? []).filter((x) => claseKey(x) !== claseKey(c))
                                  : [...(form.clases ?? []), { curso: c.curso, letra: c.letra }];
                                void patchForm({ clases: siguiente });
                              }}
                              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                                activa
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
                              }`}
                            >
                              {claseLabel(c)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-zinc-50 p-3 transition-colors duration-150 hover:bg-zinc-100 dark:bg-zinc-800/40 dark:hover:bg-zinc-800/70">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={form.pedirClase}
                  onChange={(e) => void patchForm({ pedirClase: e.target.checked })}
                />
                <span>
                  <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">Preguntar la clase</span>
                  <span className="block text-xs text-zinc-500">
                    Si el enlace es personalizado no hace falta: la clase ya se sabe y se ahorra un toque.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-zinc-50 p-3 transition-colors duration-150 hover:bg-zinc-100 dark:bg-zinc-800/40 dark:hover:bg-zinc-800/70">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={form.pedirEtapa}
                  onChange={(e) => void patchForm({ pedirEtapa: e.target.checked })}
                />
                <span>
                  <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">Preguntar la etapa</span>
                  <span className="block text-xs text-zinc-500">Infantil / Primaria / Secundaria. Lo típico en profesorado.</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-zinc-50 p-3 transition-colors duration-150 hover:bg-zinc-100 dark:bg-zinc-800/40 dark:hover:bg-zinc-800/70">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={form.requiereLogin}
                  onChange={(e) => void patchForm({ requiereLogin: e.target.checked })}
                />
                <span>
                  <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">Exigir cuenta del colegio</span>
                  <span className="block text-xs text-zinc-500">Solo se puede responder con la sesión iniciada. No guarda quién.</span>
                </span>
              </label>
              {audiencia !== 'profesores' && (
                <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-zinc-50 p-3 transition-colors duration-150 hover:bg-zinc-100 dark:bg-zinc-800/40 dark:hover:bg-zinc-800/70">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={form.identificaAlumno}
                    onChange={(e) => void patchForm({ identificaAlumno: e.target.checked })}
                  />
                  <span>
                    <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">Enlaces personalizados</span>
                    <span className="block text-xs text-zinc-500">
                      Cada alumno recibe su enlace. En pantalla es anónimo; internamente queda registrado de quién viene, por si hay
                      que revisar algo.
                    </span>
                  </span>
                </label>
              )}
            </div>

            <div>
              <Rotulo className="mb-1.5">Aviso de anonimato (pie del formulario)</Rotulo>
              <textarea
                defaultValue={form.avisoAnonimato ?? ''}
                rows={2}
                onBlur={(e) => e.target.value !== (form.avisoAnonimato ?? '') && void patchForm({ avisoAnonimato: e.target.value || null })}
                className={CAMPO}
              />
            </div>
            <div>
              <Rotulo className="mb-1.5">Mensaje al terminar</Rotulo>
              <textarea
                defaultValue={form.mensajeFinal ?? ''}
                rows={2}
                onBlur={(e) => e.target.value !== (form.mensajeFinal ?? '') && void patchForm({ mensajeFinal: e.target.value || null })}
                className={CAMPO}
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <Rotulo className="mr-1">Duplicar</Rotulo>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => void duplicar({})}
                className={BTN_SUAVE}
              >
                <Copy className="h-3.5 w-3.5" /> Tal cual
              </button>
              {AUDIENCIAS.filter((a) => a.value !== audiencia).map((a) => (
                <button
                  key={a.value}
                  type="button"
                  disabled={ocupado}
                  onClick={() => void duplicar({ audiencia: a.value })}
                  className={BTN_SUAVE}
                >
                  <Sparkles className="h-3.5 w-3.5" /> Versión {a.label.toLowerCase()}
                </button>
              ))}
              {opcionesAcademicYear(academicYearActual)
                .filter((y) => y !== form.academicYear)
                .slice(0, 2)
                .map((y) => (
                  <button
                    key={y}
                    type="button"
                    disabled={ocupado}
                    onClick={() => void duplicar({ academicYear: y })}
                    className={BTN_SUAVE}
                  >
                    <Copy className="h-3.5 w-3.5" /> A {y}
                  </button>
                ))}
            </div>
          </div>
      </Plegable>

      {/* ── Bloques ──────────────────────────────────────────────────────────
         Cada actividad ya NO es una caja gris dentro del blanco (tres cajas
         anidadas con el mismo peso era justo lo que hacía que no se distinguiera
         nada). Ahora es: encabezado propio + una guía de color vertical que
         enhebra sus preguntas, y mucho aire entre actividades. */}
      <div className="space-y-10 pt-4">
        {bloquesVisibles.map((b, bi) => {
          const preguntasVisibles = b.preguntas.filter((q) => !preguntasOcultas.has(q.id));
          const idsVisibles = preguntasVisibles.map((q) => q.id);
          const colorBloque = b.actividad?.color ?? '#2563eb';
          return (
            <section key={b.id}>
              {/* Encabezado de la actividad */}
              <div className="flex items-start gap-2.5">
                <ActividadColorButton
                  letra={letraDeIndice(bi)}
                  color={b.actividad?.color ?? null}
                  disabled={!b.activityId}
                  onChange={(color) => cambiarColorActividad(b, color)}
                />
                <div className="min-w-0 flex-1">
                  <input
                    defaultValue={b.titulo}
                    onBlur={(e) => e.target.value !== b.titulo && void estructura({ accion: 'bloque.update', blockId: b.id, titulo: e.target.value })}
                    className={`${CAMPO_TITULO} !text-base`}
                  />
                  <textarea
                    defaultValue={b.intro ?? ''}
                    rows={2}
                    placeholder={
                      audiencia === 'profesores'
                        ? 'Objetivo de la actividad (se muestra encima de las preguntas)'
                        : 'Frase que explique de qué va, sin soltar el objetivo tal cual'
                    }
                    onBlur={(e) => e.target.value !== (b.intro ?? '') && void estructura({ accion: 'bloque.update', blockId: b.id, intro: e.target.value || null })}
                    className={`${CAMPO} mt-1`}
                  />
                </div>
                <div className="flex shrink-0 items-center">
                  <button
                    type="button"
                    disabled={bi === 0 || ocupado}
                    title="Subir actividad"
                    onClick={() => moverBloque(b.id, bloquesVisibles[bi - 1]?.id)}
                    className={BTN_ICONO}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={bi === bloquesVisibles.length - 1 || ocupado}
                    title="Bajar actividad"
                    onClick={() => moverBloque(b.id, bloquesVisibles[bi + 1]?.id)}
                    className={BTN_ICONO}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  {!bloqueada && (
                    <button
                      type="button"
                      disabled={ocupado}
                      title="Quitar del formulario"
                      onClick={() => borrarBloqueConDeshacer(b)}
                      className={`${BTN_ICONO} hover:!bg-rose-50 hover:!text-rose-600 dark:hover:!bg-rose-500/10`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Preguntas, enhebradas por la guía del color de la actividad */}
              <div className="mt-3">
                <GuiaActividad color={colorBloque}>
                  <div className="space-y-2">
                    {preguntasVisibles.map((q, qi) => (
                      <QuestionCard
                        key={q.id}
                        pregunta={q}
                        indice={qi}
                        total={preguntasVisibles.length}
                        ocupado={ocupado}
                        bloqueada={bloqueada}
                        color={colorBloque}
                        onPatch={(cambios: Partial<EvalQuestion>) => void estructura({ accion: 'pregunta.update', questionId: q.id, ...cambios })}
                        onDuplicar={() => void estructura({ accion: 'pregunta.duplicate', questionId: q.id })}
                        onBorrar={() => borrarPreguntaConDeshacer(q)}
                        onMover={(delta) => {
                          const destino = qi + delta;
                          if (destino < 0 || destino >= preguntasVisibles.length) return;
                          moverPregunta(b.id, q.id, preguntasVisibles[destino].id);
                        }}
                        onDragStart={() => (arrastrando.current = { blockId: b.id, id: q.id })}
                        onDragOver={() => (sobre.current = q.id)}
                        onDrop={() => soltar(b.id, idsVisibles)}
                      />
                    ))}
                  </div>

                  {/* Añadir preguntas: en gris, porque es andamiaje, no contenido */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-1">
                    {preguntasVisibles.length === 0 && (
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => void estructura({ accion: 'pregunta.preset', blockId: b.id })}
                        className={`${BTN_PRIMARIO} mr-1`}
                      >
                        <Sparkles className="h-3.5 w-3.5" /> Poner las preguntas de siempre
                      </button>
                    )}
                    <Rotulo className="mr-1">Añadir</Rotulo>
                    {(['escala', 'texto', 'opcion', 'quiz'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        disabled={ocupado}
                        onClick={() => void estructura({ accion: 'pregunta.add', blockId: b.id, tipo: t })}
                        className={BTN_SUAVE}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {t === 'escala' ? 'Escala' : t === 'texto' ? 'Texto' : t === 'opcion' ? 'Opciones' : 'Quiz'}
                      </button>
                    ))}
                    <details className="relative">
                      <summary className={`${BTN_SUAVE} cursor-pointer list-none`}>
                        <ListPlus className="h-3.5 w-3.5" /> Del catálogo
                      </summary>
                      {/* Se abre hacia ARRIBA y con z-index alto a propósito: cada bloque anima su
                         entrada (anim-stagger) y eso crea su propio contexto de apilamiento, así que
                         un desplegable normal hacia abajo queda tapado por el bloque siguiente. Abrir
                         hacia arriba lo mantiene dentro del mismo bloque, donde sí gana. */}
                      <div className="absolute bottom-full z-40 mb-1 w-72 rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700">
                        {catalogoAudiencia.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            disabled={ocupado}
                            onClick={() => void estructura({ accion: 'pregunta.add', blockId: b.id, catalogoId: c.id })}
                            className="block w-full rounded-lg px-2.5 py-2 text-left text-xs text-zinc-700 transition-colors duration-150 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                          >
                            {c.nombre}
                          </button>
                        ))}
                      </div>
                    </details>
                    {ocupado && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />}
                  </div>
                </GuiaActividad>
              </div>
            </section>
          );
        })}
      </div>

      {/* ── Añadir actividad al formulario ─────────────────────────────────── */}
      {anadiendo ? (
        <div className={`${PANEL} p-4`}>
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Añadir otra actividad</p>
          <p className="mb-2.5 text-xs text-zinc-500">Escribe el nombre y pulsa Enter.</p>
          <div className="flex gap-2">
            <input
              value={nuevaActividad}
              autoFocus
              onChange={(e) => setNuevaActividad(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && nuevaActividad.trim().length > 1) {
                  void estructura({ accion: 'bloque.add', nombre: nuevaActividad.trim() }).then(() => {
                    setNuevaActividad('');
                    setAnadiendo(false);
                  });
                }
              }}
              placeholder="Nombre de la actividad"
              className={CAMPO}
            />
            <button
              type="button"
              disabled={ocupado || nuevaActividad.trim().length < 2}
              onClick={() =>
                void estructura({ accion: 'bloque.add', nombre: nuevaActividad.trim() }).then(() => {
                  setNuevaActividad('');
                  setAnadiendo(false);
                })
              }
              className={`${BTN_PRIMARIO} shrink-0 px-4`}
            >
              <Check className="h-4 w-4" />
            </button>
          </div>
          {actividades.filter((a) => !form.bloques.some((b) => b.activityId === a.id)).length > 0 && (
            <>
              <Rotulo className="mb-1.5 mt-4">O una que ya existe</Rotulo>
              <div className="flex flex-wrap gap-1.5">
                {actividades
                  .filter((a) => !form.bloques.some((b) => b.activityId === a.id))
                  .map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      disabled={ocupado}
                      onClick={() => void estructura({ accion: 'bloque.add', activityId: a.id }).then(() => setAnadiendo(false))}
                      className="rounded-full bg-zinc-100 px-3 py-1.5 text-sm text-zinc-600 transition-colors duration-150 hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    >
                      {a.nombre}
                    </button>
                  ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAnadiendo(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-medium text-zinc-400 ring-1 ring-dashed ring-zinc-300 transition-colors duration-150 hover:text-blue-600 hover:ring-blue-400 dark:ring-zinc-700 dark:hover:text-blue-400"
        >
          <Plus className="h-4 w-4" /> Añadir otra actividad
        </button>
      )}
    </div>
  );
}
