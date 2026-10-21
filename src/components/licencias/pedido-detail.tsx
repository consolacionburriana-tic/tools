'use client';

import { useEffect, useState } from 'react';
import { Archive, ArchiveRestore, Check, PiggyBank, Save, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { cursoLabel, euros } from '@/lib/licencias';
import { Button } from '@/components/ui/button';
import { Campo } from '@/components/ui/campo';
import { ConfirmarEnLinea, useConfirmar } from '@/components/ui/confirmar';
import { Estado } from '@/components/ui/estado';
import { Input } from '@/components/ui/input';
import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';
import { Tarjeta, TarjetaCabecera, TarjetaCuerpo } from '@/components/ui/tarjeta';
import { Vacio } from '@/components/ui/vacio';

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
  const { confirmar, pedirTexto, dialogo } = useConfirmar();

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
      const motivo = await pedirTexto({
        titulo: '¿Archivar el pedido?',
        descripcion: 'Se guarda como backup y deja de contar en las estadísticas.',
        etiqueta: 'Motivo (opcional)',
        placeholder: 'Duplicado, error de la familia…',
        boton: 'Archivar el pedido',
        vacioVale: true,
      });
      if (motivo === null) return; // canceló
      reason = motivo;
    } else if (
      !(await confirmar({
        titulo: '¿Desarchivar el pedido?',
        descripcion: 'Volverá a contar en las estadísticas.',
        boton: 'Desarchivar',
        peligro: false,
      }))
    ) {
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
      <div className="space-y-4" aria-busy="true">
        <SkeletonCard className="space-y-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </SkeletonCard>
        <SkeletonCard className="space-y-3">
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </SkeletonCard>
      </div>
    );
  }
  if (notFound || !order || !student) {
    return <Vacio titulo="Pedido no encontrado">Puede que se haya borrado. Vuelve a la lista de pedidos.</Vacio>;
  }

  const total = [...selected].reduce((sum, cod) => {
    const b = catalog.find((c) => c.cod === cod) ?? items.find((i) => i.bookCod === cod);
    return sum + parseFloat((b as CatalogBook | Item)?.precio ?? '0');
  }, 0);

  return (
    <div className="space-y-4">
      <Tarjeta>
        <TarjetaCabecera
          titulo={`${student.nombre} ${student.apellidos}`}
          descripcion={
            <>
              {student.studentCode} · {cursoLabel(order.curso ?? student.curso)} ·{' '}
              {order.bancoLibros ? 'Banco de Libros' : 'Sin Banco de Libros'}
              {order.confirmedAt && <span className="block">Pedido el {fmt(order.confirmedAt)}</span>}
            </>
          }
          accion={
            order.archived && (
              <Estado tono="neutro" icono={<Archive />}>
                Archivado{order.archivedReason ? `: ${order.archivedReason}` : ''}
              </Estado>
            )
          }
        />
        <TarjetaCuerpo className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Estado tono={order.editorialProcessedAt ? 'ok' : 'neutro'}>
              {order.editorialProcessedAt ? `Pedido a la editorial · ${fmt(order.editorialProcessedAt)}` : 'Sin pedir a la editorial'}
            </Estado>
            <Estado tono={order.sentToTemplateAt ? 'ok' : 'neutro'}>
              {order.sentToTemplateAt ? `En plantilla de envío · ${fmt(order.sentToTemplateAt)}` : 'Sin pasar a plantilla'}
            </Estado>
            <Estado tono={order.paidAt ? 'ok' : 'neutro'}>{order.paidAt ? `Pagado · ${fmt(order.paidAt)}` : 'Sin pagar'}</Estado>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={togglePagado} disabled={busy}>
              <PiggyBank aria-hidden /> {order.paidAt ? 'Desmarcar pagado' : 'Marcar pagado'}
            </Button>
            <Button variant="outline" size="sm" onClick={toggleArchivado} disabled={busy}>
              {order.archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
              {order.archived ? 'Desarchivar' : 'Archivar'}
            </Button>
            <ConfirmarEnLinea
              etiqueta="Borrar definitivamente"
              icono={<Trash2 aria-hidden />}
              pregunta="Se borra sin backup. Si dudas, archívalo."
              confirmar="Sí, borrar"
              disabled={busy}
              onConfirmar={eliminar}
            />
          </div>
        </TarjetaCuerpo>
      </Tarjeta>

      <Tarjeta>
        <TarjetaCuerpo className="space-y-4">
          <Campo etiqueta="Correo de contacto" id="pedido-email">
            <Input
              id="pedido-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setSaved(false);
              }}
            />
          </Campo>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">Licencias</legend>
            <div className="space-y-2">
              {catalog.map((b) => {
                const on = selected.has(b.cod);
                const orig = items.find((i) => i.bookCod === b.cod);
                return (
                  <label
                    key={b.cod}
                    className={cn(
                      'flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
                      on
                        ? 'border-blue-300 bg-blue-50 dark:border-blue-500/40 dark:bg-blue-500/10'
                        : 'border-zinc-200 dark:border-zinc-700',
                    )}
                  >
                    <input type="checkbox" checked={on} onChange={() => toggle(b.cod)} className="size-4 accent-blue-600" />
                    <span className="min-w-0 flex-1 text-zinc-800 dark:text-zinc-200">
                      {b.asignatura} <span className="text-zinc-500 dark:text-zinc-400">· {b.editorial}</span>
                      {orig?.activationCode && (
                        <span className="ml-1.5 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                          · código {orig.activationCode}
                        </span>
                      )}
                    </span>
                    <span className="text-zinc-600 tabular-nums dark:text-zinc-400">{euros(parseFloat(b.precio || '0'))}</span>
                  </label>
                );
              })}
              {catalog.length === 0 && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Sin catálogo disponible para este curso.</p>
              )}
            </div>
          </fieldset>

          <div className="flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <span className="text-sm text-zinc-500 tabular-nums dark:text-zinc-400">{selected.size} licencia(s)</span>
            <span className="font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">{euros(total)}</span>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={save} cargando={saving}>
              {!saving && <Save aria-hidden />} Guardar cambios
            </Button>
            {saved && (
              <Estado tono="ok" icono={<Check />}>
                Guardado
              </Estado>
            )}
          </div>
        </TarjetaCuerpo>
      </Tarjeta>
      {dialogo}
    </div>
  );
}
