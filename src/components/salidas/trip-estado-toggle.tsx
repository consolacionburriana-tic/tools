'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, LockOpen } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

// Abrir/cerrar la salida (cerrada = las familias ya no pueden subir justificantes). Se
// deshace con el mismo botón, así que no pregunta.
export function TripEstadoToggle({ tripId, estado }: { tripId: string; estado: 'abierta' | 'cerrada' }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);

  async function toggle() {
    setOcupado(true);
    try {
      const res = await fetch(`/api/salidas/admin/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: estado === 'abierta' ? 'cerrada' : 'abierta' }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cambiar el estado');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" cargando={ocupado} onClick={() => void toggle()}>
      {!ocupado && (estado === 'abierta' ? <Lock aria-hidden /> : <LockOpen aria-hidden />)}
      {estado === 'abierta' ? 'Cerrar la salida' : 'Reabrir la salida'}
    </Button>
  );
}
