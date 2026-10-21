'use client';

// Pestaña «Historial»: las últimas tiradas, con su estado y el enlace a Drive. Sirve para
// dos cosas de verdad: volver a la carpeta de un curso sin buscarla, y retomar (o
// reintentar) una tirada que se quedó a medias.

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ExternalLink, History, Play, Square } from 'lucide-react';
import { toast } from 'sonner';
import { EstadoTirada, TiradaEnMarcha } from '@/components/cuaderno/generar-panel';
import type { PlantillaUI, TiradaUI } from '@/components/cuaderno/tipos';
import { Button, buttonVariants } from '@/components/ui/button';
import { Estado } from '@/components/ui/estado';
import { Tarjeta } from '@/components/ui/tarjeta';
import { Vacio } from '@/components/ui/vacio';

export function HistorialPanel({ tiradas, plantillas }: { tiradas: TiradaUI[]; plantillas: PlantillaUI[] }) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  if (abierta) {
    return <TiradaEnMarcha tiradaId={abierta} plantillas={plantillas} onCerrar={() => setAbierta(null)} />;
  }

  if (tiradas.length === 0) {
    return (
      <Vacio icono={<History />} titulo="Todavía no se ha generado ningún cuaderno">
        Cuando lances el primero desde «Generar», saldrá aquí con su enlace a Drive.
      </Vacio>
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
          <Tarjeta key={tirada.id} className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {tirada.academicYear} · Ejecución {tirada.numero}
                  </h3>
                  <EstadoTirada estado={tirada.estado} />
                  {tirada.errores > 0 && tirada.estado !== 'error' && (
                    <Estado tono="aviso">{tirada.errores} con error</Estado>
                  )}
                  {enMarcha && tirada.pases === 0 && <Estado tono="aviso">El worker no ha pasado</Estado>}
                </div>
                <p className="mt-1 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
                  {format(parseISO(tirada.createdAt), "d 'de' MMMM 'a las' HH:mm", { locale: es })}
                  {tirada.lanzadaPor ? ` · ${tirada.lanzadaPor}` : ''} · {tirada.hechos}/{tirada.total} documentos
                  {tirada.errores > 0 ? ` · ${tirada.errores} con error` : ''}
                  {tirada.pases > 0 ? ` · ${tirada.pases} pase(s) del worker` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {tirada.carpetaCursoUrl && (
                  <a
                    href={tirada.carpetaCursoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonVariants({ variant: 'outline', size: 'sm' })}
                  >
                    Drive <ExternalLink aria-hidden />
                  </a>
                )}
                {tirada.pendientes > 0 && (
                  <Button variant="outline" size="sm" onClick={() => accion(tirada.id, 'seguir')} disabled={ocupado === tirada.id}>
                    <Play /> Retomar
                  </Button>
                )}
                {enMarcha && (
                  <Button variant="destructive" size="sm" onClick={() => accion(tirada.id, 'cancelar')} disabled={ocupado === tirada.id}>
                    <Square /> Parar
                  </Button>
                )}
                <Button size="sm" onClick={() => setAbierta(tirada.id)}>
                  Ver detalle
                </Button>
              </div>
            </div>
            {tirada.error && <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{tirada.error}</p>}
          </Tarjeta>
        );
      })}
    </div>
  );
}
