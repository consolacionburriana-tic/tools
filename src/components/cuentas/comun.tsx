'use client';

// Piezas compartidas de Correos y grupos: llamadas a la API, el estado de cada fila, fechas,
// copiar y el aviso de cómo ha ido una tanda.
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { ESTADO_LABEL, type EstadoFila } from '@/lib/cuentas';
import { Button } from '@/components/ui/button';
import { copiarTexto } from '@/components/ui/copiable';
import { Estado, type TonoEstado } from '@/components/ui/estado';

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

// ─── Estado de una fila ──────────────────────────────────────────────────────

/** El tono de cada estado: verde en su sitio, ámbar lo que hay que mover o revisar, rojo lo que
 * hay que suspender o reactivar, azul lo que falta crear y gris lo que no pide nada. */
const TONO_ESTADO: Record<EstadoFila, TonoEstado> = {
  ok: 'ok',
  fuera: 'aviso',
  suspendida: 'error',
  'sin-correo': 'info',
  'no-le-toca': 'neutro',
  baja: 'error',
  'baja-espera': 'neutro',
  suelta: 'aviso',
  marcada: 'neutro',
  archivar: 'aviso',
  archivada: 'neutro',
};

export function EstadoCuenta({ estado, texto }: { estado: EstadoFila; texto?: string }) {
  return <Estado tono={TONO_ESTADO[estado]}>{texto ?? ESTADO_LABEL[estado]}</Estado>;
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

/** Copiar algo largo (la tabla de contraseñas, una contraseña) con un botón que dice «Copiado». */
export function BotonCopiar({ texto, etiqueta = 'Copiar', className }: { texto: string; etiqueta?: string; className?: string }) {
  const [hecho, setHecho] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      onClick={async () => {
        if (!(await copiarTexto(texto))) {
          toast.error('No se ha podido copiar');
          return;
        }
        haptic.success();
        setHecho(true);
        setTimeout(() => setHecho(false), 1500);
      }}
    >
      {hecho ? <Check className="text-emerald-600 dark:text-emerald-400" /> : <Copy />}
      {hecho ? 'Copiado' : etiqueta}
    </Button>
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

// ─── Resultado de una tanda ──────────────────────────────────────────────────

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
