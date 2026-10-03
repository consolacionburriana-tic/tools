'use client';

// El aviso de abajo a la izquierda de /gestion: «tienes 2 tareas vencidas · 1 para hoy». Sale
// en cualquier pantalla (menos en los propios tableros, que ya lo enseñan) y solo cuando hay
// algo vencido, para hoy o para mañana. Se puede ocultar hasta el día siguiente; si entretanto
// aparece algo nuevo, vuelve a salir.
//
// El layout de /gestion no se desmonta al navegar, así que esto es una petición al entrar y
// otra, como mucho, cada cinco minutos al volver a la pestaña.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { AlarmClock, ChevronRight, EyeOff, X } from 'lucide-react';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { esUrgente, estadoVence, resumenUrgente, textoResumenUrgente, type TarjetaMia } from '@/lib/tableros';
import { api, ChipVence } from './comun';

const SIN_AVISO = ['/gestion/tableros', '/gestion/login', '/gestion/sin-acceso'];
const CLAVE = 'tableros-aviso-oculto';
const CADA_MS = 5 * 60 * 1000;

function firma(hoy: string, tarjetas: TarjetaMia[]): string {
  return `${hoy}|${tarjetas
    .map((t) => t.id)
    .sort()
    .join(',')}`;
}

function leerOculto(): string | null {
  try {
    return window.localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}

export function AvisoTableros() {
  const ruta = usePathname();
  const [datos, setDatos] = useState<{ urgentes: TarjetaMia[]; hoy: string } | null>(null);
  const [oculto, setOculto] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const ultima = useRef(0);

  const cargar = useCallback(() => {
    ultima.current = Date.now();
    api
      .mias()
      .then(({ mias, hoy }) => setDatos({ hoy, urgentes: mias.filter((t) => esUrgente(estadoVence(t.vence, hoy).estado)) }))
      .catch(() => setDatos(null));
  }, []);

  useEffect(() => {
    // Lo oculto vive en el navegador (iPads compartidos: cada uno oculta lo suyo y se olvida al día siguiente).
    setOculto(leerOculto()); // eslint-disable-line react-hooks/set-state-in-effect -- se lee una vez al montar
    cargar();
    const alVolver = () => {
      if (document.visibilityState === 'visible' && Date.now() - ultima.current > CADA_MS) cargar();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [cargar]);

  // Al salir de un tablero, se vuelve a mirar: puede que se haya terminado algo.
  const enTableros = ruta.startsWith('/gestion/tableros');
  const estabaEnTableros = useRef(enTableros);
  useEffect(() => {
    if (estabaEnTableros.current && !enTableros) cargar();
    estabaEnTableros.current = enTableros;
  }, [enTableros, cargar]);

  if (!datos || datos.urgentes.length === 0) return null;
  if (SIN_AVISO.some((r) => ruta === r || ruta.startsWith(`${r}/`))) return null;
  const f = firma(datos.hoy, datos.urgentes);
  if (oculto === f) return null;

  const r = resumenUrgente(datos.urgentes, datos.hoy);
  const texto = textoResumenUrgente(r) ?? '';
  const rojo = r.vencidas > 0;

  function ocultar() {
    try {
      window.localStorage.setItem(CLAVE, f);
    } catch {
      /* sin almacenamiento: se oculta solo en esta visita */
    }
    setOculto(f);
    setAbierto(false);
  }

  const ordenadas = [...datos.urgentes].sort((a, b) => (a.vence ?? '').localeCompare(b.vence ?? ''));

  return (
    <div className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 z-40 print:hidden">
      <AnimatePresence mode="wait">
        {abierto ? (
          <motion.div
            key="panel"
            role="dialog"
            aria-label="Tus tareas urgentes"
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 12 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            style={{ transformOrigin: 'bottom left' }}
            className="w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-center gap-2.5 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
              <span
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full',
                  rojo ? 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400' : 'bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400',
                )}
              >
                <AlarmClock className="h-4 w-4" />
              </span>
              <p className="flex-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{texto}</p>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="max-h-72 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
              {ordenadas.slice(0, 8).map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/gestion/tableros/${t.tableroId}?t=${t.id}`}
                    onClick={() => setAbierto(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                  >
                    <span className="text-base">{t.tableroEmoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{t.titulo}</span>
                      <span className="block truncate text-xs text-zinc-500">
                        {t.equipoNombre} · {t.tableroNombre}
                      </span>
                    </span>
                    {t.vence && <ChipVence vence={t.vence} hoy={datos.hoy} />}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between gap-2 border-t border-zinc-100 px-3 py-2 dark:border-zinc-800">
              <button
                type="button"
                onClick={ocultar}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <EyeOff className="h-3.5 w-3.5" /> Ocultar hasta mañana
              </button>
              <Link
                href="/gestion/tableros"
                onClick={() => setAbierto(false)}
                className="inline-flex items-center gap-0.5 rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
              >
                Todo lo mío <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="pastilla"
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            onClick={() => {
              haptic.tap();
              setAbierto(true);
            }}
            aria-label={texto}
            title={texto}
            className={cn(
              // Blanca, como el botón de fallitos de la derecha; el color va solo en el punto y el texto.
              'flex items-center gap-2 rounded-full border border-zinc-200 bg-white/95 py-1.5 pr-3.5 pl-2 text-sm font-medium shadow-md backdrop-blur transition-colors hover:bg-white active:scale-95 dark:border-zinc-700 dark:bg-zinc-900/95 dark:hover:bg-zinc-900',
              rojo ? 'text-red-700 dark:text-red-300' : 'text-orange-700 dark:text-orange-300',
            )}
          >
            <span
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full',
                rojo ? 'bg-red-50 dark:bg-red-500/15' : 'bg-orange-50 dark:bg-orange-500/15',
              )}
            >
              <AlarmClock className="h-3.5 w-3.5" />
            </span>
            {/* En el móvil, solo el número: el texto entero tapaba media pantalla */}
            <span className="sm:hidden">{r.vencidas + r.hoy + r.manana}</span>
            <span className="hidden max-w-[50vw] truncate sm:inline">{texto}</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
