'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, GripVertical, Plus, Settings2, Trash2, TriangleAlert, X } from 'lucide-react';
import { ESCALAS, slugClave, type TipoPregunta } from '@/lib/evaluaciones';
import type { EvalQuestion } from '@/db/schema';

const inputCls =
  'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100';

const TIPOS: { value: TipoPregunta; label: string; pista: string }[] = [
  { value: 'escala', label: 'Escala', pista: 'Varias frases con Nada · Poco · Bastante · Mucho' },
  { value: 'texto', label: 'Texto libre', pista: 'Respuesta abierta' },
  { value: 'opcion', label: 'Una opción', pista: 'Elige una de la lista' },
  { value: 'varias', label: 'Varias opciones', pista: 'Puede marcar más de una' },
  { value: 'quiz', label: 'Quiz', pista: 'Con respuesta correcta y reacción al enviar' },
];

export interface QuestionCardProps {
  pregunta: EvalQuestion;
  indice: number;
  total: number;
  ocupado: boolean;
  bloqueada: boolean; // el formulario ya tiene respuestas: no se borra ni se cambia el tipo
  onPatch: (cambios: Partial<EvalQuestion>) => void;
  onDuplicar: () => void;
  onBorrar: () => void;
  onMover: (delta: number) => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
}

/** Campo de texto que guarda al salir (o con Enter): un round-trip por edición, no por tecla. */
function CampoAutoguardado({
  valor,
  onGuardar,
  className,
  placeholder,
  multiline,
}: {
  valor: string;
  onGuardar: (v: string) => void;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
}) {
  const [local, setLocal] = useState(valor);
  // Si el valor de arriba cambia (otra edición, recarga del formulario), se ajusta el
  // estado local durante el render: es el patrón de React para props que cambian.
  const [visto, setVisto] = useState(valor);
  if (visto !== valor) {
    setVisto(valor);
    setLocal(valor);
  }
  const guardar = () => {
    if (local !== valor) onGuardar(local);
  };
  const props = {
    value: local,
    placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setLocal(e.target.value),
    onBlur: guardar,
    className: className ?? inputCls,
  };
  return multiline ? (
    <textarea {...props} rows={2} />
  ) : (
    <input
      {...props}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

export function QuestionCard({
  pregunta: q,
  indice,
  total,
  ocupado,
  bloqueada,
  onPatch,
  onDuplicar,
  onBorrar,
  onMover,
  onDragStart,
  onDragOver,
  onDrop,
}: QuestionCardProps) {
  const [ajustes, setAjustes] = useState(false);
  const esEscala = q.tipo === 'escala';
  const conOpciones = q.tipo === 'opcion' || q.tipo === 'varias' || q.tipo === 'quiz';

  function patchFilas(filas: { clave: string; texto: string }[]) {
    onPatch({ filas, revisar: false });
  }

  function anadirFila() {
    const usadas = new Set(q.filas.map((f) => f.clave));
    let clave = `fila_${q.filas.length + 1}`;
    while (usadas.has(clave)) clave = `${clave}_x`;
    patchFilas([...q.filas, { clave, texto: '' }]);
  }

  function anadirOpcion() {
    const letras = 'abcdefghij';
    const clave = letras[q.opciones.length] ?? slugClave(`op_${q.opciones.length + 1}`);
    onPatch({ opciones: [...q.opciones, { clave, texto: '' }] });
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      className={`rounded-xl border bg-white p-3 transition-colors dark:bg-zinc-900 ${
        q.revisar
          ? 'border-amber-300 bg-amber-50/40 dark:border-amber-500/40 dark:bg-amber-500/5'
          : 'border-zinc-200 dark:border-zinc-700'
      } ${ocupado ? 'opacity-60' : ''}`}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <GripVertical className="hidden h-4 w-4 cursor-grab text-zinc-300 sm:block" />
        <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-500 dark:bg-zinc-800">{indice + 1}</span>
        <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
          {TIPOS.find((t) => t.value === q.tipo)?.label}
        </span>
        {q.revisar && (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
            <TriangleAlert className="h-3 w-3" /> Cambia esta frase
          </span>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onMover(-1)}
            disabled={indice === 0 || ocupado}
            title="Subir"
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30 dark:hover:bg-zinc-800"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onMover(1)}
            disabled={indice === total - 1 || ocupado}
            title="Bajar"
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30 dark:hover:bg-zinc-800"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDuplicar}
            disabled={ocupado}
            title="Duplicar"
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30 dark:hover:bg-zinc-800"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setAjustes((v) => !v)}
            title="Ajustes"
            className={`rounded-md p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 ${ajustes ? 'text-blue-600' : 'text-zinc-400 hover:text-zinc-700'}`}
          >
            <Settings2 className="h-4 w-4" />
          </button>
          {!bloqueada && (
            <button
              type="button"
              onClick={onBorrar}
              disabled={ocupado}
              title="Borrar"
              className="rounded-md p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 dark:hover:bg-rose-500/10"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <CampoAutoguardado
        valor={q.texto}
        onGuardar={(v) => onPatch({ texto: v, revisar: false })}
        placeholder="Texto de la pregunta"
        className={`${inputCls} font-medium`}
      />

      {esEscala && (
        <div className="mt-2 space-y-1.5">
          {q.filas.map((f, i) => (
            <div key={f.clave} className="flex items-center gap-1.5">
              <span className="w-4 text-center text-[10px] text-zinc-300">{i + 1}</span>
              <CampoAutoguardado
                valor={f.texto}
                placeholder="Frase a valorar"
                onGuardar={(v) => patchFilas(q.filas.map((x) => (x.clave === f.clave ? { ...x, texto: v } : x)))}
              />
              <button
                type="button"
                onClick={() => patchFilas(q.filas.filter((x) => x.clave !== f.clave))}
                className="rounded-md p-1.5 text-zinc-300 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={anadirFila}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
          >
            <Plus className="h-3.5 w-3.5" /> Añadir frase
          </button>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {ESCALAS.map((e) => (
              <button
                key={e.value}
                type="button"
                onClick={() => onPatch({ escala: e.value })}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  q.escala === e.value
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
                }`}
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {conOpciones && (
        <div className="mt-2 space-y-1.5">
          {q.opciones.map((o) => (
            <div key={o.clave} className="flex items-center gap-1.5">
              {q.tipo === 'quiz' && (
                <button
                  type="button"
                  title={o.correcta ? 'Es la correcta' : 'Marcar como correcta'}
                  onClick={() =>
                    onPatch({ opciones: q.opciones.map((x) => ({ ...x, correcta: x.clave === o.clave ? !x.correcta : x.correcta })) })
                  }
                  className={`h-6 w-6 shrink-0 rounded-full border text-xs font-bold ${
                    o.correcta
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-zinc-300 text-transparent dark:border-zinc-600'
                  }`}
                >
                  ✓
                </button>
              )}
              <CampoAutoguardado
                valor={o.texto}
                placeholder="Texto de la opción"
                onGuardar={(v) => onPatch({ opciones: q.opciones.map((x) => (x.clave === o.clave ? { ...x, texto: v } : x)) })}
              />
              <button
                type="button"
                onClick={() => onPatch({ opciones: q.opciones.filter((x) => x.clave !== o.clave) })}
                className="rounded-md p-1.5 text-zinc-300 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={anadirOpcion}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
          >
            <Plus className="h-3.5 w-3.5" /> Añadir opción
          </button>
        </div>
      )}

      {q.tipo === 'quiz' && (
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          <CampoAutoguardado
            valor={q.feedbackAcierto ?? ''}
            placeholder="Si acierta: ¡Bien! 🎉"
            onGuardar={(v) => onPatch({ feedbackAcierto: v || null })}
            className={`${inputCls} border-emerald-200 dark:border-emerald-500/30`}
          />
          <CampoAutoguardado
            valor={q.feedbackFallo ?? ''}
            placeholder="Si falla: Casi 😅"
            onGuardar={(v) => onPatch({ feedbackFallo: v || null })}
            className={`${inputCls} border-amber-200 dark:border-amber-500/30`}
          />
        </div>
      )}

      {ajustes && (
        <div className="mt-3 space-y-2.5 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/50">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Texto de ayuda</label>
            <CampoAutoguardado
              valor={q.ayuda ?? ''}
              placeholder="¡Es importante! Cualquier propuesta es válida…"
              onGuardar={(v) => onPatch({ ayuda: v || null })}
              multiline
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Tipo de pregunta</label>
            <div className="flex flex-wrap gap-1.5">
              {TIPOS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  disabled={bloqueada}
                  title={t.pista}
                  onClick={() => onPatch({ tipo: t.value })}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium disabled:opacity-40 ${
                    q.tipo === t.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-zinc-500 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-400'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {bloqueada && <p className="mt-1 text-[11px] text-zinc-400">Ya hay respuestas: el tipo no se puede cambiar.</p>}
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
              <input type="checkbox" checked={q.obligatoria} onChange={(e) => onPatch({ obligatoria: e.target.checked })} />
              Obligatoria
            </label>
            {conOpciones && (
              <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                <input type="checkbox" checked={q.permiteOtra} onChange={(e) => onPatch({ permiteOtra: e.target.checked })} />
                Permitir &quot;Otra&quot; con texto
              </label>
            )}
          </div>
          <p className="text-[11px] text-zinc-400">
            Clave para comparativas: <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-700">{q.clave}</code>
          </p>
        </div>
      )}
    </div>
  );
}
