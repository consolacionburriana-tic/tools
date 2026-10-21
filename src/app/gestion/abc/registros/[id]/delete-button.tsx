'use client';

import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmarEnLinea } from '@/components/ui/confirmar';

// Borrar un registro no se rehace: el botón pregunta en el sitio.
export function DeleteReportButton({ id }: { id: string }) {
  const router = useRouter();

  const handleDelete = async () => {
    const res = await fetch(`/api/reports/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Registro eliminado');
      router.push('/gestion/abc/registros');
    } else {
      toast.error('Error al eliminar');
    }
  };

  return (
    <ConfirmarEnLinea
      etiqueta="Eliminar"
      icono={<Trash2 aria-hidden />}
      confirmar="Eliminar definitivamente"
      onConfirmar={handleDelete}
    />
  );
}
