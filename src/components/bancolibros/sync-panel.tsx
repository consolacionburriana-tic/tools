'use client';

import { BookOpen } from 'lucide-react';
import { SyncCard, usePreviewApply } from '@/components/sync/plan-view';

export function BancoSyncPanel() {
  const librosSync = usePreviewApply('/api/bancolibros/admin/sync/libros');

  return (
    <SyncCard
      icon={<BookOpen className="h-4 w-4 text-purple-600" />}
      title="Excel BBDD Libros → Catálogo del banco"
      description={
        <>
          Lee el mismo Excel <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">BBDD Libros</code> que usa
          Licencias y da de alta/actualiza los libros marcados <strong>Banco de Libros = Sí</strong> en el catálogo de
          este módulo, curso a curso.
        </>
      }
      bullets={[
        'Empareja por curso + código: actualiza si ya existe, da de alta si es nuevo.',
        'Solo toca los libros que vinieron de este Excel (con código); los que hayas añadido a mano en cada curso no se tocan.',
        'Los libros que ya enseña automáticamente el catálogo de Licencias se ignoran aquí (si no, saldrían duplicados).',
        'Los que ya no estén en el Excel se desactivan (no se borran) para no perder valoraciones ya hechas.',
        'Hoy el Excel no tiene todos los cursos todavía: los que falten se siguen añadiendo a mano mientras tanto.',
      ]}
      applyLabel="Confirmar y aplicar"
      resultSummary={(r) => (
        <>
          <p>{r.upserted ?? 0} libro(s) leídos/actualizados desde el Excel.</p>
          {(r.deactivated ?? 0) > 0 && <p>{r.deactivated} libro(s) desactivados (ya no estaban en el Excel o ya los cubre Licencias).</p>}
          {(r.outOfScope ?? 0) > 0 && <p>{r.outOfScope} fila(s) ignoradas (ya las enseña el catálogo de Licencias).</p>}
        </>
      )}
      sync={librosSync}
    />
  );
}
