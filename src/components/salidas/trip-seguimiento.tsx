'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, CircleSlash, ExternalLink, Info, Link2, Loader2, RotateCcw, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { Estado } from '@/components/ui/estado';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Input } from '@/components/ui/input';
import { Tarjeta } from '@/components/ui/tarjeta';
import { type Cubo, cuboDe } from '@/lib/salidas-exports';

export interface AlumnoRow {
  eduStudentId: string | null; // null = entrada manual
  nombre: string;
  clase: string;
  signupId: string | null;
  estado: 'pendiente' | 'apuntado' | 'no_va';
  justificanteEstado: string | null;
  justificanteSubidoAt: string | null;
  emailContacto: string | null;
  manual: boolean;
  manualIdentificador: string | null;
}

// Seguimiento del detalle de salida: filtros por estado (pendiente/entregado/no va). No hay
// validación manual del justificante — está enviado o no lo está.
// El "no va" lo marca el PROFESORADO desde aquí (las familias no pueden).
export function TripSeguimiento({ alumnos: inicial, tripId, tipoPago = 'transferencia' }: { alumnos: AlumnoRow[]; tripId: string; tipoPago?: string }) {
  const router = useRouter();
  const [alumnos, setAlumnos] = useState(inicial);
  const [filtro, setFiltro] = useState<Cubo>('entregados');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [enlazando, setEnlazando] = useState<string | null>(null); // signupId manual abierto
  const [busquedaEnlace, setBusquedaEnlace] = useState('');

  async function enlazar(signupId: string, eduStudentId: string) {
    setOcupado(signupId);
    try {
      const res = await fetch('/api/salidas/admin/enlazar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signupId, eduStudentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Entrada enlazada con el alumno');
      haptic.success();
      setEnlazando(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo enlazar');
      haptic.warning();
    } finally {
      setOcupado(null);
    }
  }

  async function marcarPagado(a: AlumnoRow, pagado: boolean) {
    if (!a.eduStudentId) return;
    setOcupado(a.eduStudentId);
    try {
      const res = await fetch('/api/salidas/admin/pagado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId, eduStudentId: a.eduStudentId, pagado }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAlumnos((prev) =>
        prev.map((x) =>
          x.eduStudentId === a.eduStudentId
            ? { ...x, estado: 'apuntado', justificanteEstado: pagado ? 'subido' : null, signupId: data.signupId ?? x.signupId }
            : x,
        ),
      );
      haptic.tap();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
      haptic.warning();
    } finally {
      setOcupado(null);
    }
  }

  async function marcarNoVa(a: AlumnoRow) {
    if (!a.eduStudentId) return;
    setOcupado(a.eduStudentId);
    try {
      const res = await fetch('/api/salidas/admin/no-va', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId, eduStudentId: a.eduStudentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAlumnos((prev) =>
        prev.map((x) => (x.eduStudentId === a.eduStudentId ? { ...x, estado: 'no_va', signupId: data.signupId ?? x.signupId } : x)),
      );
      haptic.tap();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
      haptic.warning();
    } finally {
      setOcupado(null);
    }
  }

  const cuentas = useMemo(() => {
    const c: Record<Cubo, number> = { pendientes: 0, entregados: 0, no_van: 0 };
    alumnos.forEach((a) => c[cuboDe(a)]++);
    return c;
  }, [alumnos]);

  const visibles = alumnos.filter((a) => cuboDe(a) === filtro);

  async function patch(a: AlumnoRow, cambios: { estado?: string }, optimista: Partial<AlumnoRow>) {
    if (!a.signupId) return;
    setOcupado(a.signupId);
    const previo = alumnos;
    setAlumnos((prev) => prev.map((x) => (x.signupId === a.signupId ? { ...x, ...optimista } : x)));
    try {
      const res = await fetch(`/api/salidas/admin/signups/${a.signupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cambios),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      haptic.tap();
    } catch (e) {
      setAlumnos(previo);
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
      haptic.warning();
    } finally {
      setOcupado(null);
    }
  }

  const enMano = tipoPago === 'mano';
  const chips: { key: Cubo; label: string; tono?: 'ok' | 'aviso' }[] = [
    { key: 'pendientes', label: 'Pendientes', tono: 'aviso' },
    { key: 'entregados', label: enMano ? 'Pagados' : 'Entregados', tono: 'ok' },
    { key: 'no_van', label: 'No van' },
  ];

  return (
    <Tarjeta>
      <div className="border-b border-zinc-100 p-3 dark:border-zinc-800">
        <Filtros etiqueta="Mostrar">
          {chips.map((c) => (
            <Filtro key={c.key} activo={filtro === c.key} onClick={() => setFiltro(c.key)} cuenta={cuentas[c.key]} tono={c.tono}>
              {c.label}
            </Filtro>
          ))}
        </Filtros>
      </div>

      {visibles.length === 0 ? (
        <p className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">Nadie en este estado.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {visibles.map((a) => {
            const girando = ocupado !== null && (ocupado === a.signupId || ocupado === a.eduStudentId);
            return (
              <li
                key={a.signupId ?? a.eduStudentId}
                className={cn(
                  'flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3',
                  a.manual && 'bg-amber-50/60 dark:bg-amber-500/5',
                )}
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {a.nombre}
                    <Etiqueta>{a.clase}</Etiqueta>
                    {a.manual && (
                      <Estado tono="aviso" icono={<TriangleAlert aria-hidden />}>
                        Entrada manual: enlaza al alumno
                      </Estado>
                    )}
                  </p>
                  {a.manual && a.manualIdentificador && (
                    <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">Tecleó: {a.manualIdentificador}</p>
                  )}
                  {a.manual && enlazando === a.signupId && (
                    <div className="mt-2 w-80 max-w-full space-y-1.5 rounded-xl border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900">
                      <Input
                        autoFocus
                        aria-label="Busca al alumno real"
                        value={busquedaEnlace}
                        onChange={(e) => setBusquedaEnlace(e.target.value)}
                        placeholder="Busca al alumno real…"
                      />
                      <ul className="max-h-48 overflow-y-auto">
                        {alumnos
                          .filter((x) => !x.manual && x.eduStudentId)
                          .filter((x) => x.nombre.toLowerCase().includes(busquedaEnlace.toLowerCase()))
                          .slice(0, 8)
                          .map((x) => (
                            <li key={x.eduStudentId}>
                              <button
                                type="button"
                                onClick={() => void enlazar(a.signupId!, x.eduStudentId!)}
                                className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-2.5 text-left text-sm text-zinc-800 outline-none hover:bg-zinc-100 focus-visible:ring-3 focus-visible:ring-ring/50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                              >
                                <span>{x.nombre}</span>
                                <span className="text-xs text-zinc-500 dark:text-zinc-400">{x.clase}</span>
                              </button>
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                  {a.justificanteSubidoAt && (
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      Subido el{' '}
                      {new Date(a.justificanteSubidoAt).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {a.emailContacto ? ` · ${a.emailContacto}` : ''}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {girando && <Loader2 aria-label="Guardando" className="h-4 w-4 animate-spin text-zinc-400" />}
                  {a.manual && a.signupId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-expanded={enlazando === a.signupId}
                      onClick={() => {
                        setBusquedaEnlace(a.nombre.split(' ')[0] ?? '');
                        setEnlazando(enlazando === a.signupId ? null : a.signupId);
                      }}
                    >
                      <Link2 aria-hidden /> Enlazar
                    </Button>
                  )}
                  {a.signupId && a.justificanteEstado && (
                    <a
                      href={`/api/salidas/admin/justificante/${a.signupId}`}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                    >
                      <ExternalLink aria-hidden /> Ver justificante
                    </a>
                  )}
                  {filtro === 'pendientes' && a.eduStudentId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void marcarPagado(a, true)}
                      disabled={ocupado === a.eduStudentId}
                    >
                      <Check aria-hidden /> {enMano ? 'Pagado' : 'Entregado'}
                    </Button>
                  )}
                  {filtro === 'pendientes' && a.eduStudentId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void marcarNoVa(a)}
                      disabled={ocupado === a.eduStudentId}
                    >
                      <CircleSlash aria-hidden /> No va
                    </Button>
                  )}
                  {filtro === 'entregados' && a.eduStudentId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void marcarPagado(a, false)}
                      disabled={ocupado === a.eduStudentId}
                    >
                      <RotateCcw aria-hidden /> {enMano ? 'No pagado' : 'No entregado'}
                    </Button>
                  )}
                  {filtro === 'no_van' && a.signupId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void patch(a, { estado: 'apuntado' }, { estado: 'apuntado' })}
                    >
                      <RotateCcw aria-hidden /> Sí que va
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="flex gap-2 border-t border-zinc-100 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
        <span>
          «No va» se marca aquí (lo decide el profesorado).{' '}
          {enMano
            ? 'Pago en mano: las familias no suben nada; marca «Pagado» al recoger el dinero.'
            : 'El justificante se sube desde casa, pero si lo han entregado de otra forma (correo, secretaría…) márcalo con «Entregado».'}
        </span>
      </p>
    </Tarjeta>
  );
}
