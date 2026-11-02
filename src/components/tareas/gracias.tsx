'use client';

// El «gracias» que sale al apuntar un fallito o una sugerencia desde el botón de abajo a la
// derecha: sustituye al formulario unos segundos, con una explosión de confeti y un corazón que
// late, y se quita solo. Quien lo ve no entra en ningún tablero: solo recogemos lo que cuenta.
import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExplosionCentral } from '@/components/ui/estallido';

const MENSAJES = {
  fallo: ['Ya lo tenemos. Lo miraremos con lupa.', 'Anotado. Los bichos, a la cárcel.', 'Recibido. Gracias por no callártelo.'],
  modulo: ['Tu idea ya está en la mesa de TIC.', 'Las mejores ideas del cole nacen en el claustro.', 'Recibido. Esto se va a leer con mucho cariño.'],
} as const;

export function Gracias({ tipo, onFin }: { tipo: 'fallo' | 'modulo'; onFin: () => void }) {
  const quieto = useReducedMotion();
  // Uno al azar cada vez que sale, y el mismo mientras se ve.
  const [mensaje] = useState(() => MENSAJES[tipo][Math.floor(Math.random() * MENSAJES[tipo].length)]);

  useEffect(() => {
    const t = window.setTimeout(onFin, 3600);
    return () => window.clearTimeout(t);
  }, [onFin]);

  return (
    <div role="status" className="relative flex min-h-64 flex-col items-center justify-center gap-3 overflow-hidden px-2 py-6 text-center">
      <ExplosionCentral />
      <div className="relative flex size-20 items-center justify-center">
        {!quieto &&
          [0, 1].map((i) => (
            <motion.span
              key={i}
              initial={{ scale: 0.4, opacity: 0.55 }}
              animate={{ scale: 2.4, opacity: 0 }}
              transition={{ duration: 1.5, delay: 0.15 + i * 0.35, repeat: 1, ease: 'easeOut' }}
              className="absolute size-20 rounded-full border-2 border-pink-400"
            />
          ))}
        <motion.span
          initial={quieto ? false : { scale: 0, rotate: -25 }}
          animate={quieto ? undefined : { scale: [0, 1.25, 1, 1.12, 1], rotate: 0 }}
          transition={{ duration: 1.1, ease: 'easeOut', times: [0, 0.35, 0.55, 0.8, 1] }}
          className="flex size-16 items-center justify-center rounded-full bg-pink-50 text-pink-600 dark:bg-pink-500/15 dark:text-pink-300"
        >
          <Heart aria-hidden className="size-8 fill-current" />
        </motion.span>
      </div>
      <motion.p
        initial={quieto ? false : { opacity: 0, y: 10, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.35, type: 'spring', stiffness: 260, damping: 14 }}
        className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50"
      >
        ¡Mil gracias!
      </motion.p>
      <motion.p
        initial={quieto ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="max-w-64 text-sm text-zinc-600 dark:text-zinc-300"
      >
        {mensaje}
      </motion.p>
      <Button type="button" variant="ghost" size="sm" onClick={onFin} className="relative mt-1">
        Apuntar otra cosa
      </Button>
    </div>
  );
}
