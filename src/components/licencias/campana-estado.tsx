'use client';

import { useRef } from 'react';
import { ConfirmarEnLinea } from '@/components/ui/confirmar';

// Abrir o cerrar la campaña desde el panel. Es el mismo POST de formulario de siempre; solo
// pregunta antes, porque abrir o cerrar cambia lo que ven todas las familias al momento.
export function CampanaEstado({ abierta }: { abierta: boolean }) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action="/api/licencias/admin/campaign" method="post">
      <input type="hidden" name="status" value={abierta ? 'closed' : 'open'} />
      <ConfirmarEnLinea
        variante={abierta ? 'outline' : 'default'}
        peligro={false}
        etiqueta={abierta ? 'Cerrar la campaña' : 'Abrir la campaña'}
        pregunta={
          abierta
            ? '¿Cerrar? Las familias ya no podrán pedir ni cambiar su pedido.'
            : '¿Abrir? Las familias podrán pedir con su enlace desde ya.'
        }
        confirmar={abierta ? 'Sí, cerrar' : 'Sí, abrir'}
        onConfirmar={() => form.current?.requestSubmit()}
      />
    </form>
  );
}
