'use client';

// Pestaña «Historial»: las últimas tiradas, con su estado y el enlace a Drive. Sirve para
// dos cosas de verdad: volver a la carpeta de un curso sin buscarla, y retomar (o
// reintentar) una tirada que se quedó a medias.

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, CheckCheck, ExternalLink, Loader2, Play, Square } from 'lucide-react';
import { toast } from 'sonner';
import { Tarjeta } from '@/components/cuaderno/cuaderno-panel';
import { TiradaEnMarcha } from '@/components/cuaderno/generar-panel';
import type { PlantillaUI, TiradaUI } from '@/components/cuaderno/tipos';

const ESTADO_LABEL: Record<string, string> = {
  pendiente: 'en cola',
  ejecutando: 'en marcha',
  hecha: 'terminada',
  error: 'con errores',
  cancelada: 'cancelada',
};

export function HistorialPanel({ tiradas, plantillas }: { tiradas: TiradaUI[]; plantillas: PlantillaUI[] }) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  if (abierta) {
    return <TiradaEnMarcha tiradaId={abierta} plantillas={plantillas} onCerrar={() => setAbierta(null)} />;
  }

  if (tiradas.length === 0) {
    return (
      <Tarjeta>
        <p className="text-sm text-zinc-500">Todavía no se ha generado ningún cuaderno.</p>
      </Tarjeta>
    );
  }

  async function accion(id: string, accion: 'seguir' | 'cancelar') {
    setOcupado(id);
    try {
      const res = await fetch(`/api/cuaderno/admin/tiradas/${id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ accion }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'No se pudo');
      toast.success(accion === 'seguir' ? 'Retomando' : 'Cancelada');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo');
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="space-y-2">
      {tiradas.map((tirada) => {
        const enMarcha = tirada.estado === 'pendiente' || tirada.estado === 'ejecutando';
        return (
          <Tarjeta key={tirada.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {tirada.errores > 0 ? (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  ) : enMarcha ? (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  ) : (
                    <CheckCheck className="h-4 w-4 text-emerald-500" />
                  )}
                  <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {tirada.academicYear} · Ejecución {tirada.numero}
                  </h3>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800">
                    {ESTADO_LABEL[tirada.estado] ?? tirada.estado}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {format(parseISO(tirada.createdAt), "d 'de' MMMM 'a las' HH:mm", { locale: es })}
                  {tirada.lanzadaPor ? ` · ${tirada.lanzadaPor}` : ''} · {tirada.hechos}/{tirada.total} documentos
                  {tirada.errores > 0 ? ` · ${tirada.errores} con error` : ''}
                </p>
              </div>
              <div className="flex gap-1.5">
                {tirada.carpetaCursoUrl && (
                  <a
                    href={tirada.carpetaCursoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Drive <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                {tirada.pendientes > 0 && (
                  <button
                    type="button"
                    onClick={() => accion(tirada.id, 'seguir')}
                    disabled={ocupado === tirada.id}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
                  >
                    <Play className="h-3.5 w-3.5" /> Retomar
                  </button>
                )}
                {enMarcha && (
                  <button
                    type="button"
                    onClick={() => accion(tirada.id, 'cancelar')}
                    disabled={ocupado === tirada.id}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-900 dark:text-red-400"
                  >
                    <Square className="h-3.5 w-3.5" /> Parar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setAbierta(tirada.id)}
                  className="rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                >
                  Ver detalle
                </button>
              </div>
            </div>
            {tirada.error && <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">{tirada.error}</p>}
          </Tarjeta>
        );
      })}
    </div>
  );
}
