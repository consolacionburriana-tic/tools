'use client';

// Registra el service worker y avisa cuando el iPad se queda sin cobertura.
//
// Lo segundo es lo que de verdad se nota en el día a día: en el patio y en algunas aulas
// el wifi baila, y sin aviso el profe le da a guardar, no pasa nada, y no sabe por qué.
// Con la cinta de "sin conexión" sabe que espere; al volver la red, desaparece sola.
import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export function RegistroSW() {
  const [sinRed, setSinRed] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Tras la carga, para no competir con el primer render.
      const registrar = () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {
          /* sin SW la app funciona igual: solo se pierde la página de cortesía */
        });
      };
      if (document.readyState === 'complete') registrar();
      else window.addEventListener('load', registrar, { once: true });
    }

    const actualizar = () => setSinRed(!navigator.onLine);
    actualizar();
    window.addEventListener('online', actualizar);
    window.addEventListener('offline', actualizar);
    return () => {
      window.removeEventListener('online', actualizar);
      window.removeEventListener('offline', actualizar);
    };
  }, []);

  if (!sinRed) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-amber-500 px-4 py-1.5 text-center text-xs font-medium text-amber-950 shadow-sm"
      style={{ paddingTop: 'max(0.375rem, env(safe-area-inset-top))' }}
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      Sin conexión — espera a que vuelva el wifi antes de guardar.
    </div>
  );
}
