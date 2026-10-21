export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarDays, Download, LinkIcon, Pencil, Users } from 'lucide-react';
import { claseLabel, getTripSeguimiento } from '@/lib/salidas-server';
import { appBaseUrl } from '@/lib/constants';
import { buttonVariants } from '@/components/ui/button';
import { EnlaceVolver, TituloPagina } from '@/components/ui/cabecera-modulo';
import { Estado } from '@/components/ui/estado';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Tarjeta } from '@/components/ui/tarjeta';
import { TripSeguimiento } from '@/components/salidas/trip-seguimiento';
import { TripEstadoToggle } from '@/components/salidas/trip-estado-toggle';
import { RecordatorioPanel } from '@/components/salidas/recordatorio-panel';
import { TripDeleteButton } from '@/components/salidas/trip-delete-button';

export const metadata = { title: 'Salida · Gestión' };

export default async function SalidaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detalle = await getTripSeguimiento(id);
  if (!detalle) notFound();
  const { trip, responsables, alumnos } = detalle;
  const abierta = trip.estado === 'abierta';

  return (
    <div className="space-y-4">
      <div>
        <EnlaceVolver href="/gestion/salidas">Todas las salidas</EnlaceVolver>
        <TituloPagina
          className="mt-1 mb-0"
          acciones={
            <>
              <TripEstadoToggle tripId={trip.id} estado={trip.estado as 'abierta' | 'cerrada'} />
              <a
                href={`/api/salidas/admin/export?trip=${trip.id}`}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                <Download aria-hidden /> Descargar CSV
              </a>
              <Link href={`/gestion/salidas/${trip.id}/editar`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                <Pencil aria-hidden /> Editar
              </Link>
              <TripDeleteButton tripId={trip.id} nombre={trip.nombre} />
            </>
          }
        >
          {trip.nombre}
        </TituloPagina>
      </div>

      <Tarjeta className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-zinc-600 dark:text-zinc-400">
          <Estado tono={abierta ? 'ok' : 'neutro'}>{abierta ? 'Abierta' : 'Cerrada'}</Estado>
          {trip.fecha && (
            <span className="inline-flex items-center gap-1">
              <CalendarDays aria-hidden className="h-4 w-4" />
              {new Date(trip.fecha + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
          )}
          {trip.importe && <span className="tabular-nums">{trip.importe} €</span>}
          <Etiqueta>{trip.tipoPago === 'mano' ? 'Pago en mano' : 'Pago por banco'}</Etiqueta>
          <span className="inline-flex items-center gap-1">
            <Users aria-hidden className="h-4 w-4" />
            {(trip.clases ?? []).map((c) => claseLabel(c)).join(', ')}
          </span>
        </div>
        {trip.descripcion && <p className="text-sm text-zinc-700 dark:text-zinc-300">{trip.descripcion}</p>}
        {responsables.length > 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Responsables (reciben los avisos):{' '}
            {responsables.map((r) => [r.nombre, r.apellido1].filter(Boolean).join(' ')).join(', ')}
          </p>
        )}
        <p className="flex flex-wrap items-center gap-1.5 rounded-xl bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400">
          <LinkIcon aria-hidden className="h-4 w-4 shrink-0 text-zinc-400" />
          Enlace para las familias: <Etiqueta mono>{appBaseUrl().replace(/^https?:\/\//, '')}/salidas</Etiqueta>
          Se identifican con su DNI (o el NIA) y suben el justificante.
          {trip.tipoPago === 'mano' && ' Esta salida es de pago en mano: no les aparece a las familias.'}
        </p>
      </Tarjeta>

      <RecordatorioPanel
        tripId={trip.id}
        nombre={trip.nombre}
        fecha={trip.fecha}
        importe={trip.importe}
        tipoPago={trip.tipoPago}
      />

      <TripSeguimiento
        tripId={trip.id}
        tipoPago={trip.tipoPago}
        alumnos={alumnos.map((a) => ({ ...a, justificanteSubidoAt: a.justificanteSubidoAt?.toISOString() ?? null }))}
      />
    </div>
  );
}
