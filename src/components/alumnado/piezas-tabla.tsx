'use client';

// Piezas compartidas por las tablas de Alumnado (protección de datos, banco de libros, AMPA y
// materiales). Todas siguen las mismas dos reglas:
//
//  1. Un toque por celda, sin menús: es lo que se puede hacer con el dedo repasando una lista.
//  2. Lo masivo pide un segundo toque, y en él dice a cuántos va a afectar.

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';

/** Un cambio masivo esperando el «sí, hazlo»: qué va a pasar, en palabras, y a cuántos. */
export interface Pendiente {
  clave: string;
  pregunta: string;
  boton: string;
  tono: 'verde' | 'rojo' | 'neutro';
  hacer: () => Promise<unknown> | void;
}

/**
 * El estado de «qué se está guardando» y «qué espera confirmación», con el POST incluido.
 *
 * Lo masivo NO se confirma con un segundo toque sobre el mismo botón (así estuvo hasta el
 * 23-sep-2026 y David lo dio por roto: el primer toque solo cambiaba de color y parecía que no
 * hacía nada). Ahora el primer toque abre una barra que dice en palabras qué va a pasar y a
 * cuántos alumnos, con un botón grande para hacerlo y otro para cancelar.
 */
export function useGuardado() {
  const [guardando, setGuardando] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);

  async function enviar<T>(clave: string, url: string, cuerpo: unknown, avisoMasivo?: string): Promise<T | null> {
    haptic.tap();
    setGuardando(clave);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? 'No se pudo guardar');
      haptic.success();
      if (avisoMasivo) toast.success(avisoMasivo);
      return datos as T;
    } catch (error) {
      haptic.warning();
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar');
      return null;
    } finally {
      setGuardando(null);
    }
  }

  /** Primer paso de lo masivo: enseña la barra de confirmación. */
  function pedir(p: Pendiente) {
    haptic.tap();
    setPendiente(p);
  }

  async function confirmar() {
    if (!pendiente) return;
    const p = pendiente;
    setPendiente(null);
    await p.hacer();
  }

  const confirmacion = (
    <BarraConfirmacion
      pendiente={pendiente}
      ocupada={Boolean(pendiente && guardando === pendiente.clave)}
      onConfirmar={() => void confirmar()}
      onCancelar={() => setPendiente(null)}
    />
  );

  return { guardando, pendiente, enviar, pedir, confirmacion };
}

function BarraConfirmacion({
  pendiente,
  ocupada,
  onConfirmar,
  onCancelar,
}: {
  pendiente: Pendiente | null;
  ocupada: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  if (!pendiente) return null;
  const color =
    pendiente.tono === 'verde'
      ? 'bg-emerald-600 hover:bg-emerald-700'
      : pendiente.tono === 'rojo'
        ? 'bg-red-600 hover:bg-red-700'
        : 'bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900';
  return (
    <div
      role="alertdialog"
      aria-label="Confirmar cambio masivo"
      className="sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 shadow-md ring-2 ring-amber-400 dark:bg-amber-950/80 dark:ring-amber-600"
    >
      <p className="mr-auto text-sm font-medium text-amber-900 dark:text-amber-100">{pendiente.pregunta}</p>
      <button
        type="button"
        onClick={onCancelar}
        className="rounded-xl px-3.5 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-900"
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={onConfirmar}
        disabled={ocupada}
        autoFocus
        className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${color}`}
      >
        {ocupada && <Loader2 className="h-4 w-4 animate-spin" />}
        {pendiente.boton}
      </button>
    </div>
  );
}

export const CELDA_TONO = {
  si: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60',
  no: 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950/60 dark:text-red-300 dark:hover:bg-red-900/60',
  aviso: 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900/60',
  beca: 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60',
  gris: 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-500 dark:hover:bg-zinc-700',
} as const;
export type TonoTabla = keyof typeof CELDA_TONO;

export function Celda({
  tono,
  editable,
  ocupada,
  etiqueta,
  onTocar,
  ancho = 'w-10',
  children,
}: {
  tono: TonoTabla;
  editable: boolean;
  ocupada: boolean;
  etiqueta: string;
  onTocar: () => void;
  ancho?: string;
  children: React.ReactNode;
}) {
  const contenido = ocupada ? <Loader2 className="h-4 w-4 animate-spin" /> : children;
  if (!editable) {
    return (
      <span
        aria-label={etiqueta}
        title={etiqueta}
        className={`pointer-events-none inline-flex h-8 min-w-9 items-center justify-center rounded-lg px-1 text-[11px] font-semibold ${CELDA_TONO[tono]}`}
      >
        {contenido}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onTocar}
      disabled={ocupada}
      aria-label={etiqueta}
      title={etiqueta}
      className={`inline-flex h-9 ${ancho} items-center justify-center rounded-lg px-1 text-[11px] font-semibold transition-colors disabled:opacity-60 ${CELDA_TONO[tono]}`}
    >
      {contenido}
    </button>
  );
}

/** Botón de una columna entera («Todos sí»): con TEXTO, no solo un icono. */
export function ColumnaBoton({
  activa,
  ocupada,
  tono,
  titulo,
  texto,
  onClick,
  children,
}: {
  /** Es el que está esperando confirmación. */
  activa: boolean;
  ocupada: boolean;
  tono: 'verde' | 'rojo' | 'azul' | 'gris';
  titulo: string;
  /** Lo que pone el botón. Sin texto (editar, borrar) queda solo el icono. */
  texto?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const base = {
    verde: 'bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
    rojo: 'bg-red-50 text-red-700 ring-red-200 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900',
    azul: 'bg-blue-50 text-blue-700 ring-blue-200 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900',
    gris: 'bg-zinc-50 text-zinc-600 ring-zinc-200 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700',
  }[tono];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={ocupada}
      title={titulo}
      aria-label={titulo}
      className={`inline-flex h-7 items-center justify-center gap-1 whitespace-nowrap rounded-lg px-2 text-[11px] font-semibold ring-1 transition-colors disabled:opacity-60 ${base} ${
        activa ? 'ring-2 ring-amber-400' : ''
      }`}
    >
      {ocupada ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : children}
      {texto}
    </button>
  );
}

export function BotonMasivo({
  activa,
  ocupada,
  texto,
  tono = 'neutro',
  onClick,
  icono,
}: {
  activa: boolean;
  ocupada: boolean;
  texto: string;
  tono?: 'verde' | 'gris' | 'neutro';
  onClick: () => void;
  icono?: React.ReactNode;
}) {
  const colores =
    tono === 'verde'
      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
      : tono === 'gris'
        ? 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
        : 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={ocupada}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors disabled:opacity-60 ${
        activa ? `${colores} ring-2 ring-amber-400` : colores
      }`}
    >
      {ocupada ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icono}
      {texto}
    </button>
  );
}

/** La barra de arriba de cada tabla: de qué va, a cuántos, y las acciones. */
export function BarraTabla({ ambito, cuantos, extra, children }: { ambito: string; cuantos: number; extra?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white px-3.5 py-3 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
      <p className="mr-auto text-xs text-zinc-500">
        <span className="font-medium text-zinc-700 dark:text-zinc-200">{ambito}</span> · {cuantos}{' '}
        {cuantos === 1 ? 'alumno' : 'alumnos'}
        {extra}
      </p>
      {children}
    </div>
  );
}

/** Nombre del alumno en la primera columna, con su nº de lista y, si toca, la clase. */
export function CeldaAlumno({ numero, nombre, clase }: { numero: number | null; nombre: string; clase?: string }) {
  return (
    <td className="max-w-[15rem] p-2 text-zinc-800 dark:text-zinc-100">
      <span className="block truncate">
        {numero !== null && <span className="mr-1.5 text-xs text-zinc-400">{numero}</span>}
        {nombre}
      </span>
      {clase && <span className="block truncate text-[11px] text-zinc-400">{clase}</span>}
    </td>
  );
}
