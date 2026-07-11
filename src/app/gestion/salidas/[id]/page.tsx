export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarDays, LinkIcon, Pencil, Users } from 'lucide-react';
import { claseLabel, getTripSeguimiento } from '@/lib/salidas-server';
import { TripSeguimiento } from '@/components/salidas/trip-seguimiento';
import { TripEstadoToggle } from '@/components/salidas/trip-estado-toggle';

export const metadata = { title: 'Salida · Gestión' };

export default async function SalidaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detalle = await getTripSeguimiento(id);
  if (!detalle) notFound();
  const { trip, responsables, alumnos } = detalle;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{trip.nombre}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
              {trip.fecha && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-4 w-4" />
                  {new Date(trip.fecha + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
              )}
              {trip.importe && <span>{trip.importe} €</span>}
              <span className="inline-flex items-center gap-1">
                <Users className="h-4 w-4" />
                {(trip.clases ?? []).map((c) => claseLabel(c)).join(', ')}
              </span>
            </p>
            {trip.descripcion && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{trip.descripcion}</p>}
            {responsables.length > 0 && (
              <p className="mt-2 text-xs text-zinc-400">
                Responsables (reciben los avisos):{' '}
                {responsables.map((r) => [r.nombre, r.apellido1].filter(Boolean).join(' ')).join(', ')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <TripEstadoToggle tripId={trip.id} estado={trip.estado as 'abierta' | 'cerrada'} />
            <Link
              href={`/gestion/salidas/${trip.id}/editar`}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Pencil className="h-4 w-4" /> Editar
            </Link>
          </div>
        </div>
        <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-800/60">
          <LinkIcon className="h-3.5 w-3.5" />
          Enlace para las familias: <code className="rounded bg-white px-1.5 py-0.5 dark:bg-zinc-900">tools.consolacionburriana.com/salidas</code>
          — se identifican con su DNI (o el NIA) y suben el justificante.
        </p>
      </div>

      <TripSeguimiento
        tripId={trip.id}
        alumnos={alumnos.map((a) => ({ ...a, justificanteSubidoAt: a.justificanteSubidoAt?.toISOString() ?? null }))}
      />
    </div>
  );
}
