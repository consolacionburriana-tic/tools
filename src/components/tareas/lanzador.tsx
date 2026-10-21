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
import { estaAbierta, etiquetaModulo, promptTarea, type Tarea } from '@/lib/tareas';
import { Button, buttonVariants } from '@/components/ui/button';
import { Segmentado } from '@/components/ui/segmentado';
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
            aria-label="Apuntar un fallito o una idea"
            className="fixed right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white/80 text-zinc-500 opacity-60 shadow-sm backdrop-blur transition-opacity hover:text-blue-600 hover:opacity-100 focus-visible:opacity-100 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-400 dark:hover:text-blue-400 print:hidden"
          >
            <ListTodo className="h-[18px] w-[18px]" />
            {gestiona && fallosAbiertos.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-xs font-semibold text-white tabular-nums">
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
                <Segmentado
                  etiqueta="Qué apuntas"
                  lleno
                  className="flex-1"
                  valor={pestana}
                  onChange={setPestana}
                  opciones={[
                    { valor: 'fallo', etiqueta: 'Fallito', icono: <ListTodo aria-hidden /> },
                    { valor: 'modulo', etiqueta: 'Módulo nuevo', icono: <Lightbulb aria-hidden /> },
                  ]}
                />
              ) : (
                <p className="flex-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Apuntar un fallito</p>
              )}
              {gestiona && (
                <Link
                  href="/gestion/tareas"
                  onClick={() => setAbierto(false)}
                  aria-label="Pantalla completa"
                  className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
                >
                  <Maximize2 aria-hidden />
                </Link>
              )}
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setAbierto(false)} aria-label="Cerrar">
                <X aria-hidden />
              </Button>
            </div>

            <div className="overflow-y-auto p-3">
              {pestana === 'modulo' && gestiona ? (
                <FormModulo onCreada={alCrear} autoFocus />
              ) : (
                <FormFallo ruta={ruta} onCreada={alCrear} autoFocus />
              )}

              {pestana === 'fallo' && recientes.length > 0 && (
                <div className="mt-4">
                  <p className="mb-1.5 text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                    {gestiona ? `Pendientes · ${fallosAbiertos.length}` : 'Lo que has apuntado'}
                  </p>
                  <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {recientes.map((t) => (
                      <li key={t.id} className="flex items-start gap-2 py-2">
                        {gestiona ? (
                          <button
                            type="button"
                            onClick={() => marcarHecho(t)}
                            aria-label="Marcar como hecho"
                            className="-my-2 -ml-2 flex size-10 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                          >
                            <span className="flex size-5 items-center justify-center rounded-full border border-zinc-300 text-transparent transition-colors hover:border-emerald-500 hover:text-emerald-500 dark:border-zinc-600">
                              <Check aria-hidden className="size-3" />
                            </span>
                          </button>
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-snug text-zinc-800 dark:text-zinc-200">{t.titulo}</p>
                          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{etiquetaModulo(t.modulo)}</p>
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
                      className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'mt-1 w-full' })}
                    >
                      Ver los {fallosAbiertos.length}
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
