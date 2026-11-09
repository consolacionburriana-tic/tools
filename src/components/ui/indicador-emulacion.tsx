'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { LogOut } from 'lucide-react';
import { COOKIE_EMULACION_AVISO } from '@/lib/emulacion';

// El aviso de «estás emulando a…»: una pestañita pequeña colgada del borde de arriba, con un punto que
// late, y un «Salir» a mano. Vive en el layout raíz y se pinta desde una cookie cosmética (solo lleva el
// nombre), así que no obliga a ninguna página pública a volverse dinámica. Una vez al cargar le pregunta
// al servidor si es verdad (`GET /api/emulacion`), para no quedarse pintado si la sesión ya no existe.
// Lo que da el acceso de verdad es la otra cookie, la httpOnly: ver `auth-guards.ts`.

function leerNombre(): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_EMULACION_AVISO}=([^;]*)`));
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]) || null;
  } catch {
    return null;
  }
}

const sinSuscripcion = () => () => {};

export function IndicadorEmulacion() {
  const nombreCookie = useSyncExternalStore(sinSuscripcion, leerNombre, () => null);
  const [verificado, setVerificado] = useState<{ emulando: boolean; nombre?: string } | null>(null);
  const [saliendo, setSaliendo] = useState(false);

  useEffect(() => {
    if (!nombreCookie) return;
    let vivo = true;
    fetch('/api/emulacion', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { emulando: boolean; nombre?: string }) => vivo && setVerificado(d))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [nombreCookie]);

  if (!nombreCookie || verificado?.emulando === false) return null;
  const nombre = verificado?.nombre ?? nombreCookie;

  async function salir() {
    setSaliendo(true);
    try {
      await fetch('/api/emulacion', { method: 'DELETE' });
    } finally {
      // Recarga completa: que el servidor vuelva a pintarlo todo como la persona real.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- recarga completa a propósito
      window.location.assign('/gestion/usuarios');
    }
  }

  return (
    <div className="print:hidden" role="status" aria-live="polite">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 z-50 h-0.5 bg-amber-400/80 dark:bg-amber-500/70"
        style={{ top: 'env(safe-area-inset-top)' }}
      />
      <div
        className="fixed left-1/2 z-50 -translate-x-1/2"
        style={{ top: 'calc(env(safe-area-inset-top) + 2px)' }}
      >
        <div className="inline-flex h-6 max-w-[88vw] items-center gap-1.5 rounded-b-xl border border-t-0 border-amber-300 bg-amber-100 pr-1 pl-2.5 text-[11px] leading-none text-amber-900 shadow-sm dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <span aria-hidden className="relative flex size-1.5 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-500 opacity-75 motion-reduce:animate-none" />
            <span className="relative inline-flex size-1.5 rounded-full bg-amber-600 dark:bg-amber-400" />
          </span>
          <span className="truncate">
            Emulando a <strong className="font-semibold">{nombre}</strong>
          </span>
          <button
            type="button"
            onClick={() => void salir()}
            disabled={saliendo}
            title="Salir del modo emulado y volver a tu usuario"
            className="relative inline-flex h-[18px] shrink-0 items-center gap-1 rounded-full px-2 font-semibold text-amber-900 outline-none before:absolute before:-inset-x-1 before:-inset-y-3 before:content-[''] hover:bg-amber-200 focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-60 dark:text-amber-100 dark:hover:bg-amber-900"
          >
            <LogOut aria-hidden className="size-3" />
            Salir
          </button>
        </div>
      </div>
    </div>
  );
}
