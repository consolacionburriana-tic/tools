'use client';

import { useState } from 'react';
import {
  Check, ChevronDown, ChevronUp, Copy, Flame, GripVertical, Heart, Plus, Settings2, Smile, Star, ThumbsUp, Trash2,
  TriangleAlert, X, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Campo } from '@/components/ui/campo';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Interruptor } from '@/components/ui/interruptor';
import { claseTarjeta } from '@/components/ui/tarjeta';
import { tintaSobre } from '@/components/evaluaciones/ui';
import {
  ESCALAS,
  ESTILOS_ESTRELLA,
  ESTILO_ESTRELLA_POR_DEFECTO,
  esEscalaEstrellas,
  fraseConHueco,
  slugClave,
  type TipoPregunta,
} from '@/lib/evaluaciones';
import type { EvalQuestion } from '@/db/schema';

const ICONO_ESTILO: Record<string, LucideIcon> = { Star, Heart, Flame, ThumbsUp, Smile };

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
  /** Color de la actividad a la que pertenece: tiñe el número de orden. */
  color: string;
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
  etiqueta,
  id,
}: {
  valor: string;
  onGuardar: (v: string) => void;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
  /** Para el lector de pantalla cuando no hay etiqueta visible. */
  etiqueta?: string;
  id?: string;
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
    id,
    value: local,
    placeholder,
    'aria-label': etiqueta,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setLocal(e.target.value),
    onBlur: guardar,
    className,
  };
  return multiline ? (
    <Textarea {...props} className={cn('min-h-20', className)} />
  ) : (
    <Input
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
  color,
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
  // Una frase que acaba en "…" está a medias: se marca aunque ya no esté en `revisar`.
  const conHueco = fraseConHueco(q.texto) || q.filas.some((f) => fraseConHueco(f.texto));
  const esEscala = q.tipo === 'escala';
  const conOpciones = q.tipo === 'opcion' || q.tipo === 'varias' || q.tipo === 'quiz';
  const n = indice + 1;

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
      className={cn(
        claseTarjeta,
        'p-3 transition-opacity duration-150',
        (q.revisar || conHueco) && 'border-amber-300 bg-amber-50/60 dark:border-amber-500/40 dark:bg-amber-500/5',
        ocupado && 'opacity-60',
      )}
    >
      {/* Cabecera de la pregunta: a la izquierda QUÉ es (número + tipo), a la derecha qué
         se puede hacer con ella. Las acciones se ven siempre (en el iPad no hay ratón),
         en gris para que no tapen el contenido. */}
      <div className="mb-2 flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <GripVertical aria-hidden className="hidden size-4 cursor-grab text-zinc-400 sm:block dark:text-zinc-500" />
        <span
          style={{ background: color, color: tintaSobre(color) }}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-bold tabular-nums"
        >
          {n}
        </span>
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{TIPOS.find((t) => t.value === q.tipo)?.label}</span>
        {(q.revisar || conHueco) && (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
            <TriangleAlert aria-hidden className="size-3.5" /> {conHueco ? 'Termina la frase' : 'Cambia esta frase'}
          </span>
        )}
        <div className="ml-auto flex items-center text-zinc-500 dark:text-zinc-400">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onMover(-1)}
            disabled={indice === 0 || ocupado}
            aria-label={`Subir la pregunta ${n}`}
          >
            <ChevronUp aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onMover(1)}
            disabled={indice === total - 1 || ocupado}
            aria-label={`Bajar la pregunta ${n}`}
          >
            <ChevronDown aria-hidden />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onDuplicar} disabled={ocupado} aria-label={`Duplicar la pregunta ${n}`}>
            <Copy aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setAjustes((v) => !v)}
            aria-expanded={ajustes}
            aria-label={`Ajustes de la pregunta ${n}`}
          >
            <Settings2 aria-hidden />
          </Button>
          {!bloqueada && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onBorrar}
              disabled={ocupado}
              aria-label={`Borrar la pregunta ${n}`}
              className="hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-500/10 dark:hover:text-red-300"
            >
              <Trash2 aria-hidden />
            </Button>
          )}
        </div>
      </div>

      <CampoAutoguardado
        valor={q.texto}
        etiqueta={`Texto de la pregunta ${n}`}
        onGuardar={(v) => onPatch({ texto: v, revisar: false })}
        placeholder="Texto de la pregunta"
        className="font-semibold"
      />

      {esEscala && (
        <div className="mt-2 space-y-1.5">
          {q.filas.map((f, i) => (
            <div key={f.clave} className="flex items-center gap-1.5">
              <span aria-hidden className="w-4 text-center text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
                {i + 1}
              </span>
              <CampoAutoguardado
                valor={f.texto}
                etiqueta={`Frase ${i + 1}`}
                placeholder="Frase a valorar"
                className={fraseConHueco(f.texto) ? 'border-amber-400 bg-amber-50 dark:border-amber-500/50 dark:bg-amber-500/10' : undefined}
                onGuardar={(v) => patchFilas(q.filas.map((x) => (x.clave === f.clave ? { ...x, texto: v } : x)))}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Quitar la frase ${i + 1}`}
                onClick={() => patchFilas(q.filas.filter((x) => x.clave !== f.clave))}
                className="text-zinc-500 hover:bg-red-50 hover:text-red-700 dark:text-zinc-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"
              >
                <X aria-hidden />
              </Button>
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={anadirFila}>
            <Plus aria-hidden /> Añadir frase
          </Button>
          <Filtros etiqueta="Escala de respuesta" className="pt-1">
            {ESCALAS.map((e) => (
              <Filtro
                key={e.value}
                activo={q.escala === e.value}
                onClick={() =>
                  onPatch(
                    esEscalaEstrellas(e.value) && !q.estilo
                      ? { escala: e.value, estilo: ESTILO_ESTRELLA_POR_DEFECTO }
                      : { escala: e.value },
                  )
                }
              >
                {e.label}
              </Filtro>
            ))}
          </Filtros>
          {esEscalaEstrellas(q.escala) && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">Con qué:</span>
              <Filtros etiqueta="Con qué se puntúa">
                {ESTILOS_ESTRELLA.map((e) => {
                  const Icono = ICONO_ESTILO[e.icono] ?? Star;
                  return (
                    <Filtro
                      key={e.value}
                      activo={(q.estilo ?? ESTILO_ESTRELLA_POR_DEFECTO) === e.value}
                      onClick={() => onPatch({ estilo: e.value })}
                      icono={<Icono aria-hidden />}
                    >
                      {e.label}
                    </Filtro>
                  );
                })}
              </Filtros>
            </div>
          )}
        </div>
      )}

      {conOpciones && (
        <div className="mt-2 space-y-1.5">
          {q.opciones.map((o, i) => (
            <div key={o.clave} className="flex items-center gap-1.5">
              {q.tipo === 'quiz' && (
                <button
                  type="button"
                  aria-pressed={!!o.correcta}
                  aria-label={o.correcta ? `La opción ${i + 1} es la correcta` : `Marcar la opción ${i + 1} como correcta`}
                  onClick={() =>
                    onPatch({ opciones: q.opciones.map((x) => ({ ...x, correcta: x.clave === o.clave ? !x.correcta : x.correcta })) })
                  }
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span
                    className={cn(
                      'flex size-6 items-center justify-center rounded-full border',
                      o.correcta
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-zinc-300 text-transparent dark:border-zinc-600',
                    )}
                  >
                    <Check aria-hidden className="size-4" strokeWidth={3} />
                  </span>
                </button>
              )}
              <CampoAutoguardado
                valor={o.texto}
                etiqueta={`Opción ${i + 1}`}
                placeholder="Texto de la opción"
                onGuardar={(v) => onPatch({ opciones: q.opciones.map((x) => (x.clave === o.clave ? { ...x, texto: v } : x)) })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Quitar la opción ${i + 1}`}
                onClick={() => onPatch({ opciones: q.opciones.filter((x) => x.clave !== o.clave) })}
                className="text-zinc-500 hover:bg-red-50 hover:text-red-700 dark:text-zinc-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"
              >
                <X aria-hidden />
              </Button>
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={anadirOpcion}>
            <Plus aria-hidden /> Añadir opción
          </Button>
        </div>
      )}

      {q.tipo === 'quiz' && (
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          <CampoAutoguardado
            valor={q.feedbackAcierto ?? ''}
            etiqueta="Qué se le dice si acierta"
            placeholder="Si acierta: ¡Bien!"
            onGuardar={(v) => onPatch({ feedbackAcierto: v || null })}
          />
          <CampoAutoguardado
            valor={q.feedbackFallo ?? ''}
            etiqueta="Qué se le dice si falla"
            placeholder="Si falla: casi, casi"
            onGuardar={(v) => onPatch({ feedbackFallo: v || null })}
          />
        </div>
      )}

      {ajustes && (
        <div className="mt-3 space-y-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <Campo etiqueta="Texto de ayuda" id={`ayuda-${q.id}`} opcional>
            <CampoAutoguardado
              id={`ayuda-${q.id}`}
              valor={q.ayuda ?? ''}
              placeholder="¡Es importante! Cualquier propuesta es válida…"
              onGuardar={(v) => onPatch({ ayuda: v || null })}
              multiline
            />
          </Campo>
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Tipo de pregunta</p>
            <Filtros etiqueta="Tipo de pregunta">
              {TIPOS.map((t) => (
                <Filtro key={t.value} activo={q.tipo === t.value} disabled={bloqueada} onClick={() => onPatch({ tipo: t.value })}>
                  {t.label}
                </Filtro>
              ))}
            </Filtros>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {bloqueada ? 'Ya hay respuestas: el tipo no se puede cambiar.' : TIPOS.find((t) => t.value === q.tipo)?.pista}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Interruptor activo={q.obligatoria} onChange={(v) => onPatch({ obligatoria: v })} etiqueta="Obligatoria" />
            {conOpciones && (
              <Interruptor
                activo={q.permiteOtra}
                onChange={(v) => onPatch({ permiteOtra: v })}
                etiqueta="Permitir «Otra» con texto"
              />
            )}
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Clave para comparativas: <Etiqueta mono>{q.clave}</Etiqueta>
          </p>
        </div>
      )}
    </div>
  );
}
