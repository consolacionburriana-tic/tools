'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Archive, ArchiveRestore, ChevronDown, ChevronUp, PiggyBank, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { CURSOS_FORM, cursoLabel, euros, normalize } from '@/lib/licencias';
import { ordenCurso } from '@/lib/cursos';
import { Button } from '@/components/ui/button';
import { useConfirmar } from '@/components/ui/confirmar';
import { Copiable } from '@/components/ui/copiable';
import { Estado } from '@/components/ui/estado';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Input } from '@/components/ui/input';
import { SkeletonTabla } from '@/components/ui/skeleton';
import { Tarjeta } from '@/components/ui/tarjeta';

interface OrderRow {
  id: string;
  studentId: string;
  nombre: string;
  apellidos: string;
  curso: string;
  letra: string | null;
  bancoLibros: boolean;
  email: string | null;
  nia: string | null;
  total: string;
  itemCount: number;
  confirmedAt: string | null;
  editorialProcessedAt: string | null;
  sentToTemplateAt: string | null;
  paidAt: string | null;
  archived: boolean;
  archivedReason: string | null;
}

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';
}

type Campo = 'alumno' | 'curso' | 'letra' | 'fecha' | 'total';
type Orden = { campo: Campo; asc: boolean };

/** Comparador por columna. El orden de cursos es el escolar (infantil → ESO), no el alfabético. */
function comparar(a: OrderRow, b: OrderRow, campo: Campo): number {
  switch (campo) {
    case 'alumno':
      return `${a.apellidos} ${a.nombre}`.localeCompare(`${b.apellidos} ${b.nombre}`, 'es', { sensitivity: 'base' });
    case 'curso':
      return ordenCurso(a.curso) - ordenCurso(b.curso) || (a.letra ?? '').localeCompare(b.letra ?? '', 'es');
    case 'letra':
      return (a.letra ?? '').localeCompare(b.letra ?? '', 'es') || ordenCurso(a.curso) - ordenCurso(b.curso);
    case 'fecha':
      return (a.confirmedAt ? Date.parse(a.confirmedAt) : 0) - (b.confirmedAt ? Date.parse(b.confirmedAt) : 0);
    case 'total':
      return parseFloat(a.total) - parseFloat(b.total);
  }
}

export function PedidosList() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [curso, setCurso] = useState('todos');
  const [q, setQ] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Por defecto, lo último pedido arriba (es como venía ordenado del servidor).
  const [orden, setOrden] = useState<Orden>({ campo: 'fecha', asc: false });
  const { confirmar, dialogo } = useConfirmar();

  /** Un clic ordena por esa columna; otro clic le da la vuelta. */
  function ordenarPor(campo: Campo) {
    setOrden((prev) => ({ campo, asc: prev.campo === campo ? !prev.asc : campo !== 'fecha' }));
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/licencias/admin/orders${includeArchived ? '?archived=1' : ''}`);
      const data = await res.json();
      setOrders(data.orders ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recarga al cambiar el filtro de archivados
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeArchived]);

  const filtered = useMemo(() => {
    const nq = normalize(q);
    const lista = orders.filter((o) => {
      if (curso !== 'todos' && o.curso !== curso) return false;
      if (nq && !normalize(`${o.apellidos} ${o.nombre}`).includes(nq)) return false;
      return true;
    });
    return lista.sort((a, b) => (orden.asc ? 1 : -1) * comparar(a, b, orden.campo));
  }, [orders, curso, q, orden]);

  async function togglePagado(o: OrderRow) {
    setBusyId(o.id);
    try {
      await fetch(`/api/licencias/admin/orders/${o.id}/paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paid: !o.paidAt }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function archivar(o: OrderRow, archived: boolean) {
    const r = await fetch(`/api/licencias/admin/orders/${o.id}/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived }),
    });
    if (!r.ok) throw new Error('No se ha podido cambiar el archivo del pedido');
  }

  // Archivar se deshace desarchivando, así que no pregunta: lo hace y ofrece «Deshacer».
  async function toggleArchivado(o: OrderRow) {
    const archived = !o.archived;
    setBusyId(o.id);
    try {
      await archivar(o, archived);
      await load();
      haptic.success();
      toast.success(archived ? `Pedido de ${o.nombre} archivado` : `Pedido de ${o.nombre} desarchivado`, {
        description: archived ? 'Se guarda como backup y deja de contar en las estadísticas.' : undefined,
        action: {
          label: 'Deshacer',
          onClick: () => void archivar(o, !archived).then(load).catch((e: Error) => toast.error(e.message)),
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se ha podido archivar');
    } finally {
      setBusyId(null);
    }
  }

  async function eliminar(o: OrderRow) {
    const si = await confirmar({
      titulo: `¿Borrar el pedido de ${o.nombre} ${o.apellidos}?`,
      descripcion: 'Se borra definitivamente y no queda backup. Si dudas, archívalo en su lugar.',
      boton: 'Borrar el pedido',
    });
    if (!si) return;
    setBusyId(o.id);
    try {
      await fetch(`/api/licencias/admin/orders/${o.id}`, { method: 'DELETE' });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:max-w-xs">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar apellidos…"
            aria-label="Buscar por apellidos"
            className="pl-9"
          />
        </div>
        <Filtro activo={includeArchived} onClick={() => setIncludeArchived((v) => !v)} icono={<Archive />}>
          Con archivados
        </Filtro>
      </div>
      <Filtros etiqueta="Curso">
        <Filtro activo={curso === 'todos'} onClick={() => setCurso('todos')}>
          Todos
        </Filtro>
        {CURSOS_FORM.map((c) => (
          <Filtro key={c.value} activo={curso === c.value} onClick={() => setCurso(c.value)}>
            {c.label}
          </Filtro>
        ))}
      </Filtros>

      {loading ? (
        <SkeletonTabla n={8} columnas={6} />
      ) : (
        <Tarjeta className="overflow-x-auto">
          <table className="w-full min-w-[60rem] text-sm">
            <thead className="border-b border-zinc-100 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <tr>
                {(
                  [
                    { campo: 'alumno', label: 'Alumno', align: 'text-left' },
                    { campo: 'curso', label: 'Curso', align: 'text-left' },
                    { campo: 'letra', label: 'Clase', align: 'text-left' },
                    { campo: 'fecha', label: 'Fecha', align: 'text-left' },
                    { campo: 'total', label: 'Total', align: 'text-right' },
                  ] as const
                ).map((c) => (
                  <th
                    key={c.campo}
                    className={cn('px-2 py-1 font-medium', c.align)}
                    aria-sort={orden.campo === c.campo ? (orden.asc ? 'ascending' : 'descending') : undefined}
                  >
                    <button
                      type="button"
                      onClick={() => ordenarPor(c.campo)}
                      className={cn(
                        'inline-flex h-10 cursor-pointer items-center gap-1 rounded-lg px-1 outline-none hover:text-zinc-900 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:text-zinc-100',
                        orden.campo === c.campo && 'text-zinc-900 dark:text-zinc-100',
                      )}
                    >
                      {c.label}
                      {orden.campo === c.campo &&
                        (orden.asc ? <ChevronUp aria-hidden className="size-4" /> : <ChevronDown aria-hidden className="size-4" />)}
                    </button>
                  </th>
                ))}
                <th className="px-3 py-2 text-left font-medium">NIA</th>
                <th className="px-3 py-2 text-left font-medium">Editorial</th>
                <th className="px-3 py-2 text-left font-medium">Envío</th>
                <th className="px-3 py-2 text-left font-medium">Cobro</th>
                <th className="px-3 py-2 text-right font-medium">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filtered.map((o) => (
                <tr key={o.id} className={o.archived ? 'bg-zinc-50/60 text-zinc-500 dark:bg-zinc-800/20 dark:text-zinc-400' : undefined}>
                  <td className="px-3 py-2">
                    <Link
                      href={`/gestion/licencias/pedidos/${o.id}`}
                      className="rounded font-medium text-zinc-900 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 dark:text-zinc-100"
                    >
                      {o.nombre} {o.apellidos}
                    </Link>
                    {o.archived && (
                      <Estado tono="neutro" className="ml-2">
                        Archivado
                      </Estado>
                    )}
                  </td>
                  <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{cursoLabel(o.curso)}</td>
                  <td className="px-3 py-2">
                    {o.letra ? <Etiqueta>{o.letra}</Etiqueta> : <span className="text-zinc-400">—</span>}
                  </td>
                  <td className="px-3 py-2 text-zinc-600 tabular-nums dark:text-zinc-400">{fmt(o.confirmedAt)}</td>
                  <td className="px-3 py-2 text-right font-medium text-zinc-900 tabular-nums dark:text-zinc-100">
                    {euros(parseFloat(o.total))}
                  </td>
                  <td className="px-3 py-2">
                    {o.nia ? <Copiable valor={o.nia} mono etiqueta="NIA" /> : <span className="text-zinc-400">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    <Estado tono={o.editorialProcessedAt ? 'ok' : 'neutro'}>{o.editorialProcessedAt ? 'Pedido' : 'Sin pedir'}</Estado>
                  </td>
                  <td className="px-3 py-2">
                    <Estado tono={o.sentToTemplateAt ? 'ok' : 'neutro'}>{o.sentToTemplateAt ? 'En plantillas' : 'Pendiente'}</Estado>
                  </td>
                  <td className="px-3 py-2">
                    <Estado tono={o.paidAt ? 'ok' : 'neutro'}>{o.paidAt ? 'Pagado' : 'Sin pagar'}</Estado>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={o.paidAt ? `Desmarcar pagado: ${o.nombre}` : `Marcar pagado: ${o.nombre}`}
                        title={o.paidAt ? 'Desmarcar pagado' : 'Marcar pagado'}
                        aria-pressed={!!o.paidAt}
                        onClick={() => togglePagado(o)}
                        disabled={busyId === o.id}
                        className={o.paidAt ? 'text-emerald-700 dark:text-emerald-300' : undefined}
                      >
                        <PiggyBank />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={o.archived ? `Desarchivar: ${o.nombre}` : `Archivar: ${o.nombre}`}
                        title={o.archived ? 'Desarchivar' : 'Archivar'}
                        onClick={() => toggleArchivado(o)}
                        disabled={busyId === o.id}
                      >
                        {o.archived ? <ArchiveRestore /> : <Archive />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Borrar el pedido de ${o.nombre}`}
                        title="Borrar definitivamente"
                        onClick={() => eliminar(o)}
                        disabled={busyId === o.id}
                        className="text-zinc-500 hover:bg-red-50 hover:text-red-700 dark:text-zinc-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-zinc-500 dark:text-zinc-400">
                    Sin pedidos que coincidan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Tarjeta>
      )}
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Toca el nombre para ver o editar el pedido, y cualquier cabecera (Alumno, Curso, Clase, Fecha, Total) para ordenar
        por ella. Con la hucha marcas el cobro; con la caja, archivas.
      </p>
      {dialogo}
    </div>
  );
}
