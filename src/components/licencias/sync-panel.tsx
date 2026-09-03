'use client';

import { BookOpen, Check, Clock, Loader2, RefreshCw, TriangleAlert, Users } from 'lucide-react';
import { SyncCard, usePreviewApply } from '@/components/sync/plan-view';

interface TabResult {
  updated: number;
  appended: number;
}
interface OrdersSyncResult {
  ok?: boolean;
  si?: TabResult;
  no?: TabResult;
  error?: string;
}

export function SyncPanel() {
  const ordersSync = usePreviewApply<OrdersSyncResult>('/api/licencias/admin/sync/sheets'); // solo se usa .apply
  const booksSync = usePreviewApply('/api/licencias/admin/sync/books');
  const studentsSync = usePreviewApply('/api/licencias/admin/sync/students');

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="font-medium text-zinc-900 dark:text-zinc-100">Pedidos → Google Sheets</p>
        <p className="mt-1 text-sm text-zinc-500">
          Envía todos los pedidos <strong>activos</strong> (no archivados) de la campaña actual a las pestañas{' '}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">SI BdL - FORM26</code> /{' '}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">NO BdL - FORM26</code> de tu Google Sheet, según
          el alumno tenga o no Banco de Libros.
        </p>
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-zinc-500">
          <li>Busca cada alumno por su <strong>código</strong> (columna P): si ya tiene fila, la actualiza; si no, añade una fila nueva al final.</li>
          <li>
            <strong>Nunca toca</strong> las columnas de estado 🧾/📤/💰 (Q, R, S) ni sus fechas (Z, AA) — así el sistema nuevo y el antiguo pueden usarse en paralelo sin pisarse.
          </li>
        </ul>
        <button
          type="button"
          onClick={ordersSync.apply}
          disabled={ordersSync.applying}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 cursor-pointer"
        >
          {ordersSync.applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Sincronizar ahora
        </button>
        {ordersSync.result?.error && (
          <p className="mt-3 flex items-start gap-1.5 text-sm text-red-600 dark:text-red-400">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {ordersSync.result.error}
          </p>
        )}
        {ordersSync.result?.ok && (
          <div className="mt-3 space-y-1 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
            <p className="flex items-center gap-1.5 font-medium"><Check className="h-4 w-4" /> Sincronización completada</p>
            <p><strong>SI BdL - FORM26</strong>: {ordersSync.result.si?.updated ?? 0} actualizada(s), {ordersSync.result.si?.appended ?? 0} nueva(s).</p>
            <p><strong>NO BdL - FORM26</strong>: {ordersSync.result.no?.updated ?? 0} actualizada(s), {ordersSync.result.no?.appended ?? 0} nueva(s).</p>
            {ordersSync.ranAt && (
              <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <Clock className="h-3 w-3" /> {ordersSync.ranAt.toLocaleString('es-ES')}
              </p>
            )}
          </div>
        )}
      </div>

      <SyncCard
        icon={<BookOpen className="h-4 w-4 text-purple-600" />}
        title="Google Sheets → Libros (catálogo)"
        description={
          <>
            Lee la pestaña <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">BBDD Libros</code> y actualiza el catálogo de esta campaña.
          </>
        }
        bullets={[
          'Empareja por curso + código: actualiza si existe, da de alta si es nuevo.',
          'Los libros que ya no están en el Sheet se desactivan (no se borran) para no romper pedidos ya hechos.',
        ]}
        applyLabel="Confirmar y aplicar"
        resultSummary={(r) => (
          <>
            <p>{r.upserted ?? 0} libro(s) leídos/actualizados desde el Sheet.</p>
            {(r.deactivated ?? 0) > 0 && <p>{r.deactivated} libro(s) desactivados (ya no estaban en el Sheet).</p>}
          </>
        )}
        sync={booksSync}
      />

      <SyncCard
        icon={<Users className="h-4 w-4 text-blue-600" />}
        title="BBDD central → Alumnos"
        description={
          <>
            Lee la BBDD central de alumnado (Educamos) y actualiza el snapshot de esta campaña (solo los cursos del formulario: 6ºEP a 4ºESO/PDC).
          </>
        }
        bullets={[
          'Empareja por código de alumno: actualiza datos (curso, letra, nombre, banco de libros...) o da de alta si es nuevo.',
          'Quien ya no esté en la BBDD central se desactiva (nunca se borra): los pedidos ya hechos siguen intactos y visibles.',
          'Si un alumno con pedido ya confirmado cambia de curso o Banco de Libros, se avisa antes de aplicar.',
        ]}
        applyLabel="Confirmar y aplicar"
        resultSummary={(r) => (
          <>
            <p>{r.upserted ?? 0} alumno(s) leídos/actualizados desde la BBDD central.</p>
            {(r.deactivated ?? 0) > 0 && <p>{r.deactivated} alumno(s) desactivados (ya no estaban en el Sheet).</p>}
            {(r.outOfScope ?? 0) > 0 && <p>{r.outOfScope} fila(s) ignoradas (curso fuera de esta campaña).</p>}
          </>
        )}
        sync={studentsSync}
      />
    </div>
  );
}
