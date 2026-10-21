'use client';

// Eliminar una evaluación (un formulario o la evaluación conjunta entera). A diferencia de
// borrar una pregunta, esto va al servidor al momento y no tiene "Deshacer": por eso pide
// confirmación en un diálogo y, si hay respuestas, que se escriba ELIMINAR: perder lo
// respondido tiene que costar un gesto más que un clic.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { Button } from '@/components/ui/button';
import { ConfirmarDialogo } from '@/components/ui/confirmar';

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
  const texto = etiqueta ?? 'Eliminar';

  async function eliminar() {
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
      throw e;
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={compacto ? 'ghost' : 'destructive'}
        size={compacto ? 'icon-sm' : 'sm'}
        aria-label={compacto ? texto : undefined}
        className={compacto ? 'text-zinc-500 hover:bg-red-50 hover:text-red-700 dark:text-zinc-400 dark:hover:bg-red-500/10 dark:hover:text-red-300' : undefined}
        onClick={() => {
          haptic.tap();
          setAbierto(true);
        }}
      >
        <Trash2 aria-hidden />
        {!compacto && texto}
      </Button>
      <ConfirmarDialogo
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        onConfirmar={eliminar}
        titulo={`¿Eliminar ${nombre}?`}
        descripcion={
          respuestas > 0 ? (
            <>
              Se borran también sus <strong>{respuestas} respuestas</strong>, para siempre. Si solo quieres que no se
              responda más, ciérrala.
            </>
          ) : (
            'Todavía no tiene respuestas.'
          )
        }
        boton={respuestas > 0 ? `Eliminar con ${respuestas} respuestas` : 'Eliminar'}
        palabra={respuestas > 0 ? PALABRA : undefined}
      />
    </>
  );
}
