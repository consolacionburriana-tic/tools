'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BarChart3, Check, ChevronDown, ChevronUp, Copy, ExternalLink, Eye, Layers, Link2, ListPlus,
  Loader2, Lock, Plus, Send, Settings2, Sparkles, Trash2, TriangleAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { etapaDeCurso } from '@/lib/cursos';
import { AUDIENCIAS, CATALOGO, claseLabel, huecosPendientes, opcionesAcademicYear, type Audiencia } from '@/lib/evaluaciones';
import type { EvalQuestion } from '@/db/schema';
import type { FormCompleto } from '@/lib/evaluaciones-server';
import { QuestionCard } from '@/components/evaluaciones/question-card';

interface Props {
  inicial: FormCompleto;
  clases: { curso: string; letra: string | null }[];
  actividades: { id: string; nombre: string }[];
  respuestas: number;
  baseUrl: string;
  academicYearActual: string;
}

const inputCls =
  'w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100';

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

  function moverPregunta(blockId: string, ids: string[], indice: number, delta: number) {
    const destino = indice + delta;
    if (destino < 0 || destino >= ids.length) return;
    const copia = [...ids];
    [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
    haptic.tap();
    void estructura({ accion: 'pregunta.reorder', blockId, ids: copia });
  }

  function soltar(blockId: string, ids: string[]) {
    const origen = arrastrando.current;
    const destinoId = sobre.current;
    arrastrando.current = null;
    sobre.current = null;
    if (!origen || !destinoId || origen.blockId !== blockId || origen.id === destinoId) return;
    const copia = ids.filter((x) => x !== origen.id);
    const idx = copia.indexOf(destinoId);
    copia.splice(idx < 0 ? copia.length : idx, 0, origen.id);
    void estructura({ accion: 'pregunta.reorder', blockId, ids: copia });
  }

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
      {/* ── Cabecera: título, estado y accesos rápidos ────────────────────── */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span
            title="Quién responde"
            className="rounded-full bg-zinc-100 px-2 py-0.5 font-semibold dark:bg-zinc-800"
          >
            Responde: {AUDIENCIAS.find((a) => a.value === audiencia)?.emoji}{' '}
            {AUDIENCIAS.find((a) => a.value === audiencia)?.label}
          </span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">{form.academicYear}</span>
          <span>{respuestas} respuestas</span>
        </div>

        <input
          defaultValue={form.titulo}
          onBlur={(e) => e.target.value !== form.titulo && void patchForm({ titulo: e.target.value })}
          className={`${inputCls} mt-2 text-lg font-semibold`}
        />
        <textarea
          defaultValue={form.descripcion ?? ''}
          rows={2}
          placeholder="Texto de presentación que ve quien responde"
          onBlur={(e) => e.target.value !== (form.descripcion ?? '') && void patchForm({ descripcion: e.target.value || null })}
          className={`${inputCls} mt-2 text-sm`}
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(['borrador', 'abierto', 'cerrado'] as const).map((e) => (
            <button
              key={e}
              type="button"
              disabled={e === 'abierto' && huecos.length > 0}
              title={e === 'abierto' && huecos.length > 0 ? 'Termina primero las frases que quedan a medias' : undefined}
              onClick={() => {
                haptic.tap();
                void patchForm({ estado: e }, e === 'abierto' ? 'Evaluación abierta: ya se puede responder' : undefined);
              }}
              className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                form.estado === e
                  ? e === 'abierto'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
              }`}
            >
              {e}
            </button>
          ))}
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(enlace);
                haptic.success();
                toast.success('Enlace copiado');
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Link2 className="h-3.5 w-3.5" /> Copiar enlace
            </button>
            <Link
              href={`/evaluaciones/${form.token}`}
              target="_blank"
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Eye className="h-3.5 w-3.5" /> Previsualizar <ExternalLink className="h-3 w-3" />
            </Link>
            <Link
              href={`/gestion/evaluaciones/${form.id}/enviar`}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              <Send className="h-3.5 w-3.5" /> Enviar
            </Link>
            <Link
              href={`/gestion/evaluaciones/${form.id}/resultados`}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-300"
            >
              <BarChart3 className="h-3.5 w-3.5" /> Resultados
            </Link>
          </div>
        </div>

        {huecos.length > 0 ? (
          <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            <p className="flex items-center gap-2 font-semibold">
              <TriangleAlert className="h-4 w-4 shrink-0" />
              {huecos.length === 1 ? 'Falta terminar una frase' : `Faltan ${huecos.length} frases por terminar`} para poder abrirla
            </p>
            <p className="mt-1 text-amber-800/90 dark:text-amber-300/90">
              El preset las deja a medias a propósito: una evaluación con la pregunta genérica no la contesta nadie con
              cabeza. Termínalas y el botón de &quot;abierto&quot; se activa solo.
            </p>
            <ul className="mt-1.5 space-y-0.5">
              {huecos.slice(0, 6).map((h, i) => (
                <li key={`${h.questionId}-${i}`} className="font-medium">
                  · {h.texto}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          pendientesRevision > 0 && (
            <p className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              <TriangleAlert className="h-4 w-4 shrink-0" />
              Quedan {pendientesRevision} pregunta(s) del preset por adaptar: son las marcadas en ámbar. Edítalas y el aviso
              desaparece.
            </p>
          )
        )}
        {bloqueada && (
          <p className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
            <Lock className="h-3.5 w-3.5" /> Ya hay respuestas: puedes retocar textos, pero no borrar preguntas ni cambiar su tipo.
          </p>
        )}
      </div>

      {/* ── Ajustes del formulario ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <button
          type="button"
          onClick={() => setAjustes((v) => !v)}
          className="flex w-full items-center gap-2 p-4 text-sm font-medium text-zinc-800 dark:text-zinc-200"
        >
          <Settings2 className="h-4 w-4 text-zinc-400" /> Ajustes
          {ajustes ? <ChevronUp className="ml-auto h-4 w-4 text-zinc-400" /> : <ChevronDown className="ml-auto h-4 w-4 text-zinc-400" />}
        </button>
        {ajustes && (
          <div className="space-y-4 border-t border-zinc-100 p-4 dark:border-zinc-800">
            {audiencia === 'alumnos' && (
              <div>
                <p className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">Clases que la responden</p>
                <p className="mb-2 text-xs text-zinc-500">Marca el objetivo para saber quién falta y segmentar resultados.</p>
                <div className="space-y-2.5">
                  {clasesPorEtapa.map((g) => (
                    <div key={g.etapa}>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">{g.label}</p>
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
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
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
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
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
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
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
                <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
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
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Aviso de anonimato (pie del formulario)</label>
              <textarea
                defaultValue={form.avisoAnonimato ?? ''}
                rows={2}
                onBlur={(e) => e.target.value !== (form.avisoAnonimato ?? '') && void patchForm({ avisoAnonimato: e.target.value || null })}
                className={`${inputCls} text-sm`}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Mensaje al terminar</label>
              <textarea
                defaultValue={form.mensajeFinal ?? ''}
                rows={2}
                onBlur={(e) => e.target.value !== (form.mensajeFinal ?? '') && void patchForm({ mensajeFinal: e.target.value || null })}
                className={`${inputCls} text-sm`}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Duplicar</span>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => void duplicar({})}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <Copy className="h-3.5 w-3.5" /> Tal cual
              </button>
              {AUDIENCIAS.filter((a) => a.value !== audiencia).map((a) => (
                <button
                  key={a.value}
                  type="button"
                  disabled={ocupado}
                  onClick={() => void duplicar({ audiencia: a.value })}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
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
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    <Copy className="h-3.5 w-3.5" /> A {y}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Bloques ────────────────────────────────────────────────────────── */}
      {form.bloques.map((b, bi) => {
        const ids = b.preguntas.map((q) => q.id);
        return (
          <div key={b.id} className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
            <div className="mb-3 flex items-start gap-2">
              <Layers className="mt-2.5 h-4 w-4 shrink-0 text-blue-500" />
              <div className="min-w-0 flex-1">
                <input
                  defaultValue={b.titulo}
                  onBlur={(e) => e.target.value !== b.titulo && void estructura({ accion: 'bloque.update', blockId: b.id, titulo: e.target.value })}
                  className={`${inputCls} font-semibold`}
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
                  className={`${inputCls} mt-1.5 text-sm`}
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  disabled={bi === 0 || ocupado}
                  onClick={() => {
                    const orden = form.bloques.map((x) => x.id);
                    [orden[bi], orden[bi - 1]] = [orden[bi - 1], orden[bi]];
                    void estructura({ accion: 'bloque.reorder', ids: orden });
                  }}
                  className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-200 disabled:opacity-30 dark:hover:bg-zinc-800"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={bi === form.bloques.length - 1 || ocupado}
                  onClick={() => {
                    const orden = form.bloques.map((x) => x.id);
                    [orden[bi], orden[bi + 1]] = [orden[bi + 1], orden[bi]];
                    void estructura({ accion: 'bloque.reorder', ids: orden });
                  }}
                  className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-200 disabled:opacity-30 dark:hover:bg-zinc-800"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                {!bloqueada && (
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => {
                      if (!confirm(`¿Quitar "${b.titulo}" del formulario? La actividad se conserva.`)) return;
                      void estructura({ accion: 'bloque.remove', blockId: b.id });
                    }}
                    className="rounded-md p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 dark:hover:bg-rose-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {b.preguntas.map((q, qi) => (
                <QuestionCard
                  key={q.id}
                  pregunta={q}
                  indice={qi}
                  total={b.preguntas.length}
                  ocupado={ocupado}
                  bloqueada={bloqueada}
                  onPatch={(cambios: Partial<EvalQuestion>) => void estructura({ accion: 'pregunta.update', questionId: q.id, ...cambios })}
                  onDuplicar={() => void estructura({ accion: 'pregunta.duplicate', questionId: q.id })}
                  onBorrar={() => void estructura({ accion: 'pregunta.remove', questionId: q.id })}
                  onMover={(delta) => moverPregunta(b.id, ids, qi, delta)}
                  onDragStart={() => (arrastrando.current = { blockId: b.id, id: q.id })}
                  onDragOver={() => (sobre.current = q.id)}
                  onDrop={() => soltar(b.id, ids)}
                />
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {b.preguntas.length === 0 && (
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => void estructura({ accion: 'pregunta.preset', blockId: b.id })}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Poner las preguntas de siempre
                </button>
              )}
              {(['escala', 'texto', 'opcion', 'quiz'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  disabled={ocupado}
                  onClick={() => void estructura({ accion: 'pregunta.add', blockId: b.id, tipo: t })}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t === 'escala' ? 'Escala' : t === 'texto' ? 'Texto' : t === 'opcion' ? 'Opciones' : 'Quiz'}
                </button>
              ))}
              <details className="relative">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                  <ListPlus className="h-3.5 w-3.5" /> Del catálogo
                </summary>
                <div className="absolute z-10 mt-1 w-72 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                  {catalogoAudiencia.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      disabled={ocupado}
                      onClick={() => void estructura({ accion: 'pregunta.add', blockId: b.id, catalogoId: c.id })}
                      className="block w-full rounded-lg px-2.5 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      {c.nombre}
                    </button>
                  ))}
                </div>
              </details>
              {ocupado && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />}
            </div>
          </div>
        );
      })}

      {/* ── Añadir actividad al formulario ─────────────────────────────────── */}
      {anadiendo ? (
        <div className="rounded-2xl border border-blue-300 bg-white p-4 dark:border-blue-700 dark:bg-zinc-900">
          <p className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">Añadir otra actividad a este formulario</p>
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
              className={inputCls}
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
              className="shrink-0 rounded-xl bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
            </button>
          </div>
          {actividades.filter((a) => !form.bloques.some((b) => b.activityId === a.id)).length > 0 && (
            <>
              <p className="mb-1.5 mt-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">O una que ya existe</p>
              <div className="flex flex-wrap gap-1.5">
                {actividades
                  .filter((a) => !form.bloques.some((b) => b.activityId === a.id))
                  .map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      disabled={ocupado}
                      onClick={() => void estructura({ accion: 'bloque.add', activityId: a.id }).then(() => setAnadiendo(false))}
                      className="rounded-full bg-zinc-100 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300"
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
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-300 bg-white/60 py-4 text-sm font-medium text-zinc-500 transition-colors hover:border-blue-400 hover:text-blue-600 dark:border-zinc-700 dark:bg-zinc-900/40"
        >
          <Plus className="h-4 w-4" /> Añadir otra actividad al mismo formulario
        </button>
      )}
    </div>
  );
}
