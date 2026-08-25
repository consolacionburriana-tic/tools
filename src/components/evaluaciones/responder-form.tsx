'use client';

import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Loader2, Lock, PartyPopper, Send, Sparkles, XCircle } from 'lucide-react';
import { haptic } from '@/lib/haptics';
import { stepAnim } from '@/lib/motion';
import { claseLabel, escalaDe, preguntasIncompletas, type PreguntaParaValidar, type RespuestaCruda } from '@/lib/evaluaciones';

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
}

export interface BloquePublico {
  id: string;
  titulo: string;
  intro: string | null;
  preguntas: PreguntaPublica[];
}

interface Props {
  token: string;
  invite: string | null;
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

const claseKey = (c: { curso: string; letra: string | null }) => `${c.curso}|${c.letra ?? ''}`;

export function ResponderForm({
  token,
  invite,
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
  const [hecho, setHecho] = useState<{ mensaje: string | null; quiz: ResultadoQuiz[] } | null>(null);
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

  // Progreso por CAMPOS (cada fila de una matriz cuenta), que es lo que se percibe al rellenar.
  const totalCampos = preguntas.reduce((n, q) => n + (q.tipo === 'escala' && q.filas.length > 0 ? q.filas.length : 1), 0);
  const progreso = Math.min(100, Math.round((respuestas.length / Math.max(1, totalCampos)) * 100));

  function marcarEscala(clave: string, valor: number) {
    setEscalas((prev) => ({ ...prev, [clave]: valor }));
    haptic.tap();
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
  }

  async function enviar() {
    if (soloVistaPrevia) return void alert('Esto es una vista previa: la evaluación todavía no está abierta.');
    if (pedirClase && !claseConocida && !clase) {
      haptic.warning();
      return void alert('Dinos primero de qué clase eres 🙂');
    }
    if (pedirEtapa && !etapa) {
      haptic.warning();
      return void alert('Marca tu etapa antes de enviar');
    }
    const incompletas = preguntasIncompletas(paraValidar, respuestas);
    if (incompletas.length > 0) {
      setFallan(incompletas);
      haptic.warning();
      refs.current[incompletas[0]]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
      setHecho({ mensaje: data.mensajeFinal ?? null, quiz: data.quiz ?? [] });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      haptic.warning();
      alert(e instanceof Error ? e.message : 'Error inesperado');
    } finally {
      setEnviando(false);
    }
  }

  if (hecho) {
    return (
      <motion.div {...stepAnim} className="space-y-4">
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-white"
          >
            <CheckCircle2 className="h-9 w-9" />
          </motion.div>
          <p className="mt-4 text-lg font-semibold text-emerald-900 dark:text-emerald-200">¡Enviado!</p>
          {hecho.mensaje && <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-300">{hecho.mensaje}</p>}
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
                transition={{ delay: 0.35 + i * 0.45, type: 'spring', stiffness: 200, damping: 16 }}
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
                    transition={{ delay: 0.55 + i * 0.45, type: 'spring', stiffness: 400, damping: 12 }}
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

  return (
    <div className="space-y-4 pb-32">
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
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200/70 dark:bg-zinc-900 dark:ring-zinc-800">
          <p className="mb-2.5 font-semibold text-zinc-900 dark:text-zinc-100">👩🏻‍🏫 ¿De qué clase eres?</p>
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
        </div>
      )}

      {pedirEtapa && (
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200/70 dark:bg-zinc-900 dark:ring-zinc-800">
          <p className="mb-2.5 font-semibold text-zinc-900 dark:text-zinc-100">Etapa</p>
          <div className="grid grid-cols-3 gap-2">
            {ETAPAS.map((e) => (
              <button
                key={e.value}
                type="button"
                onClick={() => {
                  setEtapa(e.value);
                  haptic.tap();
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
        </div>
      )}

      {bloques.map((b) => (
        <div key={b.id} className="space-y-3">
          <div className="px-1">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">{b.titulo}</h2>
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
                      return (
                        <div key={clave}>
                          {f.texto && <p className="mb-1.5 text-sm text-zinc-700 dark:text-zinc-300">{f.texto}</p>}
                          <div className={`grid gap-1.5`} style={{ gridTemplateColumns: `repeat(${puntos.length}, minmax(0, 1fr))` }}>
                            {puntos.map((p) => {
                              const activo = escalas[clave] === p.valor;
                              return (
                                <button
                                  key={p.valor}
                                  type="button"
                                  onClick={() => marcarEscala(clave, p.valor)}
                                  className={`rounded-xl px-1 py-2.5 text-xs font-semibold transition-colors sm:text-sm ${
                                    activo
                                      ? 'bg-blue-600 text-white shadow-sm'
                                      : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
                                  }`}
                                >
                                  {p.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {q.tipo === 'texto' && (
                  <textarea
                    value={textos[q.id] ?? ''}
                    onChange={(e) => setTextos((prev) => ({ ...prev, [q.id]: e.target.value }))}
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
                          className={`flex w-full items-center gap-2.5 rounded-xl px-3.5 py-3 text-left text-sm transition-colors ${
                            activo
                              ? 'bg-blue-600 text-white'
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
                        onChange={(e) => setOtras((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder="Otra…"
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100"
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {avisoAnonimato && (
        <p className="flex items-start gap-2 rounded-2xl bg-zinc-100 px-4 py-3 text-xs leading-relaxed text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {avisoAnonimato}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="mx-auto max-w-xl">
          <div className="mb-2 h-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <motion.div className="h-1 rounded-full bg-blue-600" animate={{ width: `${progreso}%` }} transition={{ duration: 0.25 }} />
          </div>
          <button
            type="button"
            onClick={() => void enviar()}
            disabled={enviando}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {enviando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            Enviar mis respuestas
          </button>
          <AnimatePresence>
            {fallan.length > 0 && (
              <motion.p {...stepAnim} className="mt-1.5 text-center text-xs text-rose-600">
                Faltan {fallan.length} pregunta(s) por contestar
              </motion.p>
            )}
          </AnimatePresence>
          {fallan.length === 0 && respuestas.length > 0 && (
            <p className="mt-1.5 text-center text-xs text-zinc-400">{progreso} % completado</p>
          )}
        </div>
      </div>
    </div>
  );
}
