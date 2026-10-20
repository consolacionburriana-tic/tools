'use client';

// «Registro»: lo que se ha hecho desde aquí, quién y cuándo. Nunca lleva contraseñas.
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Search, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EntradaRegistro } from '@/lib/cuentas-server';
import { CAMPO, fechaHora, pedir, TARJETA } from './comun';

const ACCION_LABEL: Record<string, string> = {
  crear: 'Creada',
  mover: 'Movida',
  suspender: 'Suspendida',
  reactivar: 'Reactivada',
  contrasena: 'Contraseña nueva',
  vincular: 'Vinculada a Educamos',
  marcar: 'Marcada',
  desmarcar: 'Marca quitada',
  ajustes: 'Ajustes guardados',
  'crear-uo': 'Unidad creada',
  'grupo-crear': 'Grupo creado',
  'grupo-reglas': 'Reglas del grupo',
  'grupo-anadir': 'Entra en el grupo',
  'grupo-quitar': 'Sale del grupo',
};

export function Registro() {
  const [entradas, setEntradas] = useState<EntradaRegistro[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    pedir<{ registro: EntradaRegistro[] }>('/api/cuentas/registro')
      .then((r) => setEntradas(r.registro))
      .catch((e) => setError(e instanceof Error ? e.message : 'No se ha podido leer'));
  }, []);

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (entradas ?? []).filter(
      (e) => !t || `${e.objetivo} ${e.detalle ?? ''} ${e.por ?? ''} ${ACCION_LABEL[e.accion] ?? e.accion}`.toLowerCase().includes(t),
    );
  }, [entradas, q]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!entradas) {
    return (
      <p className="flex items-center gap-2 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Correo, grupo o persona" className={cn(CAMPO, 'pl-9')} />
      </div>
      <section className={cn(TARJETA, 'overflow-hidden')}>
        {visibles.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-zinc-500">
            {entradas.length === 0 ? 'Todavía no se ha hecho nada desde aquí.' : 'Nada con esa búsqueda.'}
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {visibles.map((e) => (
              <li key={e.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                {e.ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-zinc-900 dark:text-zinc-100">
                    <b className="font-medium">{ACCION_LABEL[e.accion] ?? e.accion}</b>{' '}
                    <span className="font-mono text-xs">{e.objetivo}</span>
                  </p>
                  {e.detalle && <p className="truncate text-xs text-zinc-500">{e.detalle}</p>}
                  {e.error && <p className="text-xs text-red-600">{e.error}</p>}
                </div>
                <p className="shrink-0 text-right text-xs text-zinc-500">
                  {fechaHora(e.at)}
                  <span className="block">{e.por}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
