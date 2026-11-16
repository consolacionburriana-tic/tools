'use client';

import { useSyncExternalStore } from 'react';
import { Search } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';

// La paleta avisa con este evento al montarse; la lupa solo sale si hay paleta (fuera de /gestion,
// en una pantalla sin sesión, no la hay).
const LISTA = 'paleta-lista';
const suscribir = (cb: () => void) => {
  window.addEventListener(LISTA, cb);
  return () => window.removeEventListener(LISTA, cb);
};
const hayPaleta = () => document.documentElement.dataset.paleta === '1';

export function avisarPaletaLista(montada: boolean) {
  if (montada) document.documentElement.dataset.paleta = '1';
  else delete document.documentElement.dataset.paleta;
  window.dispatchEvent(new Event(LISTA));
}

/** La lupa de la barra de arriba: abre la paleta de ⌘K (para el iPad sin teclado). */
export function BotonPaleta() {
  const visible = useSyncExternalStore(suscribir, hayPaleta, () => false);
  if (!visible) return null;
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event('abrir-paleta'))}
      className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
      aria-label="Buscar o apuntar una tarea (⌘K)"
      title="Buscar o apuntar una tarea (⌘K)"
    >
      <Search aria-hidden />
    </button>
  );
}
