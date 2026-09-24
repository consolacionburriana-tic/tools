'use client';

// Eliminar una evaluación (un formulario o la evaluación conjunta entera). A diferencia de
// borrar una pregunta, esto va al servidor al momento y no tiene "Deshacer": por eso pide
// confirmación en el sitio (nada de window.confirm) y, si hay respuestas, que se escriba
// ELIMINAR — perder lo respondido tiene que costar un gesto más que un clic.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { BTN_SUAVE } from '@/components/evaluaciones/ui';

const PALABRA = 'ELIMINAR';

export function EliminarEvaluacion({
  formId,
  grupo = false,
  nombre,
  respuestas,
  etiqueta,
  compacto = false,
  volverA = '/gestion/evaluaciones',
}: {
  formId: string;
  /** Borrar todos los sectores de la evaluación conjunta, no solo este formulario. */
  grupo?: boolean;
  /** Lo que se borra, para el texto de confirmación: "«Convivencia · Alumnado»". */
  nombre: string;
  respuestas: number;
  etiqueta?: string;
  /** Solo el icono (listado). */
  compacto?: boolean;
  /** A dónde ir después de borrar; null = quedarse y refrescar. */
  volverA?: string | null;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [borrando, setBorrando] = useState(false);
  const exigePalabra = respuestas > 0;
  const listo = !exigePalabra || texto.trim().toUpperCase() === PALABRA;

  async function eliminar() {
    setBorrando(true);
    try {
      const qs = new URLSearchParams();
      if (grupo) qs.set('grupo', '1');
      if (respuestas > 0) qs.set('forzar', '1');
      const res = await fetch(`/api/evaluaciones/admin/forms/${formId}?${qs}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'No se pudo eliminar');
      haptic.success();
      toast.success(data.borrados > 1 ? `Eliminados ${data.borrados} formularios` : 'Evaluación eliminada');
      if (volverA) router.push(volverA);
      router.refresh();
    } catch (e) {
      haptic.warning();
      toast.error(e instanceof Error ? e.message : 'Error inesperado');
      setBorrando(false);
    }
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => {
          haptic.tap();
          setAbierto(true);
        }}
        title={etiqueta ?? 'Eliminar'}
        aria-label={etiqueta ?? 'Eliminar'}
        className={`${BTN_SUAVE} hover:!bg-rose-50 hover:!text-rose-700 dark:hover:!bg-rose-500/10 dark:hover:!text-rose-300`}
      >
        <Trash2 className="h-3.5 w-3.5" />
        {!compacto && (etiqueta ?? 'Eliminar')}
      </button>
    );
  }

  return (
    <div className="anim-up w-full basis-full rounded-xl bg-rose-50 p-3 text-xs text-rose-900 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-500/20">
      <p className="font-semibold">
        ¿Eliminar {nombre}?{' '}
        {respuestas > 0 ? (
          <span className="font-normal">
            Se borran también sus <strong>{respuestas} respuestas</strong>, para siempre. Si solo quieres que no se
            responda más, ciérrala.
          </span>
        ) : (
          <span className="font-normal">Todavía no tiene respuestas.</span>
        )}
      </p>
      {exigePalabra && (
        <input
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={`Escribe ${PALABRA} para confirmar`}
          className="mt-2 w-full rounded-lg bg-white px-3 py-2 text-sm text-zinc-900 ring-1 ring-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-500 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-rose-500/30"
        />
      )}
      <div className="mt-2 flex justify-end gap-1.5">
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            setTexto('');
          }}
          className="rounded-lg px-3 py-1.5 font-medium text-rose-800 hover:bg-rose-100 dark:text-rose-200 dark:hover:bg-rose-500/15"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!listo || borrando}
          onClick={() => void eliminar()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 font-semibold text-white hover:bg-rose-700 disabled:opacity-40"
        >
          {borrando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          Eliminar
        </button>
      </div>
    </div>
  );
}
