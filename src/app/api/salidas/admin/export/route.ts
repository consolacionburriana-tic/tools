import { NextResponse } from 'next/server';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { getTripSeguimiento } from '@/lib/salidas-server';
import { csvSeguimiento, nombreFicheroSalida } from '@/lib/salidas-exports';

export const dynamic = 'force-dynamic';

// CSV del seguimiento de una salida: una fila por alumno de las clases de la salida,
// con su estado, justificante y correo de contacto.
export async function GET(request: Request) {
  const guard = await requireModule('salidas');
  if (isGuardResponse(guard)) return guard;

  const tripId = new URL(request.url).searchParams.get('trip');
  if (!tripId) return NextResponse.json({ error: 'Falta la salida' }, { status: 400 });

  const detalle = await getTripSeguimiento(tripId);
  if (!detalle) return NextResponse.json({ error: 'Salida no encontrada' }, { status: 404 });

  return new NextResponse(csvSeguimiento(detalle.alumnos, detalle.trip.tipoPago), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nombreFicheroSalida(detalle.trip.nombre)}"`,
    },
  });
}
