'use client';

// «Registro»: lo que se ha hecho desde aquí, quién y cuándo. Nunca lleva contraseñas.
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, Search, XCircle } from 'lucide-react';
import type { EntradaRegistro } from '@/lib/cuentas-server';
import { Aviso } from '@/components/ui/aviso';
import { Input } from '@/components/ui/input';
import { SkeletonRows } from '@/components/ui/skeleton';
import { Tarjeta } from '@/components/ui/tarjeta';
import { Vacio } from '@/components/ui/vacio';
import { fechaHora, pedir } from './comun';

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

  if (error) return <Aviso tono="error">No se ha podido leer el registro: {error}</Aviso>;
  if (!entradas) {
    return (
      <div role="status" aria-label="Cargando el registro">
        <SkeletonRows n={4} />
      </div>
    );
  }
  if (entradas.length === 0) {
    return (
      <Vacio icono={<ClipboardList />} titulo="Todavía no se ha hecho nada desde aquí">
        Cada cuenta creada, movida o suspendida, y cada cambio de grupo, queda apuntado aquí con quién y cuándo.
      </Vacio>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative max-w-md">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Correo, grupo o persona" aria-label="Buscar en el registro" className="pl-9" />
      </div>
      <Tarjeta as="section" aria-label="Registro" className="overflow-hidden">
        {visibles.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">Nada con esa búsqueda.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {visibles.map((e) => (
              <li key={e.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                {e.ok ? (
                  <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <XCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-zinc-900 dark:text-zinc-100">
                    <span className="sr-only">{e.ok ? 'Hecho: ' : 'Falló: '}</span>
                    <b className="font-medium">{ACCION_LABEL[e.accion] ?? e.accion}</b>{' '}
                    <span className="font-mono text-xs break-all">{e.objetivo}</span>
                  </p>
                  {e.detalle && <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{e.detalle}</p>}
                  {e.error && <p className="text-xs text-red-700 dark:text-red-400">{e.error}</p>}
                </div>
                <p className="shrink-0 text-right text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
                  {fechaHora(e.at)}
                  <span className="block">{e.por}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </div>
  );
}
