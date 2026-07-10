'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Abrir/cerrar la salida (cerrada = las familias ya no pueden subir justificantes).
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
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={ocupado}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
        estado === 'abierta'
          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300'
          : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300'
      }`}
    >
      {ocupado && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {estado === 'abierta' ? 'Abierta · cerrar' : 'Cerrada · reabrir'}
    </button>
  );
}
