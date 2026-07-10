'use client';

import { useEffect, useState } from 'react';
import { Archive, ArchiveRestore, Check, Loader2, PiggyBank, Save, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cursoLabel, euros } from '@/lib/licencias';

interface Order {
  id: string;
  curso: string | null;
  email: string | null;
  bancoLibros: boolean;
  totalPrice: string;
  confirmedAt: string | null;
  editorialProcessedAt: string | null;
  sentToTemplateAt: string | null;
  paidAt: string | null;
  archived: boolean;
  archivedReason: string | null;
}
interface Student {
  studentCode: string;
  nombre: string;
  apellidos: string;
  curso: string;
}
interface Item {
  bookCod: string;
  asignatura: string | null;
  editorial: string;
  nombreLibro: string;
  precio: string | null;
  activationCode: string | null;
}
interface CatalogBook {
  cod: string;
  asignatura: string;
  editorial: string;
  precio: string;
}

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleString('es-ES') : null;
}

export function PedidoDetail({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [catalog, setCatalog] = useState<CatalogBook[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await fetch(`/api/licencias/admin/orders/${orderId}`);
      if (!res.ok) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setOrder(data.order);
      setStudent(data.student);
      setItems(data.items ?? []);
      setSelected(new Set<string>((data.items ?? []).map((i: Item) => i.bookCod)));
      setEmail(data.order.email ?? '');

      const curso = data.order.curso ?? data.student.curso;
      const catRes = await fetch(`/api/licencias/catalog?studentId=${data.student.id}&curso=${encodeURIComponent(curso)}`);
      if (catRes.ok) {
        const cat = await catRes.json();
        setCatalog(cat.books ?? []);
      }
      setLoading(false);
    })();
  }, [orderId]);

  function toggle(cod: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cod)) next.delete(cod);
      else next.add(cod);
      return next;
    });
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/licencias/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cods: [...selected], email }),
      });
      if (res.ok) {
        const data = await res.json();
        setOrder(data.order);
        setItems(data.items ?? []);
        setSaved(true);
      }
    } finally {
      setSaving(false);
    }
  }

  async function togglePagado() {
    if (!order) return;
    setBusy(true);
    try {
      await fetch(`/api/licencias/admin/orders/${orderId}/paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paid: !order.paidAt }),
      });
      setOrder({ ...order, paidAt: order.paidAt ? null : new Date().toISOString() });
    } finally {
      setBusy(false);
    }
  }

  async function toggleArchivado() {
    if (!order) return;
    let reason: string | undefined;
    if (!order.archived) {
      reason = prompt('Motivo de archivar (opcional, ej. "duplicado", "error familia")') ?? undefined;
      if (reason === undefined) return; // canceló el prompt
    } else if (!confirm('¿Desarchivar este pedido? Volverá a contar en las estadísticas.')) {
      return;
    }
    setBusy(true);
    try {
      await fetch(`/api/licencias/admin/orders/${orderId}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: !order.archived, reason }),
      });
      setOrder({ ...order, archived: !order.archived, archivedReason: order.archived ? null : (reason ?? null) });
    } finally {
      setBusy(false);
    }
  }

  async function eliminar() {
    if (!confirm('Esto BORRA definitivamente el pedido (no queda backup). ¿Seguro? Si dudas, usa "Archivar" en su lugar.')) return;
    setBusy(true);
    try {
      await fetch(`/api/licencias/admin/orders/${orderId}`, { method: 'DELETE' });
      router.push('/gestion/licencias/pedidos');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
      </p>
    );
  }
  if (notFound || !order || !student) {
    return <p className="text-sm text-zinc-500">Pedido no encontrado.</p>;
  }

  const total = [...selected].reduce((sum, cod) => {
    const b = catalog.find((c) => c.cod === cod) ?? items.find((i) => i.bookCod === cod);
    return sum + parseFloat((b as CatalogBook | Item)?.precio ?? '0');
  }, 0);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">{student.nombre} {student.apellidos}</p>
            <p className="text-xs text-zinc-500">
              {student.studentCode} · {cursoLabel(order.curso ?? student.curso)} · {order.bancoLibros ? 'Banco de Libros' : 'Sin Banco de Libros'}
            </p>
            {order.confirmedAt && <p className="mt-1 text-xs text-zinc-400">Pedido el {fmt(order.confirmedAt)}</p>}
          </div>
          {order.archived && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
              Archivado{order.archivedReason ? `: ${order.archivedReason}` : ''}
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className={`rounded-full px-2.5 py-1 ${order.editorialProcessedAt ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'}`}>
            🧾 {order.editorialProcessedAt ? `Pedido editorial · ${fmt(order.editorialProcessedAt)}` : 'Sin pedir a editorial'}
          </span>
          <span className={`rounded-full px-2.5 py-1 ${order.sentToTemplateAt ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'}`}>
            📤 {order.sentToTemplateAt ? `Enviado a plantilla · ${fmt(order.sentToTemplateAt)}` : 'Sin pasar a plantilla'}
          </span>
          <span className={`rounded-full px-2.5 py-1 ${order.paidAt ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'}`}>
            💰 {order.paidAt ? `Pagado · ${fmt(order.paidAt)}` : 'Sin pagar'}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={togglePagado}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <PiggyBank className="h-4 w-4" /> {order.paidAt ? 'Desmarcar pagado' : 'Marcar pagado'}
          </button>
          <button
            type="button"
            onClick={toggleArchivado}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
          >
            {order.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            {order.archived ? 'Desarchivar' : 'Archivar'}
          </button>
          <button
            type="button"
            onClick={eliminar}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-500/30 dark:hover:bg-red-500/10 cursor-pointer"
          >
            <Trash2 className="h-4 w-4" /> Eliminar definitivamente
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Correo de contacto</label>
        <input
          value={email}
          onChange={(e) => { setEmail(e.target.value); setSaved(false); }}
          className="mb-4 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100"
        />

        <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Licencias</p>
        <div className="space-y-1.5">
          {catalog.map((b) => {
            const on = selected.has(b.cod);
            const orig = items.find((i) => i.bookCod === b.cod);
            return (
              <label
                key={b.cod}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${on ? 'border-blue-400 bg-blue-50 dark:bg-blue-500/10' : 'border-zinc-200 dark:border-zinc-700'}`}
              >
                <input type="checkbox" checked={on} onChange={() => toggle(b.cod)} className="accent-blue-600" />
                <span className="flex-1 text-zinc-700 dark:text-zinc-200">
                  {b.asignatura} <span className="text-xs text-zinc-400">· {b.editorial}</span>
                  {orig?.activationCode && <span className="ml-1.5 text-xs text-emerald-600">· cod: {orig.activationCode}</span>}
                </span>
                <span className="text-zinc-500">{euros(parseFloat(b.precio || '0'))}</span>
              </label>
            );
          })}
          {catalog.length === 0 && <p className="text-sm text-zinc-400">Sin catálogo disponible para este curso.</p>}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <span className="text-sm text-zinc-500">{selected.size} licencia(s)</span>
          <span className="font-bold text-zinc-900 dark:text-zinc-100">{euros(total)}</span>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 cursor-pointer"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar cambios
          </button>
          {saved && <span className="inline-flex items-center gap-1 text-sm text-emerald-600"><Check className="h-4 w-4" /> Guardado</span>}
        </div>
      </div>
    </div>
  );
}
