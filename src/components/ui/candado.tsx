'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Lock, LockOpen } from 'lucide-react';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// El candado: una pantalla que se puede editar entra BLOQUEADA, y hay que darle al candado para
// poder tocar nada (David, 3-nov-2026: tras un cambio sin querer en la protección de datos).
// No sustituye al permiso —quien no puede editar ni ve el candado—, solo evita el toque suelto.
//
//   const candado = useCandado();
//   const editable = puedeEditar && candado.abierto;
//   …  <Candado {...candado} />      // en la barra de la pantalla
//   …  en cada guardado: candado.tocar();
//
// Se vuelve a cerrar solo tras unos minutos sin guardar nada, y al salir de la pantalla (el estado
// vive en el componente, así que al desmontarlo se pierde).

export function useCandado(minutosDeGracia = 5) {
  const [abierto, setAbierto] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parar = () => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = null;
  };
  const armar = useCallback(() => {
    parar();
    temporizador.current = setTimeout(() => setAbierto(false), minutosDeGracia * 60_000);
  }, [minutosDeGracia]);

  const abrir = useCallback(() => {
    setAbierto(true);
    armar();
  }, [armar]);
  const cerrar = useCallback(() => {
    parar();
    setAbierto(false);
  }, []);
  /** Cada guardado alarga el plazo: mientras se está trabajando no se cierra en la cara. */
  const tocar = useCallback(() => {
    if (temporizador.current) armar();
  }, [armar]);

  useEffect(() => parar, []);
  return { abierto, abrir, cerrar, tocar };
}

export function Candado({
  abierto,
  abrir,
  cerrar,
  que = 'editar',
  className,
}: {
  abierto: boolean;
  abrir: () => void;
  cerrar: () => void;
  /** Lo que se desbloquea, en infinitivo: «editar la protección de datos». */
  que?: string;
  className?: string;
}) {
  return abierto ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn('border-blue-300 text-blue-700 dark:border-blue-500/40 dark:text-blue-300', className)}
      title="Vuelve a bloquear para que no se toque nada sin querer"
      onClick={() => {
        haptic.tap();
        cerrar();
      }}
    >
      <LockOpen aria-hidden /> Editando · bloquear
    </Button>
  ) : (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      title={`Desbloquea para ${que}`}
      onClick={() => {
        haptic.tap();
        abrir();
      }}
    >
      <Lock aria-hidden /> Bloqueado · desbloquear
    </Button>
  );
}
