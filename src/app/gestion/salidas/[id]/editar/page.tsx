export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { getClasesDisponibles, claseLabel, getTripSeguimiento } from '@/lib/salidas-server';
import { getTeachers } from '@/lib/educamos-server';
import { TripForm } from '@/components/salidas/trip-form';

export const metadata = { title: 'Editar salida · Gestión' };

export default async function EditarSalidaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [detalle, clases, profes] = await Promise.all([getTripSeguimiento(id), getClasesDisponibles(), getTeachers()]);
  if (!detalle) notFound();
  return (
    <TripForm
      clases={clases.map((c) => ({ ...c, label: claseLabel(c) }))}
      profes={profes.map((p) => ({ id: p.id, nombre: [p.nombre, p.apellido1].filter(Boolean).join(' ') }))}
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
  );
}
