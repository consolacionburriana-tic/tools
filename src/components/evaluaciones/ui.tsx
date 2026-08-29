'use client';

// Vocabulario visual del módulo de Evaluaciones. Vive aquí y no suelto por cada
// componente porque el problema que resuelve es de CONJUNTO: antes cada pantalla
// inventaba sus propios bordes, radios y espaciados, y el resultado era que todo
// pesaba visualmente igual — nada destacaba y nada se agrupaba.
//
// La regla es una jerarquía de tres niveles, y cada uno se distingue por SUPERFICIE,
// no por más bordes:
//
//   Nivel 0 · la página        → fondo gris muy claro
//   Nivel 1 · panel            → blanco elevado con un anillo finísimo (`PANEL`)
//   Nivel 2 · actividad        → NO es una caja: es un encabezado + una guía de color
//                                vertical que enhebra sus preguntas (`GuiaActividad`)
//   Nivel 3 · pregunta         → tarjeta blanca discreta dentro de la guía
//
// Y una decisión que quita la mitad del ruido: los campos de texto no llevan borde
// permanente. Se insinúan con un fondo tenue y solo se "encienden" al enfocarlos
// (edición en sitio). Un editor no debería parecer un formulario de alta.
import { ChevronDown } from 'lucide-react';

// ─── Superficies ──────────────────────────────────────────────────────────────

/** Panel de nivel 1: lo que antes era `border border-zinc-200`, con menos peso. */
export const PANEL =
  'rounded-2xl bg-white ring-1 ring-zinc-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:bg-zinc-900 dark:ring-zinc-800';

/** Tarjeta de nivel 3 (preguntas): más pequeña y más callada que un panel. */
export const TARJETA =
  'rounded-xl bg-white ring-1 ring-zinc-200/60 dark:bg-zinc-900 dark:ring-zinc-800';

// ─── Campos de texto ──────────────────────────────────────────────────────────

const CAMPO_BASE =
  'w-full rounded-lg bg-transparent ring-1 ring-transparent transition-[background-color,box-shadow] duration-150 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:bg-zinc-800';

/** Título grande editable: parece un título hasta que lo tocas. */
export const CAMPO_TITULO = `${CAMPO_BASE} px-2 py-1 text-xl font-bold tracking-tight text-zinc-900 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800/70`;

/** Campo normal: fondo tenue permanente (en iPad no hay hover que lo revele). */
export const CAMPO = `${CAMPO_BASE} bg-zinc-50 px-3 py-2 text-sm text-zinc-900 hover:bg-zinc-100 dark:bg-zinc-800/40 dark:text-zinc-100 dark:hover:bg-zinc-800/70`;

/** Campo compacto, para filas y opciones dentro de una pregunta. */
export const CAMPO_MINI = `${CAMPO_BASE} bg-zinc-50 px-2.5 py-1.5 text-sm text-zinc-900 hover:bg-zinc-100 dark:bg-zinc-800/40 dark:text-zinc-100 dark:hover:bg-zinc-800/70`;

// ─── Botones ──────────────────────────────────────────────────────────────────

/** Acción secundaria: sin borde, se rellena al pasar por encima. */
export const BTN_SUAVE =
  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors duration-150 hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800';

/** Acción principal de una zona. */
export const BTN_PRIMARIO =
  'inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-150 hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white';

/** Icono de acción sobre una tarjeta: callado hasta que hace falta. */
export const BTN_ICONO =
  'rounded-md p-1.5 text-zinc-400 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200';

// ─── Piezas ───────────────────────────────────────────────────────────────────

/** Rótulo de sección. Pequeño, en versalitas, gris: ordena sin gritar. */
export function Rotulo({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 ${className}`}>
      {children}
    </p>
  );
}

/** Dato de cabecera: etiqueta arriba en gris, valor debajo. */
export function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{etiqueta}</span>
      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{children}</span>
    </span>
  );
}

/**
 * Control segmentado (elige uno de N). Sustituye a N botones sueltos: al ir dentro
 * de un mismo carril con fondo, se lee de un golpe que son alternativas de lo mismo
 * y cuál está activa — que era justo lo que no se distinguía.
 */
export function Segmentado<T extends string>({
  opciones,
  valor,
  onChange,
}: {
  opciones: { valor: T; label: string; deshabilitada?: boolean; pista?: string; tono?: 'normal' | 'verde' }[];
  valor: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
      {opciones.map((o) => {
        const activa = valor === o.valor;
        return (
          <button
            key={o.valor}
            type="button"
            disabled={o.deshabilitada}
            title={o.pista}
            onClick={() => onChange(o.valor)}
            className={`rounded-[7px] px-3 py-1 text-xs font-semibold capitalize transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${
              activa
                ? o.tono === 'verde'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50'
                : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Guía vertical del color de la actividad. Es la pieza que resuelve "no diferencio
 * bien las cosas": una línea fina del color de la actividad recorre todas SUS
 * preguntas, así que se ve de un vistazo dónde empieza y acaba cada bloque sin
 * necesidad de meterlo todo en otra caja gris.
 */
export function GuiaActividad({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div className="relative pl-4 sm:pl-5">
      <span
        aria-hidden
        style={{ background: color }}
        className="absolute bottom-1 left-0 top-1 w-[3px] rounded-full opacity-70"
      />
      {children}
    </div>
  );
}

/** Cabecera plegable de una zona secundaria (ajustes, catálogo…). */
export function Plegable({
  titulo,
  icono,
  abierto,
  onToggle,
  children,
}: {
  titulo: string;
  icono?: React.ReactNode;
  abierto: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={PANEL}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200"
      >
        {icono}
        {titulo}
        <ChevronDown
          className={`ml-auto h-4 w-4 text-zinc-400 transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`}
        />
      </button>
      {abierto && <div className="border-t border-zinc-100 p-4 dark:border-zinc-800">{children}</div>}
    </div>
  );
}
