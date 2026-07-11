import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getTripsAbiertasDeClase } from '@/lib/salidas-server';

// Salidas abiertas de una clase (flujo manual, sin alumno enlazado ni estado propio).
export async function POST(request: Request) {
  try {
    const { curso, letra } = z
      .object({ curso: z.string().min(1), letra: z.string().nullable() })
      .parse(await request.json());
    const trips = await getTripsAbiertasDeClase({ curso, letra });
    return NextResponse.json({
      trips: trips.map((t) => ({
        tripId: t.id,
        nombre: t.nombre,
        descripcion: t.descripcion,
        fecha: t.fecha,
        importe: t.importe,
        estado: 'pendiente' as const,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
