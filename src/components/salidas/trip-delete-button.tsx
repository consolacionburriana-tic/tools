'use client';

import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { ConfirmarEnLinea } from '@/components/ui/confirmar';

// Borrar una salida entera: se lleva por delante inscripciones y justificantes y no se
// rehace, así que el botón pregunta en el sitio antes de llamar al servidor.
export function TripDeleteButton({ tripId, nombre }: { tripId: string; nombre: string }) {
  const router = useRouter();

  async function borrar() {
    try {
      const res = await fetch(`/api/salidas/admin/trips/${tripId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'No se pudo borrar la salida');
      haptic.success();
      toast.success(`«${nombre}» borrada`);
      router.push('/gestion/salidas');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo borrar la salida');
      haptic.warning();
    }
  }

  return (
    <ConfirmarEnLinea
      etiqueta="Borrar"
      icono={<Trash2 aria-hidden />}
      pregunta="¿Borrarla con sus inscripciones y justificantes?"
      confirmar="Sí, borrar la salida"
      onConfirmar={borrar}
    />
  );
}
