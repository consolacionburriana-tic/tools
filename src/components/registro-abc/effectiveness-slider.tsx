'use client';

import { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { haptic } from '@/lib/haptics';
import { Button } from '@/components/ui/button';

interface EffectivenessSliderProps {
  value: number | null;
  onChange: (value: number | null) => void;
}

function getColor(val: number): string {
  // 0=rojo, 2.5=ámbar, 5=verde
  if (val <= 2.5) {
    const t = val / 2.5;
    const r = Math.round(239 + (245 - 239) * t);
    const g = Math.round(68 + (158 - 68) * t);
    const b = Math.round(68 + (11 - 68) * t);
    return `rgb(${r},${g},${b})`;
  } else {
    const t = (val - 2.5) / 2.5;
    const r = Math.round(245 + (34 - 245) * t);
    const g = Math.round(158 + (197 - 158) * t);
    const b = Math.round(11 + (94 - 11) * t);
    return `rgb(${r},${g},${b})`;
  }
}

export function EffectivenessSlider({ value, onChange }: EffectivenessSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const lastInteger = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const displayVal = value ?? 0;
  const color = value !== null ? getColor(displayVal) : '#d4d4d8';
  const percent = (displayVal / 5) * 100;

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const raw = Math.round(ratio * 50) / 10;
    const newVal = Math.max(0, Math.min(5, raw));

    const intNow = Math.floor(newVal);
    if (lastInteger.current !== intNow) {
      haptic.tap();
      lastInteger.current = intNow;
    }
    onChange(newVal);
  };

  const handleDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const raw = Math.round(ratio * 50) / 10;
    const newVal = Math.max(0, Math.min(5, raw));

    const intNow = Math.floor(newVal);
    if (lastInteger.current !== intNow) {
      haptic.tap();
      lastInteger.current = intNow;
    }
    onChange(newVal);
  };

  // Con el teclado: flechas de medio en medio, Re Pág / Av Pág de uno en uno, Inicio y Fin.
  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const pasos: Record<string, number> = { ArrowRight: 0.5, ArrowUp: 0.5, ArrowLeft: -0.5, ArrowDown: -0.5, PageUp: 1, PageDown: -1 };
    let nuevo: number | null = null;
    if (e.key in pasos) nuevo = (value ?? 0) + pasos[e.key];
    else if (e.key === 'Home') nuevo = 0;
    else if (e.key === 'End') nuevo = 5;
    if (nuevo === null) return;
    e.preventDefault();
    haptic.tap();
    onChange(Math.round(Math.max(0, Math.min(5, nuevo)) * 10) / 10);
  };

  return (
    <div className="space-y-4">
      {/* Número grande */}
      <div className="flex items-center justify-center gap-4">
        <motion.span
          key={value}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className="font-mono text-5xl font-bold tabular-nums transition-colors duration-200"
          style={{ color }}
        >
          {value !== null ? displayVal.toFixed(1) : '—'}
        </motion.span>

        {value !== null && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            Quitar valoración
          </Button>
        )}
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        className="relative flex h-10 cursor-pointer touch-none items-center rounded-full outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50"
        tabIndex={0}
        onKeyDown={handleKey}
        onClick={handleTrackClick}
        onPointerDown={(e) => {
          setDragging(true);
          e.currentTarget.setPointerCapture(e.pointerId);
          if (value === null) {
            onChange(0);
          }
        }}
        onPointerMove={handleDrag}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={5}
        aria-valuenow={value ?? 0}
        aria-valuetext={value !== null ? `${displayVal.toFixed(1)} de 5` : 'Sin valorar'}
        aria-label="Efectividad de la reconducción"
      >
        {/* Barra de fondo */}
        <div className="w-full h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              width: `${value !== null ? percent : 0}%`,
              backgroundColor: color,
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          />
        </div>

        {/* Thumb */}
        <motion.div
          className="absolute w-5 h-5 rounded-full shadow-md border-2 border-white dark:border-zinc-900 top-1/2 -translate-y-1/2 -translate-x-1/2"
          style={{
            left: `${value !== null ? percent : 0}%`,
            backgroundColor: color,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />

        {/* Marcas en enteros */}
        <div className="absolute w-full top-full mt-1 flex justify-between px-[1px]">
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <span key={n} className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
              {n}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
