export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { getClasesDisponibles, claseLabel, getTripSeguimiento } from '@/lib/salidas-server';
import { getTeachers } from '@/lib/educamos-server';
import { nombreProfeBreve } from '@/lib/profes';
import { TripForm } from '@/components/salidas/trip-form';

export const metadata = { title: 'Editar salida · Gestión' };

export default async function EditarSalidaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [detalle, clases, profes] = await Promise.all([getTripSeguimiento(id), getClasesDisponibles(), getTeachers()]);
  if (!detalle) notFound();
  return (
    <div className="space-y-4">
      <Link
        href={`/gestion/salidas/${id}`}
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400"
      >
        <ChevronLeft className="h-4 w-4" /> Volver a la salida
      </Link>
      <TripForm
        clases={clases.map((c) => ({ ...c, label: claseLabel(c) }))}
        profes={profes.map((p) => ({
          id: p.id,
          nombre: nombreProfeBreve(p),
          etapa: p.etapa,
          esTutor: p.esTutor,
          claseTutor: p.claseTutor,
        }))}
        inicial={{
          id: detalle.trip.id,
          nombre: detalle.trip.nombre,
          descripcion: detalle.trip.descripcion,
          fecha: detalle.trip.fecha,
          importe: detalle.trip.importe,
          clases: detalle.trip.clases ?? [],
          responsables: detalle.responsables.map((r) => r.id),
          tipoPago: (detalle.trip.tipoPago as 'transferencia' | 'mano') ?? 'transferencia',
        }}
      />
    </div>
  );
}
