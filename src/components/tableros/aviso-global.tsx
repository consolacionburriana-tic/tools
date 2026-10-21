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
import { Button, buttonVariants } from '@/components/ui/button';
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
                  rojo ? 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
                )}
              >
                <AlarmClock className="h-4 w-4" />
              </span>
              <p className="flex-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{texto}</p>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setAbierto(false)} aria-label="Cerrar" className="-mr-2">
                <X aria-hidden />
              </Button>
            </div>
            <ul className="max-h-72 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
              {ordenadas.slice(0, 8).map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/gestion/tableros/${t.tableroId}?t=${t.id}`}
                    onClick={() => setAbierto(false)}
                    className="flex min-h-11 items-center gap-2.5 px-4 py-2.5 outline-none hover:bg-zinc-50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset dark:hover:bg-zinc-800/60"
                  >
                    <span aria-hidden className="text-base">{t.tableroEmoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{t.titulo}</span>
                      <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {t.equipoNombre} · {t.tableroNombre}
                      </span>
                    </span>
                    {t.vence && <ChipVence vence={t.vence} hoy={datos.hoy} />}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between gap-2 border-t border-zinc-100 px-3 py-2 dark:border-zinc-800">
              <Button type="button" variant="ghost" size="sm" onClick={ocultar} className="px-2.5">
                <EyeOff aria-hidden /> Ocultar hasta mañana
              </Button>
              <Link
                href="/gestion/tableros"
                onClick={() => setAbierto(false)}
                className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'px-2.5 text-blue-700 dark:text-blue-400' })}
              >
                Todo lo mío <ChevronRight aria-hidden />
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
            className={cn(
              // Blanca, como el botón de fallitos de la derecha; el color va solo en el punto y el texto.
              'flex min-h-10 items-center gap-2 rounded-full border border-zinc-200 bg-white/95 py-1.5 pr-3.5 pl-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 text-sm font-medium shadow-md backdrop-blur transition-colors hover:bg-white active:scale-95 dark:border-zinc-700 dark:bg-zinc-900/95 dark:hover:bg-zinc-900',
              rojo ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300',
            )}
          >
            <span
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full',
                rojo ? 'bg-red-50 dark:bg-red-500/15' : 'bg-amber-50 dark:bg-amber-500/15',
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
