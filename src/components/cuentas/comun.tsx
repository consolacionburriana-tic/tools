'use client';

// Piezas compartidas de Correos y grupos: llamadas a la API, chips de estado, fechas, la
// confirmación escribiendo una palabra y la barra de progreso de las tandas.
import { useState } from 'react';
import { Check, Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { ESTADO_LABEL, nombreUo, type EstadoFila } from '@/lib/cuentas';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// ─── API ─────────────────────────────────────────────────────────────────────

export async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: init?.body ? { 'Content-Type': 'application/json' } : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? `Error ${r.status}`);
  return j as T;
}

export const post = <T,>(url: string, body: unknown, method: 'POST' | 'PUT' = 'POST') =>
  pedir<T>(url, { method, body: JSON.stringify(body) });

/** Parte una lista en tandas y las manda una detrás de otra, contando el progreso. */
export async function enTandas<T, R>(
  items: readonly T[],
  tamano: number,
  enviar: (tanda: T[]) => Promise<R[]>,
  alAvanzar: (hechos: number, total: number) => void,
): Promise<R[]> {
  const salida: R[] = [];
  for (let i = 0; i < items.length; i += tamano) {
    alAvanzar(i, items.length);
    salida.push(...(await enviar(items.slice(i, i + tamano))));
  }
  alAvanzar(items.length, items.length);
  return salida;
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

export const CAMPO =
  'h-10 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100';

export const BOTON =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-default disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800';

export const BOTON_PRIMARIO =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-default disabled:opacity-50';

export const TARJETA = 'rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900';

const TONO_ESTADO: Record<EstadoFila, string> = {
  ok: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  fuera: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  suspendida: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  'sin-correo': 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  'no-le-toca': 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  baja: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  'baja-espera': 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  suelta: 'bg-orange-50 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300',
  marcada: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  archivar: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  archivada: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
};

export function ChipEstado({ estado, texto }: { estado: EstadoFila; texto?: string }) {
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap', TONO_ESTADO[estado])}>
      {texto ?? ESTADO_LABEL[estado]}
    </span>
  );
}

export function ChipUo({ ruta, title }: { ruta: string; title?: string }) {
  return (
    <span
      title={title ?? ruta}
      className="inline-flex max-w-56 items-center truncate rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
    >
      {nombreUo(ruta)}
    </span>
  );
}

// ─── Fechas ──────────────────────────────────────────────────────────────────

const FECHA = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Madrid' });
const FECHA_HORA = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Madrid',
});

export const fecha = (s: string | null) => (s ? FECHA.format(new Date(s.length === 10 ? `${s}T12:00:00Z` : s)) : '—');
export const fechaHora = (s: string | null) => (s ? FECHA_HORA.format(new Date(s)) : '—');

/** «hace 3 min», «hace 14 meses», «nunca». */
export function haceTiempo(s: string | null, ahora = Date.now()): string {
  if (!s) return 'nunca';
  const seg = Math.max(0, (ahora - new Date(s).getTime()) / 1000);
  if (seg < 90) return 'ahora mismo';
  const min = seg / 60;
  if (min < 60) return `hace ${Math.round(min)} min`;
  const horas = min / 60;
  if (horas < 24) return `hace ${Math.round(horas)} h`;
  const dias = horas / 24;
  if (dias < 45) return `hace ${Math.round(dias)} días`;
  const meses = dias / 30.4;
  if (meses < 24) return `hace ${Math.round(meses)} meses`;
  return `hace ${Math.round(meses / 12)} años`;
}

// ─── Copiar ──────────────────────────────────────────────────────────────────

export function BotonCopiar({ texto, etiqueta = 'Copiar', className }: { texto: string; etiqueta?: string; className?: string }) {
  const [hecho, setHecho] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          haptic.tap();
          setHecho(true);
          setTimeout(() => setHecho(false), 1500);
        } catch {
          toast.error('No se ha podido copiar');
        }
      }}
      className={cn(BOTON, 'h-9', className)}
    >
      {hecho ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />} {etiqueta}
    </button>
  );
}

/** Descarga un CSV (separado por `;`, con BOM para que Excel lo abra con acentos). */
export function descargarCsv(nombre: string, filas: (string | number | null)[][]) {
  const texto = filas
    .map((f) => f.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';'))
    .join('\r\n');
  const blob = new Blob(['﻿', texto], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Progreso y confirmación ─────────────────────────────────────────────────

export function Progreso({ texto, hechos, total }: { texto: string; hechos?: number; total?: number }) {
  const pct = total ? Math.round(((hechos ?? 0) / total) * 100) : null;
  return (
    <div className="space-y-1.5 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:bg-blue-500/10 dark:text-blue-200">
      <p className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> {texto}
        {total ? <span className="ml-auto font-mono text-xs">{hechos}/{total}</span> : null}
      </p>
      {pct !== null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-500/20">
          <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

/** Confirmación que obliga a escribir una palabra (SUSPENDER, QUITAR…). */
export function ConfirmarPalabra({
  abierto,
  titulo,
  descripcion,
  palabra,
  boton,
  peligro = true,
  children,
  onCerrar,
  onConfirmar,
}: {
  abierto: boolean;
  titulo: string;
  descripcion: string;
  palabra: string;
  boton: string;
  peligro?: boolean;
  children?: React.ReactNode;
  onCerrar: () => void;
  onConfirmar: () => void;
}) {
  const [texto, setTexto] = useState('');
  const cerrar = () => {
    setTexto('');
    onCerrar();
  };
  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && cerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descripcion}</DialogDescription>
        </DialogHeader>
        {children}
        <label className="text-sm text-zinc-600 dark:text-zinc-300">
          Escribe <b>{palabra}</b> para confirmar
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            autoFocus
            className={cn(CAMPO, 'mt-1')}
          />
        </label>
        <DialogFooter>
          <button type="button" onClick={cerrar} className={BOTON}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={texto.trim().toUpperCase() !== palabra}
            onClick={() => {
              setTexto('');
              onConfirmar();
            }}
            className={cn(
              'inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-white disabled:cursor-default disabled:opacity-40',
              peligro ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700',
            )}
          >
            {boton}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Una línea de «se ha hecho / ha fallado» tras una tanda. */
export function avisarResultado(ok: number, fallos: number, hecho: string) {
  if (fallos === 0) {
    haptic.success();
    toast.success(`${ok} ${hecho}`);
  } else {
    haptic.warning();
    toast.warning(`${ok} ${hecho} · ${fallos} no se han podido (mira el motivo en cada una)`);
  }
}
