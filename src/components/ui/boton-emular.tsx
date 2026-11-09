'use client';

import { useState } from 'react';
import { Loader2, VenetianMask } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';

// «Emular»: entra en la plataforma como esa persona (solo SuperTIC; la ficha está en docs/01-auth-roles.md).
// Lo usan Usuarios y roles y Profesorado. El servidor deja la cookie y se recarga el escritorio entero:
// tiene que pintarse todo como lo vería ella, y el indicador «Emulando a…» sale solo.
export function BotonEmular({ email, nombre, disabled }: { email: string; nombre: string | null; disabled?: boolean }) {
  const [entrando, setEntrando] = useState(false);

  async function emular() {
    setEntrando(true);
    try {
      const res = await fetch('/api/emulacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo emular');
      haptic.success();
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- recarga completa a propósito
      window.location.assign('/gestion');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error inesperado');
      haptic.warning();
      setEntrando(false);
    }
  }

  const quien = nombre ?? email;
  return (
    <button
      type="button"
      disabled={disabled || entrando}
      onClick={() => void emular()}
      title={`Ver la plataforma tal como la ve ${quien}`}
      aria-label={`Emular a ${quien}`}
      className="inline-flex h-10 items-center gap-1.5 rounded-full bg-amber-50 px-3.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200 transition-colors outline-none hover:bg-amber-100 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30 dark:hover:bg-amber-500/20"
    >
      {entrando ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> : <VenetianMask aria-hidden className="h-4 w-4" />}
      Emular
    </button>
  );
}
