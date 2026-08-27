'use client';

// Escala de estrellitas (o corazones, o fuego, o caritas). Pensada para dedo en iPad:
// objetivos táctiles grandes, respuesta inmediata al tocar y la etiqueta del valor
// siempre visible debajo — el icono solo no dice si un 3 es bueno o regular.
import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Flame, Heart, Star, ThumbsUp } from 'lucide-react';
import { caritaPara, estiloEstrellaDe } from '@/lib/evaluaciones';

interface Props {
  puntos: { valor: number; label: string }[];
  valor: number | undefined;
  estilo: string | null | undefined;
  onElegir: (valor: number) => void;
  /** Pinta los iconos apagados en rojo cuando la pregunta se ha quedado sin contestar. */
  destacarFalta?: boolean;
}

const ICONOS = { Star, Heart, Flame, ThumbsUp } as const;

const COLOR: Record<string, { on: string; off: string }> = {
  estrella: { on: 'text-amber-400', off: 'text-zinc-300 dark:text-zinc-600' },
  corazon: { on: 'text-rose-500', off: 'text-zinc-300 dark:text-zinc-600' },
  fuego: { on: 'text-orange-500', off: 'text-zinc-300 dark:text-zinc-600' },
  pulgar: { on: 'text-blue-600', off: 'text-zinc-300 dark:text-zinc-600' },
};

export function EstrellasInput({ puntos, valor, estilo, onElegir, destacarFalta }: Props) {
  const quieto = useReducedMotion();
  const [encima, setEncima] = useState<number | null>(null);
  const est = estiloEstrellaDe(estilo);
  const referencia = encima ?? valor ?? 0;
  const elegido = puntos.find((p) => p.valor === valor);

  // Caritas: se elige UNA, no se acumulan. La seleccionada crece y las demás se apagan.
  if (!est.acumulativo) {
    return (
      <div>
        <div className="flex flex-wrap gap-1.5">
          {puntos.map((p, i) => {
            const activo = valor === p.valor;
            return (
              <motion.button
                key={p.valor}
                type="button"
                onClick={() => onElegir(p.valor)}
                whileTap={quieto ? undefined : { scale: 0.88 }}
                animate={quieto ? undefined : { scale: activo ? 1.15 : 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 16 }}
                aria-label={`${p.label} de ${puntos.length}`}
                aria-pressed={activo}
                className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl transition-colors ${
                  activo
                    ? 'bg-blue-600/10 ring-2 ring-blue-500'
                    : destacarFalta
                      ? 'bg-rose-50 opacity-70 grayscale dark:bg-rose-500/10'
                      : 'bg-zinc-100 opacity-60 grayscale hover:opacity-100 hover:grayscale-0 dark:bg-zinc-800'
                }`}
              >
                {caritaPara(i, puntos.length)}
              </motion.button>
            );
          })}
        </div>
        <p className="mt-1 h-4 text-xs text-zinc-500">{elegido ? `${elegido.label} de ${puntos.length}` : ''}</p>
      </div>
    );
  }

  const Icono = ICONOS[est.icono as keyof typeof ICONOS] ?? Star;
  const colores = COLOR[est.value] ?? COLOR.estrella;

  return (
    <div>
      <div className="flex flex-wrap gap-0.5" onMouseLeave={() => setEncima(null)}>
        {puntos.map((p) => {
          const encendida = p.valor <= referencia;
          return (
            <motion.button
              key={p.valor}
              type="button"
              onClick={() => onElegir(p.valor)}
              onMouseEnter={() => setEncima(p.valor)}
              onFocus={() => setEncima(p.valor)}
              onBlur={() => setEncima(null)}
              whileTap={quieto ? undefined : { scale: 0.85 }}
              animate={quieto ? undefined : { scale: encendida && valor === p.valor ? 1.12 : 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 15 }}
              aria-label={`${p.label} de ${puntos.length}`}
              aria-pressed={valor === p.valor}
              className="flex h-11 w-11 items-center justify-center rounded-xl transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <Icono
                className={`h-7 w-7 transition-colors ${
                  encendida ? colores.on : destacarFalta ? 'text-rose-300 dark:text-rose-500/50' : colores.off
                }`}
                fill={encendida ? 'currentColor' : 'none'}
                strokeWidth={encendida ? 1.5 : 2}
              />
            </motion.button>
          );
        })}
      </div>
      {/* Altura fija: si el texto apareciera y desapareciera, el formulario daría saltos. */}
      <p className="mt-1 h-4 text-xs text-zinc-500">{elegido ? `${elegido.label} de ${puntos.length}` : ''}</p>
    </div>
  );
}
