import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { createTrip } from '@/lib/salidas-server';

const tripSchema = z.object({
  nombre: z.string().min(3),
  descripcion: z.string().nullable().default(null),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  importe: z.string().nullable().default(null),
  clases: z.array(z.object({ curso: z.string(), letra: z.string().nullable() })).min(1),
  responsables: z.array(z.string().uuid()).default([]),
  tipoPago: z.enum(['transferencia', 'mano']).default('transferencia'),
});

export async function POST(request: Request) {
  const guard = await requireModule('salidas');
  if (isGuardResponse(guard)) return guard;
  try {
    const input = tripSchema.parse(await request.json());
    const trip = await createTrip({ ...input, user: guard });
    return NextResponse.json({ ok: true, trip }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
