'use client';

import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowDown, CheckCircle2, Loader2, Lock, PartyPopper, Send, Sparkles, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { stepAnim } from '@/lib/motion';
import {
  claseLabel,
  escalaDe,
  esEscalaEstrellas,
  preguntasIncompletas,
  type PreguntaParaValidar,
  type RespuestaCruda,
} from '@/lib/evaluaciones';
import { Celebracion, sortearCelebracion, type IdCelebracion } from '@/components/evaluaciones/celebraciones';
import { ProgresoAnillo } from '@/components/evaluaciones/progreso-anillo';
import { EstrellasInput } from '@/components/evaluaciones/estrellas-input';

export interface PreguntaPublica {
  id: string;
  texto: string;
  ayuda: string | null;
  tipo: string;
  escala: string;
  filas: { clave: string; texto: string }[];
  opciones: { clave: string; texto: string }[];
  permiteOtra: boolean;
  obligatoria: boolean;
  estilo: string | null;
}

export interface BloquePublico {
  id: string;
  titulo: string;
  intro: string | null;
  /** Acento de la actividad en este bloque; sin color, se usa el azul de siempre. */
  color: string | null;
  preguntas: PreguntaPublica[];
}

interface Props {
  token: string;
  invite: string | null;
  audiencia: string;
  /** Color dominante del formulario: botón de enviar y barra/anillo de progreso. */
  colorForm: string;
  descripcion: string | null;
  avisoAnonimato: string | null;
  bloques: BloquePublico[];
  pedirClase: boolean;
  pedirEtapa: boolean;
  clases: { curso: string; letra: string | null }[];
  /** Si el enlace es personalizado ya sabemos la clase: no se pregunta. */
  claseConocida: string | null;
  soloVistaPrevia: boolean;
}

interface ResultadoQuiz {
  questionId: string;
  texto: string;
  acertada: boolean;
  correctas: string[];
  feedback: string | null;
}

const ETAPAS = [
  { value: 'EI', label: 'Infantil' },
  { value: 'EP', label: 'Primaria' },
  { value: 'ESO', label: 'Secundaria' },
];

// Los dos campos de cabecera se validan como una pregunta más y se marcan igual en
// rojo: así no hace falta ningún alert() en todo el formulario.
const CLAVE_CLASE = '__clase';
const CLAVE_ETAPA = '__etapa';

const claseKey = (c: { curso: string; letra: string | null }) => `${c.curso}|${c.letra ?? ''}`;

export function ResponderForm({
  token,
  invite,
  audiencia,
  colorForm,
  descripcion,
  avisoAnonimato,
  bloques,
  pedirClase,
  pedirEtapa,
  clases,
  claseConocida,
  soloVistaPrevia,
}: Props) {
  const [clase, setClase] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<string | null>(null);
  // Respuestas en un mapa plano: `preguntaId` o `preguntaId::fila` → valor.
  const [escalas, setEscalas] = useState<Record<string, number>>({});
  const [opciones, setOpciones] = useState<Record<string, string[]>>({});
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [otras, setOtras] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [fallan, setFallan] = useState<string[]>([]);
  const [hecho, setHecho] = useState<{ mensaje: string | null; quiz: ResultadoQuiz[]; celebracion: IdCelebracion } | null>(null);
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  const preguntas = useMemo(() => bloques.flatMap((b) => b.preguntas), [bloques]);

  const respuestas = useMemo<RespuestaCruda[]>(() => {
    const out: RespuestaCruda[] = [];
    for (const q of preguntas) {
      if (q.tipo === 'escala') {
        if (q.filas.length > 0) {
          for (const f of q.filas) {
            const v = escalas[`${q.id}::${f.clave}`];
            if (v !== undefined) out.push({ questionId: q.id, filaClave: f.clave, valorNum: v });
          }
        } else {
          const v = escalas[q.id];
          if (v !== undefined) out.push({ questionId: q.id, valorNum: v });
        }
        continue;
      }
      if (q.tipo === 'texto') {
        const t = (textos[q.id] ?? '').trim();
        if (t) out.push({ questionId: q.id, valorTexto: t });
        continue;
      }
      for (const clave of opciones[q.id] ?? []) out.push({ questionId: q.id, opcionClave: clave });
      const otra = (otras[q.id] ?? '').trim();
      if (otra) out.push({ questionId: q.id, valorTexto: otra });
    }
    return out;
  }, [preguntas, escalas, textos, opciones, otras]);

  const paraValidar: PreguntaParaValidar[] = useMemo(
    () =>
      preguntas.map((q) => ({
        id: q.id,
        tipo: q.tipo as PreguntaParaValidar['tipo'],
        escala: q.escala,
        obligatoria: q.obligatoria,
        filas: q.filas,
        opciones: q.opciones,
        permiteOtra: q.permiteOtra,
      })),
    [preguntas],
  );

  // Progreso por CAMPOS (cada fila de una matriz cuenta): es lo que se percibe al
  // rellenar, y lo que hace que el anillo avance de forma creíble.
  const { total, hechos } = useMemo(() => {
    let total = 0;
    let hechos = 0;
    if (pedirClase && !claseConocida) {
      total++;
      if (clase) hechos++;
    }
    if (pedirEtapa) {
      total++;
      if (etapa) hechos++;
    }
    for (const q of preguntas) {
      // Las preguntas opcionales (p. ej. "Observaciones y sugerencias") no entran en
      // el cálculo: si contaran, rellenar solo lo obligatorio nunca llegaría al 100 %,
      // que es justo lo contrario de lo que promete marcarlas como opcionales.
      if (!q.obligatoria) continue;
      if (q.tipo === 'escala' && q.filas.length > 0) {
        total += q.filas.length;
        hechos += q.filas.filter((f) => escalas[`${q.id}::${f.clave}`] !== undefined).length;
        continue;
      }
      total++;
      if (q.tipo === 'escala') {
        if (escalas[q.id] !== undefined) hechos++;
      } else if (q.tipo === 'texto') {
        if ((textos[q.id] ?? '').trim()) hechos++;
      } else if ((opciones[q.id] ?? []).length > 0 || (otras[q.id] ?? '').trim()) {
        hechos++;
      }
    }
    return { total, hechos };
  }, [preguntas, escalas, textos, opciones, otras, pedirClase, claseConocida, clase, pedirEtapa, etapa]);

  // Si no queda nada obligatorio (caso raro), no hay "progreso" que medir: 100 % ya.
  const progreso = total === 0 ? 100 : Math.min(100, Math.round((hechos / total) * 100));

  /** Qué falta ahora mismo, en el orden en que aparece en la página. */
  function calcularFallos(): string[] {
    const out: string[] = [];
    if (pedirClase && !claseConocida && !clase) out.push(CLAVE_CLASE);
    if (pedirEtapa && !etapa) out.push(CLAVE_ETAPA);
    const incompletas = preguntasIncompletas(paraValidar, respuestas);
    for (const q of preguntas) if (incompletas.includes(q.id)) out.push(q.id);
    return out;
  }

  /**
   * Revalida SOLO si ya se había intentado enviar. Nada de pintar de rojo algo que
   * todavía no ha dado tiempo a contestar: el rojo aparece cuando lo pides, y a
   * partir de ahí se va apagando solo conforme rellenas.
   */
  function revalidar() {
    if (fallan.length === 0) return;
    setTimeout(() => setFallan(calcularFallos()), 0);
  }

  function marcarEscala(clave: string, valor: number) {
    setEscalas((prev) => ({ ...prev, [clave]: valor }));
    haptic.tap();
    revalidar();
  }

  function marcarOpcion(q: PreguntaPublica, clave: string) {
    setOpciones((prev) => {
      const actuales = prev[q.id] ?? [];
      if (q.tipo === 'varias') {
        return { ...prev, [q.id]: actuales.includes(clave) ? actuales.filter((x) => x !== clave) : [...actuales, clave] };
      }
      return { ...prev, [q.id]: actuales[0] === clave ? [] : [clave] };
    });
    haptic.tap();
    revalidar();
  }

  function irA(clave: string) {
    refs.current[clave]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function enviar() {
    if (soloVistaPrevia) {
      toast.info('Es una vista previa: todavía no está abierta, no se guarda nada.');
      return;
    }
    const fallos = calcularFallos();
    if (fallos.length > 0) {
      setFallan(fallos);
      haptic.warning();
      irA(fallos[0]);
      return;
    }
    setFallan([]);
    setEnviando(true);
    try {
      const elegida = clases.find((c) => claseKey(c) === clase);
      const res = await fetch('/api/evaluaciones/responder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          invite,
          curso: elegida?.curso ?? null,
          letra: elegida?.letra ?? null,
          etapa,
          respuestas,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo enviar');
      haptic.success();
      setHecho({ mensaje: data.mensajeFinal ?? null, quiz: data.quiz ?? [], celebracion: sortearCelebracion(audiencia) });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      haptic.warning();
      toast.error(e instanceof Error ? e.message : 'No se ha podido enviar. Inténtalo otra vez.');
    } finally {
      setEnviando(false);
    }
  }

  // ── Pantalla final ─────────────────────────────────────────────────────────
  if (hecho) {
    return (
      <motion.div {...stepAnim} className="space-y-4">
        <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-zinc-200/70 dark:bg-zinc-900 dark:ring-zinc-800">
          <Celebracion id={hecho.celebracion} />
          {hecho.mensaje && (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1 }}
              className="border-t border-zinc-100 px-6 py-4 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300"
            >
              {hecho.mensaje}
            </motion.p>
          )}
        </div>

        {hecho.quiz.length > 0 && (
          <div className="space-y-2.5">
            <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
              <PartyPopper className="h-4 w-4 text-amber-500" /> A ver qué tal el quiz…
            </p>
            {hecho.quiz.map((q, i) => (
              <motion.div
                key={q.questionId}
                initial={{ opacity: 0, y: 14, rotate: -1 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                transition={{ delay: 1.3 + i * 0.45, type: 'spring', stiffness: 200, damping: 16 }}
                className={`rounded-2xl border p-4 ${
                  q.acertada
                    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10'
                    : 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 1.5 + i * 0.45, type: 'spring', stiffness: 400, damping: 12 }}
                  >
                    {q.acertada ? (
                      <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                    ) : (
                      <XCircle className="h-6 w-6 text-amber-600" />
                    )}
                  </motion.span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{q.texto}</p>
                    {q.feedback && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{q.feedback}</p>}
                    {!q.acertada && q.correctas.length > 0 && (
                      <p className="mt-1 text-xs text-zinc-500">Era: {q.correctas.join(' · ')}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <p className="pb-8 text-center text-xs text-zinc-400">Ya puedes cerrar esta página.</p>
      </motion.div>
    );
  }

  // ── Formulario ─────────────────────────────────────────────────────────────
  const faltaClase = fallan.includes(CLAVE_CLASE);
  const faltaEtapa = fallan.includes(CLAVE_ETAPA);

  return (
    <>
      <ProgresoAnillo hechos={hechos} total={total} color={colorForm} />

      <div className="space-y-4 pb-40">
        {soloVistaPrevia && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-center text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
            <Sparkles className="mr-1 inline h-4 w-4" /> Vista previa: todavía no está abierta, no se guarda nada.
          </div>
        )}

        {descripcion && (
          <p className="rounded-2xl bg-white p-4 text-sm leading-relaxed text-zinc-600 shadow-sm ring-1 ring-zinc-200/70 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800">
            {descripcion}
          </p>
        )}

        {pedirClase && !claseConocida && (
          <div
            ref={(el) => {
              refs.current[CLAVE_CLASE] = el;
            }}
            className={`rounded-2xl bg-white p-4 shadow-sm ring-1 transition-colors dark:bg-zinc-900 ${
              faltaClase ? 'ring-2 ring-rose-400' : 'ring-zinc-200/70 dark:ring-zinc-800'
            }`}
          >
            <p className="mb-2.5 font-semibold text-zinc-900 dark:text-zinc-100">
              👩🏻‍🏫 ¿De qué clase eres?<span className="ml-1 text-rose-500">*</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {clases.map((c) => {
                const k = claseKey(c);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      setClase(k);
                      haptic.tap();
                      revalidar();
                    }}
                    className={`rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
                      clase === k
                        ? 'bg-blue-600 text-white'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
                    }`}
                  >
                    {claseLabel(c)}
                  </button>
                );
              })}
            </div>
            {faltaClase && <p className="mt-2 text-xs font-medium text-rose-600">Dinos de qué clase eres 🙂</p>}
          </div>
        )}

        {pedirEtapa && (
          <div
            ref={(el) => {
              refs.current[CLAVE_ETAPA] = el;
            }}
            className={`rounded-2xl bg-white p-4 shadow-sm ring-1 transition-colors dark:bg-zinc-900 ${
              faltaEtapa ? 'ring-2 ring-rose-400' : 'ring-zinc-200/70 dark:ring-zinc-800'
            }`}
          >
            <p className="mb-2.5 font-semibold text-zinc-900 dark:text-zinc-100">
              Etapa<span className="ml-1 text-rose-500">*</span>
            </p>
            <div className="grid grid-cols-3 gap-2">
              {ETAPAS.map((e) => (
                <button
                  key={e.value}
                  type="button"
                  onClick={() => {
                    setEtapa(e.value);
                    haptic.tap();
                    revalidar();
                  }}
                  className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    etapa === e.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}
                >
                  {e.label}
                </button>
              ))}
            </div>
            {faltaEtapa && <p className="mt-2 text-xs font-medium text-rose-600">Marca tu etapa</p>}
          </div>
        )}

        {bloques.map((b) => {
          const acento = b.color ?? '#2563eb';
          return (
          <div key={b.id} className="space-y-3">
            <div className="px-1">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: acento }} />
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">{b.titulo}</h2>
              </div>
              {b.intro && <p className="mt-0.5 text-sm text-zinc-500">{b.intro}</p>}
            </div>

            {b.preguntas.map((q) => {
              const falla = fallan.includes(q.id);
              return (
                <div
                  key={q.id}
                  ref={(el) => {
                    refs.current[q.id] = el;
                  }}
                  className={`rounded-2xl bg-white p-4 shadow-sm ring-1 transition-colors dark:bg-zinc-900 ${
                    falla ? 'ring-2 ring-rose-400' : 'ring-zinc-200/70 dark:ring-zinc-800'
                  }`}
                >
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {q.texto}
                    {q.obligatoria && <span className="ml-1 text-rose-500">*</span>}
                  </p>
                  {q.ayuda && <p className="mt-1 text-sm text-zinc-500">{q.ayuda}</p>}

                  {q.tipo === 'escala' && (
                    <div className="mt-3 space-y-3">
                      {(q.filas.length > 0 ? q.filas : [{ clave: '', texto: '' }]).map((f) => {
                        const clave = q.filas.length > 0 ? `${q.id}::${f.clave}` : q.id;
                        const puntos = escalaDe(q.escala).puntos;
                        // Dentro de una matriz se señala LA fila que falta, no toda la pregunta.
                        const sinContestar = falla && escalas[clave] === undefined;
                        return (
                          <div key={clave}>
                            {f.texto && (
                              <p
                                className={`mb-1.5 text-sm ${
                                  sinContestar ? 'font-medium text-rose-600' : 'text-zinc-700 dark:text-zinc-300'
                                }`}
                              >
                                {f.texto}
                              </p>
                            )}
                            {esEscalaEstrellas(q.escala) ? (
                              <EstrellasInput
                                puntos={puntos}
                                valor={escalas[clave]}
                                estilo={q.estilo}
                                destacarFalta={sinContestar}
                                onElegir={(v) => marcarEscala(clave, v)}
                              />
                            ) : (
                              <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${puntos.length}, minmax(0, 1fr))` }}>
                                {puntos.map((p) => {
                                  const activo = escalas[clave] === p.valor;
                                  return (
                                    <button
                                      key={p.valor}
                                      type="button"
                                      onClick={() => marcarEscala(clave, p.valor)}
                                      style={activo ? { backgroundColor: acento } : undefined}
                                      className={`rounded-xl px-1 py-2.5 text-xs font-semibold transition-colors sm:text-sm ${
                                        activo
                                          ? 'text-white shadow-sm'
                                          : sinContestar
                                            ? 'bg-rose-50 text-rose-500 ring-1 ring-rose-200 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30'
                                            : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
                                      }`}
                                    >
                                      {p.label}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {q.tipo === 'texto' && (
                    <textarea
                      value={textos[q.id] ?? ''}
                      onChange={(e) => {
                        setTextos((prev) => ({ ...prev, [q.id]: e.target.value }));
                        revalidar();
                      }}
                      rows={3}
                      placeholder="Escribe aquí…"
                      className="mt-3 w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100"
                    />
                  )}

                  {(q.tipo === 'opcion' || q.tipo === 'varias' || q.tipo === 'quiz') && (
                    <div className="mt-3 space-y-1.5">
                      {q.opciones.map((o) => {
                        const activo = (opciones[q.id] ?? []).includes(o.clave);
                        return (
                          <button
                            key={o.clave}
                            type="button"
                            onClick={() => marcarOpcion(q, o.clave)}
                            style={activo ? { backgroundColor: acento } : undefined}
                            className={`flex w-full items-center gap-2.5 rounded-xl px-3.5 py-3 text-left text-sm transition-colors ${
                              activo
                                ? 'text-white'
                                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
                            }`}
                          >
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 ${
                                q.tipo === 'varias' ? 'rounded-md' : 'rounded-full'
                              } ${activo ? 'border-white' : 'border-zinc-300 dark:border-zinc-600'}`}
                            >
                              {activo && <span className="h-2 w-2 rounded-full bg-white" />}
                            </span>
                            {o.texto}
                          </button>
                        );
                      })}
                      {q.permiteOtra && (
                        <input
                          value={otras[q.id] ?? ''}
                          onChange={(e) => {
                            setOtras((prev) => ({ ...prev, [q.id]: e.target.value }));
                            revalidar();
                          }}
                          placeholder="Otra…"
                          className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100"
                        />
                      )}
                    </div>
                  )}

                  {falla && <p className="mt-2 text-xs font-medium text-rose-600">Te falta contestar esto</p>}
                </div>
              );
            })}
          </div>
          );
        })}

        {avisoAnonimato && (
          <p className="flex items-start gap-2 rounded-2xl bg-zinc-100 px-4 py-3 text-xs leading-relaxed text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {avisoAnonimato}
          </p>
        )}
      </div>

      {/* Barra inferior: progreso siempre a la vista y, si falta algo, atajo para ir. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="mx-auto max-w-xl">
          <AnimatePresence>
            {fallan.length > 0 && (
              <motion.button
                type="button"
                onClick={() => irA(fallan[0])}
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 8 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="flex w-full items-center justify-center gap-1.5 overflow-hidden rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
              >
                <ArrowDown className="h-3.5 w-3.5" />
                {fallan.length === 1 ? 'Te falta 1 pregunta' : `Te faltan ${fallan.length} preguntas`} · ir a la primera
              </motion.button>
            )}
          </AnimatePresence>

          <div className="mb-2 flex items-center gap-2.5">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <motion.div
                className={`h-1.5 rounded-full ${hechos >= total ? 'bg-emerald-500' : ''}`}
                style={hechos >= total ? undefined : { backgroundColor: colorForm }}
                initial={false}
                animate={{ width: `${progreso}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 22 }}
              />
            </div>
            <span className="w-14 shrink-0 text-right text-[11px] font-medium tabular-nums text-zinc-400 md:hidden">
              {hechos}/{total}
            </span>
          </div>

          <button
            type="button"
            onClick={() => void enviar()}
            disabled={enviando}
            style={{ backgroundColor: colorForm }}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 font-semibold text-white brightness-100 transition-[filter] hover:brightness-90 disabled:opacity-50"
          >
            {enviando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            Enviar mis respuestas
          </button>
        </div>
      </div>
    </>
  );
}
