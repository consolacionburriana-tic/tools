'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BarChart3, Check, ChevronDown, ChevronUp, Copy, ExternalLink, Eye, Link2, ListPlus,
  Loader2, Lock, Plus, Send, Settings2, Sparkles, Trash2, TriangleAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Campo } from '@/components/ui/campo';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Interruptor } from '@/components/ui/interruptor';
import { Segmentado } from '@/components/ui/segmentado';
import { Tarjeta } from '@/components/ui/tarjeta';
import { copiarTexto } from '@/components/ui/copiable';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { ETAPA_LABEL, ETAPAS, etapaDeCurso } from '@/lib/cursos';
import { CATALOGO, claseLabel, huecosPendientes, opcionesAcademicYear, type Audiencia } from '@/lib/evaluaciones';
import type { EvalQuestion } from '@/db/schema';
import type { FormCompleto, SectorGrupo } from '@/lib/evaluaciones-server';
import { BandaSector, SectoresTabs } from '@/components/evaluaciones/sectores';
import { EliminarEvaluacion } from '@/components/evaluaciones/eliminar-evaluacion';
import { QuestionCard } from '@/components/evaluaciones/question-card';
import { ActividadColorButton, ColorDotButton } from '@/components/evaluaciones/color-picker';
import { GuiaActividad, Plegable, Rotulo } from '@/components/evaluaciones/ui';

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
  /** Los otros formularios de la misma evaluación conjunta (vacío si va suelto). */
  sectores: SectorGrupo[];
}

const claseKey = (c: { curso: string; letra: string | null }) => `${c.curso}|${c.letra ?? ''}`;

export function FormEditor({ inicial, clases, actividades, respuestas, baseUrl, academicYearActual, sectores }: Props) {
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
  const conjunta = sectores.length > 1;
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
      toast.success(opts.grupo ? `Copiados ${data.forms?.length ?? ''} sectores` : 'Copia creada');
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
    // Bachillerato, aún más arriba: son los mayores. Se recorre ETAPAS al revés para que una etapa
    // nueva entre sola (si no, sus clases se descartarían en silencio).
    const grupos: { etapa: string; label: string; clases: typeof clases }[] = [...ETAPAS]
      .reverse()
      .map((etapa) => ({ etapa, label: ETAPA_LABEL[etapa], clases: [] }));
    for (const c of clases) {
      const g = grupos.find((x) => x.etapa === etapaDeCurso(c.curso));
      if (g) g.clases.push(c);
    }
    return grupos.filter((g) => g.clases.length > 0);
  }, [clases]);

  const catalogoAudiencia = CATALOGO.filter((c) => c.audiencias.includes(audiencia));

  const otrosAnios = opcionesAcademicYear(academicYearActual)
    .filter((y) => y !== form.academicYear)
    .slice(0, 2);
  const actividadesLibres = actividades.filter((a) => !form.bloques.some((b) => b.activityId === a.id));
  const volverTrasBorrar = conjunta
    ? `/gestion/evaluaciones/${sectores.find((x) => x.id !== form.id)?.id}`
    : '/gestion/evaluaciones';

  function anadirActividad() {
    if (nuevaActividad.trim().length < 2) return;
    void estructura({ accion: 'bloque.add', nombre: nuevaActividad.trim() }).then(() => {
      setNuevaActividad('');
      setAnadiendo(false);
    });
  }

  return (
    <div className="anim-stagger space-y-4">
      {/* ── Sectores ─────────────────────────────────────────────────────────
         Alumnado, profesorado y familias de la misma evaluación: un formulario
         cada uno, con sus preguntas y sus rasgos. Las pestañas dejan saltar de
         uno a otro y añadir el que falte sin volver al listado. */}
      <SectoresTabs
        sectores={sectores}
        actualId={form.id}
        destino="editor"
        anadirDesde={{ formId: form.id, audiencia }}
      />

      {/* ── Cabecera ──────────────────────────────────────────────────────────
         Tres franjas: identidad (color + título), contexto y acciones (estado a
         la izquierda, lo que se hace con el formulario a la derecha). */}
      <Tarjeta className="overflow-hidden">
        <BandaSector audiencia={audiencia} />
        <div className="space-y-3 p-4 sm:p-5">
          <div className="flex items-start gap-2">
            {/* Color del FORMULARIO, no de una actividad: viste el botón de enviar, la
               barra de progreso y el fondo de la página pública entera. */}
            <ColorDotButton color={form.color} etiqueta="Color del formulario" onChange={(color) => void patchForm({ color })} />
            <div className="min-w-0 flex-1">
              <Input
                aria-label="Título de la evaluación"
                defaultValue={form.titulo}
                onBlur={(e) => e.target.value !== form.titulo && void patchForm({ titulo: e.target.value })}
                className="text-lg font-semibold sm:text-lg"
              />
              <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
                <span>
                  Curso <span className="font-medium text-zinc-800 dark:text-zinc-200">{form.academicYear}</span>
                </span>
                <span>
                  Respuestas <span className="font-medium text-zinc-800 tabular-nums dark:text-zinc-200">{respuestas}</span>
                </span>
              </p>
            </div>
          </div>

          <Textarea
            aria-label="Texto de presentación"
            defaultValue={form.descripcion ?? ''}
            placeholder="Texto de presentación que ve quien responde"
            onBlur={(e) => e.target.value !== (form.descripcion ?? '') && void patchForm({ descripcion: e.target.value || null })}
            className="min-h-20"
          />
        </div>

        {/* La botonera del formulario, separada del contenido por una línea. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-zinc-100 bg-zinc-50/60 px-4 py-3 sm:px-5 dark:border-zinc-800 dark:bg-zinc-800/20">
          <Segmentado
            etiqueta="Estado de la evaluación"
            valor={form.estado as 'borrador' | 'abierto' | 'cerrado'}
            onChange={(e) => {
              if (e === form.estado) return;
              if (e === 'abierto' && huecos.length > 0) {
                haptic.warning();
                toast.warning('Termina primero las frases que quedan a medias');
                return;
              }
              void patchForm({ estado: e }, e === 'abierto' ? 'Evaluación abierta: ya se puede responder' : undefined);
            }}
            opciones={[
              { valor: 'borrador', etiqueta: 'Borrador' },
              { valor: 'abierto', etiqueta: 'Abierta' },
              { valor: 'cerrado', etiqueta: 'Cerrada' },
            ]}
          />

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                void copiarTexto(enlace).then((ok) => {
                  if (!ok) return;
                  haptic.success();
                  toast.success('Enlace copiado');
                })
              }
            >
              <Link2 aria-hidden /> Enlace
            </Button>
            <Link href={`/evaluaciones/${form.token}`} target="_blank" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              <Eye aria-hidden /> Previsualizar
              <ExternalLink aria-hidden className="size-3.5 opacity-60" />
            </Link>
            <Link href={`/gestion/evaluaciones/${form.id}/resultados`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <BarChart3 aria-hidden /> Resultados
            </Link>
            <Link href={`/gestion/evaluaciones/${form.id}/enviar`} className={buttonVariants({ size: 'sm' })}>
              <Send aria-hidden /> Enviar
            </Link>
            {/* A la vista y no solo en Ajustes: nadie buscaba "eliminar" dentro de un plegable. */}
            <EliminarEvaluacion
              formId={form.id}
              nombre={conjunta ? `el sector de ${audiencia === 'alumnos' ? 'alumnado' : audiencia === 'profesores' ? 'profesorado' : 'familias'}` : `«${form.titulo}»`}
              respuestas={respuestas}
              etiqueta={conjunta ? 'Eliminar este sector' : 'Eliminar la evaluación'}
              compacto
              volverA={volverTrasBorrar}
            />
          </div>
        </div>

        {/* Avisos: pegados abajo del panel y a todo el ancho, para que se lean como
           un estado del formulario y no como otra tarjeta suelta más. */}
        {huecos.length > 0 ? (
          <div className="border-t border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:px-5 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
            <p className="flex items-center gap-2 font-semibold">
              <TriangleAlert aria-hidden className="size-4 shrink-0" />
              {huecos.length === 1 ? 'Falta terminar una frase' : `Faltan ${huecos.length} frases por terminar`} para poder abrirla
            </p>
            <p className="mt-1">
              El preset las deja a medias a propósito: una evaluación con la pregunta genérica no la contesta nadie con
              cabeza. Termínalas y ya podrás abrirla.
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
            <p className="flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 sm:px-5 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
              <TriangleAlert aria-hidden className="size-4 shrink-0" />
              Quedan {pendientesRevision} pregunta(s) del preset por adaptar: son las marcadas en ámbar.
            </p>
          )
        )}
        {bloqueada && (
          <p className="flex items-center gap-2 border-t border-zinc-100 px-4 py-2.5 text-sm text-zinc-600 sm:px-5 dark:border-zinc-800 dark:text-zinc-400">
            <Lock aria-hidden className="size-4 shrink-0" /> Ya hay respuestas: puedes retocar textos, pero no borrar preguntas
            ni cambiar su tipo.
          </p>
        )}
      </Tarjeta>

      {/* ── Ajustes del formulario ─────────────────────────────────────────── */}
      <Plegable titulo="Ajustes" icono={<Settings2 aria-hidden className="text-zinc-500" />} abierto={ajustes} onToggle={() => setAjustes((v) => !v)}>
        <div className="space-y-5">
          {audiencia === 'alumnos' && (
            <div>
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Clases que la responden</p>
              <p className="mb-2.5 text-sm text-zinc-500 dark:text-zinc-400">
                Marca el objetivo para saber quién falta y segmentar resultados.
              </p>
              <div className="space-y-3">
                {clasesPorEtapa.map((g) => (
                  <div key={g.etapa}>
                    <Rotulo className="mb-1.5">{g.label}</Rotulo>
                    <Filtros etiqueta={`Clases de ${g.label}`}>
                      {g.clases.map((c) => {
                        const activa = (form.clases ?? []).some((x) => claseKey(x) === claseKey(c));
                        return (
                          <Filtro
                            key={claseKey(c)}
                            activo={activa}
                            onClick={() => {
                              const siguiente = activa
                                ? (form.clases ?? []).filter((x) => claseKey(x) !== claseKey(c))
                                : [...(form.clases ?? []), { curso: c.curso, letra: c.letra }];
                              void patchForm({ clases: siguiente });
                            }}
                          >
                            {claseLabel(c)}
                          </Filtro>
                        );
                      })}
                    </Filtros>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <Interruptor
              activo={form.pedirClase}
              onChange={(v) => void patchForm({ pedirClase: v })}
              etiqueta="Preguntar la clase"
              descripcion="Si el enlace es personalizado no hace falta: la clase ya se sabe y se ahorra un toque."
            />
            <Interruptor
              activo={form.pedirEtapa}
              onChange={(v) => void patchForm({ pedirEtapa: v })}
              etiqueta="Preguntar la etapa"
              descripcion="Infantil / Primaria / Secundaria. Lo típico en profesorado."
            />
            <Interruptor
              activo={form.requiereLogin}
              onChange={(v) => void patchForm({ requiereLogin: v })}
              etiqueta="Exigir cuenta del colegio"
              descripcion="Solo se puede responder con la sesión iniciada. No guarda quién."
            />
            {audiencia !== 'profesores' && (
              <Interruptor
                activo={form.identificaAlumno}
                onChange={(v) => void patchForm({ identificaAlumno: v })}
                etiqueta="Enlaces personalizados"
                descripcion="Cada alumno recibe su enlace. En pantalla es anónimo; internamente queda registrado de quién viene, por si hay que revisar algo."
              />
            )}
          </div>

          <Campo etiqueta="Aviso de anonimato (pie del formulario)" id="eval-aviso-anonimato">
            <Textarea
              id="eval-aviso-anonimato"
              defaultValue={form.avisoAnonimato ?? ''}
              onBlur={(e) => e.target.value !== (form.avisoAnonimato ?? '') && void patchForm({ avisoAnonimato: e.target.value || null })}
              className="min-h-20"
            />
          </Campo>
          <Campo etiqueta="Mensaje al terminar" id="eval-mensaje-final">
            <Textarea
              id="eval-mensaje-final"
              defaultValue={form.mensajeFinal ?? ''}
              onBlur={(e) => e.target.value !== (form.mensajeFinal ?? '') && void patchForm({ mensajeFinal: e.target.value || null })}
              className="min-h-20"
            />
          </Campo>

          <div className="space-y-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <Rotulo>Duplicar</Rotulo>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" disabled={ocupado} onClick={() => void duplicar({})}>
                <Copy aria-hidden /> Tal cual
              </Button>
              {otrosAnios.map((y) => (
                <Button
                  key={y}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={ocupado}
                  onClick={() => void duplicar({ academicYear: y })}
                >
                  <Copy aria-hidden /> {conjunta ? `Solo este sector a ${y}` : `A ${y}`}
                </Button>
              ))}
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              ¿La misma evaluación para otro colectivo? Añádelo desde las pestañas de arriba: se queda en la misma
              evaluación, con su propio preset.
            </p>
          </div>

          {/* Copiar la conjunta entera: todos los sectores, con una sola copia de cada
             actividad en el curso destino (misma serie → la comparativa entre años cuadra). */}
          {conjunta && (
            <div className="space-y-2">
              <Rotulo>Toda la evaluación</Rotulo>
              <div className="flex flex-wrap items-center gap-2">
                {otrosAnios.map((y) => (
                  <Button
                    key={y}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={ocupado}
                    onClick={() => void duplicar({ academicYear: y, grupo: true })}
                  >
                    <Copy aria-hidden /> Los {sectores.length} sectores a {y}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <Rotulo>Eliminar</Rotulo>
            <div className="flex flex-wrap items-center gap-2">
              <EliminarEvaluacion
                formId={form.id}
                nombre={`«${form.titulo}»`}
                respuestas={respuestas}
                etiqueta={conjunta ? 'Solo este sector' : 'Esta evaluación'}
                volverA={volverTrasBorrar}
              />
              {conjunta && (
                <EliminarEvaluacion
                  formId={form.id}
                  grupo
                  nombre={`la evaluación entera (${sectores.length} sectores)`}
                  respuestas={sectores.reduce((n, x) => n + x.respuestas, 0)}
                  etiqueta={`La evaluación entera (${sectores.length} sectores)`}
                />
              )}
            </div>
          </div>
        </div>
      </Plegable>

      {/* ── Bloques ──────────────────────────────────────────────────────────
         Cada actividad no es otra caja: es un encabezado propio + una guía de
         color vertical que enhebra sus preguntas, y aire entre actividades. */}
      <div className="space-y-10 pt-4">
        {bloquesVisibles.map((b, bi) => {
          const preguntasVisibles = b.preguntas.filter((q) => !preguntasOcultas.has(q.id));
          const idsVisibles = preguntasVisibles.map((q) => q.id);
          const colorBloque = b.actividad?.color ?? '#2563eb';
          const letra = letraDeIndice(bi);
          return (
            <section key={b.id} aria-label={`Actividad ${letra}: ${b.titulo}`}>
              {/* Encabezado de la actividad */}
              <div className="flex items-start gap-1.5">
                <ActividadColorButton
                  letra={letra}
                  color={b.actividad?.color ?? null}
                  disabled={!b.activityId}
                  onChange={(color) => cambiarColorActividad(b, color)}
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Input
                    aria-label={`Nombre de la actividad ${letra}`}
                    defaultValue={b.titulo}
                    onBlur={(e) => e.target.value !== b.titulo && void estructura({ accion: 'bloque.update', blockId: b.id, titulo: e.target.value })}
                    className="font-semibold"
                  />
                  <Textarea
                    aria-label={`Presentación de la actividad ${letra}`}
                    defaultValue={b.intro ?? ''}
                    placeholder={
                      audiencia === 'profesores'
                        ? 'Objetivo de la actividad (se muestra encima de las preguntas)'
                        : 'Frase que explique de qué va, sin soltar el objetivo tal cual'
                    }
                    onBlur={(e) => e.target.value !== (b.intro ?? '') && void estructura({ accion: 'bloque.update', blockId: b.id, intro: e.target.value || null })}
                    className="min-h-20"
                  />
                </div>
                <div className="flex shrink-0 flex-col items-center text-zinc-500 sm:flex-row dark:text-zinc-400">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={bi === 0 || ocupado}
                    aria-label={`Subir la actividad ${letra}`}
                    onClick={() => moverBloque(b.id, bloquesVisibles[bi - 1]?.id)}
                  >
                    <ChevronUp aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={bi === bloquesVisibles.length - 1 || ocupado}
                    aria-label={`Bajar la actividad ${letra}`}
                    onClick={() => moverBloque(b.id, bloquesVisibles[bi + 1]?.id)}
                  >
                    <ChevronDown aria-hidden />
                  </Button>
                  {!bloqueada && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={ocupado}
                      aria-label={`Quitar la actividad ${letra} del formulario`}
                      onClick={() => borrarBloqueConDeshacer(b)}
                      className="hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                    >
                      <Trash2 aria-hidden />
                    </Button>
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

                  {/* Añadir preguntas */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {preguntasVisibles.length === 0 && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={ocupado}
                        onClick={() => void estructura({ accion: 'pregunta.preset', blockId: b.id })}
                      >
                        <Sparkles aria-hidden /> Poner las preguntas de siempre
                      </Button>
                    )}
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">Añadir:</span>
                    {(['escala', 'texto', 'opcion', 'quiz'] as const).map((t) => (
                      <Button
                        key={t}
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={ocupado}
                        onClick={() => void estructura({ accion: 'pregunta.add', blockId: b.id, tipo: t })}
                      >
                        <Plus aria-hidden />
                        {t === 'escala' ? 'Escala' : t === 'texto' ? 'Texto' : t === 'opcion' ? 'Opciones' : 'Quiz'}
                      </Button>
                    ))}
                    <details className="relative">
                      <summary className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'list-none [&::-webkit-details-marker]:hidden')}>
                        <ListPlus aria-hidden /> Del catálogo
                      </summary>
                      {/* Se abre hacia ARRIBA y con z-index alto a propósito: cada bloque anima su
                         entrada (anim-stagger) y eso crea su propio contexto de apilamiento, así que
                         un desplegable normal hacia abajo queda tapado por el bloque siguiente. */}
                      <div className="absolute bottom-full z-40 mb-1 w-72 max-w-[calc(100vw-3rem)] rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                        {catalogoAudiencia.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            disabled={ocupado}
                            onClick={() => void estructura({ accion: 'pregunta.add', blockId: b.id, catalogoId: c.id })}
                            className="flex min-h-10 w-full items-center rounded-xl px-3 py-2 text-left text-sm text-zinc-800 outline-none transition-colors hover:bg-zinc-100 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                          >
                            {c.nombre}
                          </button>
                        ))}
                      </div>
                    </details>
                    {ocupado && <Loader2 aria-label="Guardando" className="size-4 animate-spin text-zinc-500" />}
                  </div>
                </GuiaActividad>
              </div>
            </section>
          );
        })}
      </div>

      {/* ── Añadir actividad al formulario ─────────────────────────────────── */}
      {anadiendo ? (
        <Tarjeta className="space-y-3 p-4">
          <Campo etiqueta="Añadir otra actividad" id="eval-nueva-actividad" ayuda="Escribe el nombre y pulsa Intro.">
            <div className="flex gap-2">
              <Input
                id="eval-nueva-actividad"
                value={nuevaActividad}
                autoFocus
                onChange={(e) => setNuevaActividad(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && anadirActividad()}
                placeholder="Nombre de la actividad"
              />
              <Button type="button" disabled={ocupado || nuevaActividad.trim().length < 2} onClick={anadirActividad}>
                <Check aria-hidden /> Añadir
              </Button>
            </div>
          </Campo>
          {actividadesLibres.length > 0 && (
            <div className="space-y-1.5">
              <Rotulo>O una que ya existe</Rotulo>
              <div className="flex flex-wrap gap-2">
                {actividadesLibres.map((a) => (
                  <Button
                    key={a.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={ocupado}
                    onClick={() => void estructura({ accion: 'bloque.add', activityId: a.id }).then(() => setAnadiendo(false))}
                  >
                    <Plus aria-hidden /> {a.nombre}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={() => setAnadiendo(false)}>
            Cancelar
          </Button>
        </Tarjeta>
      ) : (
        <Button type="button" variant="outline" onClick={() => setAnadiendo(true)} className="w-full border-dashed">
          <Plus aria-hidden /> Añadir otra actividad
        </Button>
      )}
    </div>
  );
}
