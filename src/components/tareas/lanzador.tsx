'use client';

// El botón de abajo a la derecha de /gestion: apuntar un fallito (o una idea de módulo) en
// dos segundos, sin salir de la pantalla en la que se ha visto. Tiene que pasar
// desapercibido cuando no se usa: pequeño, medio transparente y fuera del sitio donde
// viven los botones de guardar de los formularios (abajo, a todo el ancho).
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Lightbulb, ListTodo, Maximize2, X } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { estaAbierta, etiquetaModulo, promptTarea, type Tarea } from '@/lib/tareas';
import { apiTareas, BotonCopiar, EstadoBadge } from './comun';
import { FormFallo, FormModulo } from './formularios';

// Pantallas donde el botón sobra: el propio tablero, y las de antes de entrar.
const SIN_LANZADOR = ['/gestion/tareas', '/gestion/login', '/gestion/sin-acceso'];

export function LanzadorTareas({ gestiona }: { gestiona: boolean }) {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [pestana, setPestana] = useState<'fallo' | 'modulo'>('fallo');
  const [tareas, setTareas] = useState<Tarea[] | null>(null);

  const cargar = useCallback(() => {
    apiTareas
      .listar()
      .then(setTareas)
      .catch(() => setTareas([]));
  }, []);

  // Quien lleva el tablero ve cuántos fallitos quedan en el propio botón; el layout de
  // /gestion no se desmonta al navegar, así que esto es una petición por sesión, no por página.
  useEffect(() => {
    if (gestiona) cargar();
  }, [gestiona, cargar]);

  useEffect(() => {
    if (!abierto) return;
    if (!gestiona) cargar();
    const alPulsar = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [abierto, gestiona, cargar]);

  if (SIN_LANZADOR.some((r) => ruta === r || ruta.startsWith(`${r}/`))) return null;

  const abiertas = (tareas ?? []).filter((t) => estaAbierta(t.estado));
  const fallosAbiertos = abiertas.filter((t) => t.tipo === 'fallo');
  // Quien gestiona: lo último que queda por hacer. Quien reporta: lo suyo, para ver si ya está.
  const recientes = gestiona ? fallosAbiertos.slice(0, 5) : (tareas ?? []).slice(0, 5);

  function alCrear(t: Tarea) {
    setTareas((prev) => [t, ...(prev ?? [])]);
  }

  async function marcarHecho(t: Tarea) {
    setTareas((prev) => prev?.map((x) => (x.id === t.id ? { ...x, estado: 'hecho' } : x)) ?? prev);
    haptic.success();
    try {
      await apiTareas.actualizar(t.id, { estado: 'hecho' });
    } catch {
      toast.error('No se ha podido marcar');
      cargar();
    }
  }

  return (
    <>
      <AnimatePresence>
        {!abierto && (
          <motion.button
            key="boton"
            type="button"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => {
              haptic.tap();
              setAbierto(true);
            }}
            title="Apuntar un fallito o una idea"
            aria-label="Apuntar un fallito o una idea"
            className="fixed right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white/80 text-zinc-500 opacity-60 shadow-sm backdrop-blur transition-opacity hover:text-blue-600 hover:opacity-100 focus-visible:opacity-100 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-400 dark:hover:text-blue-400 print:hidden"
          >
            <ListTodo className="h-[18px] w-[18px]" />
            {gestiona && fallosAbiertos.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold text-white">
                {fallosAbiertos.length > 99 ? '99+' : fallosAbiertos.length}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {abierto && (
          <motion.div
            key="panel"
            role="dialog"
            aria-label="Apuntar tarea"
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 12 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            style={{ transformOrigin: 'bottom right' }}
            className="fixed right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 flex max-h-[min(40rem,calc(100dvh-1.5rem))] w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 print:hidden"
          >
            <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
              {gestiona ? (
                <div className="flex flex-1 rounded-lg bg-zinc-100 p-0.5 text-xs dark:bg-zinc-800">
                  {(
                    [
                      ['fallo', 'Fallito', ListTodo],
                      ['modulo', 'Módulo nuevo', Lightbulb],
                    ] as const
                  ).map(([id, etiqueta, Icono]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPestana(id)}
                      className={cn(
                        'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 font-medium transition-colors',
                        pestana === id
                          ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100'
                          : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200',
                      )}
                    >
                      <Icono className="h-3.5 w-3.5" /> {etiqueta}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="flex-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Apuntar un fallito</p>
              )}
              {gestiona && (
                <Link
                  href="/gestion/tareas"
                  onClick={() => setAbierto(false)}
                  title="Pantalla completa"
                  aria-label="Pantalla completa"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                >
                  <Maximize2 className="h-4 w-4" />
                </Link>
              )}
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto p-3">
              {pestana === 'modulo' && gestiona ? (
                <FormModulo onCreada={alCrear} autoFocus />
              ) : (
                <FormFallo ruta={ruta} onCreada={alCrear} autoFocus />
              )}

              {pestana === 'fallo' && recientes.length > 0 && (
                <div className="mt-4">
                  <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">
                    {gestiona ? `Pendientes · ${fallosAbiertos.length}` : 'Lo que has apuntado'}
                  </p>
                  <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {recientes.map((t) => (
                      <li key={t.id} className="flex items-start gap-2 py-2">
                        {gestiona ? (
                          <button
                            type="button"
                            onClick={() => marcarHecho(t)}
                            title="Marcar como hecho"
                            aria-label="Marcar como hecho"
                            className="group mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-transparent transition-colors hover:border-emerald-500 hover:text-emerald-500 dark:border-zinc-600"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-snug text-zinc-800 dark:text-zinc-200">{t.titulo}</p>
                          <p className="mt-0.5 text-[11px] text-zinc-400">{etiquetaModulo(t.modulo)}</p>
                        </div>
                        {gestiona ? (
                          <BotonCopiar texto={() => promptTarea(t)} compacto />
                        ) : (
                          <EstadoBadge estado={t.estado} />
                        )}
                      </li>
                    ))}
                  </ul>
                  {gestiona && fallosAbiertos.length > recientes.length && (
                    <Link
                      href="/gestion/tareas"
                      onClick={() => setAbierto(false)}
                      className="mt-1 block text-center text-xs text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Ver los {fallosAbiertos.length} →
                    </Link>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
