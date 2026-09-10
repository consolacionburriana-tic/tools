'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';

// Borrar una salida entera: se lleva por delante inscripciones y justificantes, así que
// confirma en dos pasos (sin diálogo del navegador) antes de llamar al servidor.
export function TripDeleteButton({ tripId, nombre }: { tripId: string; nombre: string }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [borrando, setBorrando] = useState(false);

  async function borrar() {
    setBorrando(true);
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
      setBorrando(false);
      setConfirmando(false);
    }
  }

  if (confirmando) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void borrar()}
          disabled={borrando}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
        >
          {borrando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Borrar definitivamente
        </button>
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          disabled={borrando}
          className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirmando(true)}
      title="Borrar esta salida (inscripciones y justificantes incluidos)"
      className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-500 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-zinc-700 dark:hover:border-red-900 dark:hover:bg-red-950/30 dark:hover:text-red-400"
    >
      <Trash2 className="h-4 w-4" /> Borrar
    </button>
  );
}
