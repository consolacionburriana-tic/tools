import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { updateTrip } from '@/lib/salidas-server';

const patchSchema = z.object({
  nombre: z.string().min(3).optional(),
  descripcion: z.string().nullable().optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  importe: z.string().nullable().optional(),
  clases: z.array(z.object({ curso: z.string(), letra: z.string().nullable() })).optional(),
  estado: z.enum(['abierta', 'cerrada']).optional(),
  responsables: z.array(z.string().uuid()).optional(),
  tipoPago: z.enum(['transferencia', 'mano']).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireModule('salidas');
  if (isGuardResponse(guard)) return guard;
  try {
    const { id } = await params;
    const { responsables, ...cambios } = patchSchema.parse(await request.json());
    await updateTrip(id, cambios, responsables);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
