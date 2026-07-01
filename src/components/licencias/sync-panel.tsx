'use client';

import { useState } from 'react';
import { BookOpen, Check, Clock, Loader2, RefreshCw, TriangleAlert } from 'lucide-react';

interface TabResult {
  tab: string;
  updated: number;
  appended: number;
}
interface SyncResponse {
  ok?: boolean;
  si?: TabResult;
  no?: TabResult;
  error?: string;
}
interface BooksSyncResponse {
  ok?: boolean;
  upserted?: number;
  deactivated?: number;
  error?: string;
}

function useSync<T>(url: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<T | null>(null);
  const [ranAt, setRanAt] = useState<Date | null>(null);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(url, { method: 'POST' });
      const data = await res.json();
      setResult(res.ok ? data : ({ error: data.error ?? 'Error desconocido' } as T));
      setRanAt(new Date());
    } catch {
      setResult({ error: 'Error de conexión' } as T);
    } finally {
      setLoading(false);
    }
  }

  return { loading, result, ranAt, run };
}

export function SyncPanel() {
  const ordersSync = useSync<SyncResponse>('/api/licencias/admin/sync/sheets');
  const booksSync = useSync<BooksSyncResponse>('/api/licencias/admin/sync/books');

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
          <li>
            Busca cada alumno por su <strong>código</strong> (columna P): si ya tiene fila, la actualiza; si no, añade una fila nueva al final.
          </li>
          <li>
            Actualiza <strong>datos del pedido</strong>: apellidos, nombre, año de nacimiento, curso, correo, licencias (códigos), letra e idioma (columnas A-F, P, T-Y, AB-AD).
          </li>
          <li>
            <strong>Nunca toca</strong> las columnas de estado 🧾 (pedido a editorial), 📤 (enviado a plantilla), 💰 (pagado), ni sus fechas (Q, R, S, Z, AA) — esas las gestionas de forma independiente en el sistema que estés usando en cada momento, sin riesgo de que uno pise el trabajo del otro.
          </li>
        </ul>

        <button
          type="button"
          onClick={ordersSync.run}
          disabled={ordersSync.loading}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 cursor-pointer"
        >
          {ordersSync.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
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
            <p>
              <strong>SI BdL - FORM26</strong>: {ordersSync.result.si?.updated ?? 0} fila(s) actualizada(s), {ordersSync.result.si?.appended ?? 0} nueva(s) añadida(s).
            </p>
            <p>
              <strong>NO BdL - FORM26</strong>: {ordersSync.result.no?.updated ?? 0} fila(s) actualizada(s), {ordersSync.result.no?.appended ?? 0} nueva(s) añadida(s).
            </p>
            {ordersSync.ranAt && (
              <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <Clock className="h-3 w-3" /> {ordersSync.ranAt.toLocaleString('es-ES')}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="flex items-center gap-1.5 font-medium text-zinc-900 dark:text-zinc-100">
          <BookOpen className="h-4 w-4 text-purple-600" /> Google Sheets → Libros (catálogo)
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          Lee la pestaña <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">BBDD Libros</code> de tu Google
          Sheet e importa/actualiza el catálogo de esta campaña (cod, editorial, curso, lengua, asignatura, nombre,
          ISBN, banco de libros, precio, texto del formulario).
        </p>
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-zinc-500">
          <li>
            Empareja por <strong>curso + código</strong>: si el libro ya existe lo actualiza (precio, editorial…); si es nuevo, lo da de alta.
          </li>
          <li>
            Si un libro deja de estar en el Sheet, se <strong>desactiva</strong> (no se borra) — así los pedidos ya hechos que lo referencian no se rompen.
          </li>
        </ul>

        <button
          type="button"
          onClick={booksSync.run}
          disabled={booksSync.loading}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-40 cursor-pointer"
        >
          {booksSync.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Importar catálogo ahora
        </button>

        {booksSync.result?.error && (
          <p className="mt-3 flex items-start gap-1.5 text-sm text-red-600 dark:text-red-400">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {booksSync.result.error}
          </p>
        )}

        {booksSync.result?.ok && (
          <div className="mt-3 space-y-1 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
            <p className="flex items-center gap-1.5 font-medium"><Check className="h-4 w-4" /> Catálogo actualizado</p>
            <p>{booksSync.result.upserted ?? 0} libro(s) leídos/actualizados desde el Sheet.</p>
            {(booksSync.result.deactivated ?? 0) > 0 && (
              <p>{booksSync.result.deactivated} libro(s) ya no estaban en el Sheet y se han desactivado.</p>
            )}
            {booksSync.ranAt && (
              <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <Clock className="h-3 w-3" /> {booksSync.ranAt.toLocaleString('es-ES')}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-4 opacity-60 dark:border-zinc-700 dark:bg-zinc-900">
        <p className="font-medium text-zinc-700 dark:text-zinc-300">Alumnos: Google Sheets → App</p>
        <p className="mt-1 text-sm text-zinc-500">
          Próximamente: importar la BBDD de alumnos desde el Sheet hacia esta aplicación.
        </p>
      </div>
    </div>
  );
}
