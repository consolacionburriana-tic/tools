'use client';

// Copiar de un toque. Es el gesto que más se repite en toda la ficha —un NIA para un
// formulario, un correo para escribir, un teléfono para llamar— así que tiene que costar
// un solo dedo y confirmar sin robar la atención.
//
// Decisiones de uso, que son lo que lo hace cómodo de verdad:
//  · **el valor entero es el botón**, no un iconito de 16px al lado (en iPad, un objetivo
//    táctil de 16px es un objetivo que se falla);
//  · confirma cambiando el propio texto por «copiado» un segundo y con un haptic, sin
//    toast: un toast por cada NIA copiado sería insufrible;
//  · `document.execCommand` de respaldo, porque `navigator.clipboard` no existe fuera de
//    contexto seguro y los iPads del colegio entran por IP local más de lo que parece.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { haptic } from '@/lib/haptics';

export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // Sigue al respaldo: puede fallar por permisos o por no estar en contexto seguro.
  }
  try {
    const area = document.createElement('textarea');
    area.value = texto;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

interface Props {
  /** Lo que se copia. Si no se pasa `children`, es también lo que se pinta. */
  valor: string;
  children?: React.ReactNode;
  /** Título de la fila («NIA», «Correo de la madre»). */
  etiqueta?: string;
  className?: string;
  /** Tipografía tabular y algo más grande: para NIA, DNI y teléfonos. */
  mono?: boolean;
  /** `true` = el texto puede ocupar varias líneas en vez de cortarse con «…». */
  multilinea?: boolean;
}

export function Copiable({ valor, children, etiqueta, className = '', mono, multilinea }: Props) {
  const [copiado, setCopiado] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (temporizador.current) clearTimeout(temporizador.current); }, []);

  const copiar = useCallback(async () => {
    const ok = await copiarTexto(valor);
    if (!ok) return;
    haptic.success();
    setCopiado(true);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setCopiado(false), 1200);
  }, [valor]);

  return (
    <button
      type="button"
      onClick={copiar}
      title={etiqueta ? `Copiar ${etiqueta.toLowerCase()}` : 'Copiar'}
      aria-label={etiqueta ? `Copiar ${etiqueta.toLowerCase()}: ${valor}` : `Copiar ${valor}`}
      className={`group inline-flex max-w-full items-center gap-1.5 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-zinc-100 active:bg-zinc-200 dark:hover:bg-zinc-800 dark:active:bg-zinc-700 ${
        mono ? 'font-mono tabular-nums' : ''
      } ${className}`}
    >
      <span
        className={`min-w-0 ${multilinea ? '' : 'truncate'} ${copiado ? 'text-emerald-600 dark:text-emerald-400' : ''}`}
      >
        {copiado ? 'copiado' : (children ?? valor)}
      </span>
      {copiado ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Copy className="h-3.5 w-3.5 shrink-0 text-zinc-300 transition-colors group-hover:text-zinc-500 dark:text-zinc-600 dark:group-hover:text-zinc-400" />
      )}
    </button>
  );
}

/** Fila «etiqueta + valor copiable», la unidad con la que está hecha media ficha. */
export function Dato({
  etiqueta,
  valor,
  mono,
  children,
}: {
  etiqueta: string;
  valor: string | null | undefined;
  mono?: boolean;
  children?: React.ReactNode;
}) {
  const limpio = (valor ?? '').trim();
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-2 py-0.5">
      <span className="shrink-0 text-xs text-zinc-400">{etiqueta}</span>
      {limpio ? (
        <Copiable
          valor={limpio}
          etiqueta={etiqueta}
          mono={mono}
          className="min-w-0 text-sm text-zinc-800 dark:text-zinc-100"
        >
          {children ?? limpio}
        </Copiable>
      ) : (
        <span className="text-sm text-zinc-300 dark:text-zinc-600">—</span>
      )}
    </div>
  );
}

/** Botón para copiar de golpe una lista (todos los correos de la familia, p. ej.). */
export function CopiarLista({
  valores,
  etiqueta,
  separador = ', ',
}: {
  valores: readonly string[];
  etiqueta: string;
  separador?: string;
}) {
  const [copiado, setCopiado] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (temporizador.current) clearTimeout(temporizador.current); }, []);
  if (valores.length === 0) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        if (!(await copiarTexto(valores.join(separador)))) return;
        haptic.success();
        setCopiado(true);
        if (temporizador.current) clearTimeout(temporizador.current);
        temporizador.current = setTimeout(() => setCopiado(false), 1400);
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      {copiado ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Copiado
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" /> {etiqueta} ({valores.length})
        </>
      )}
    </button>
  );
}
