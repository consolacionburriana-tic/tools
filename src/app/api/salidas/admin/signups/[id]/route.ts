import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { salSignups } from '@/db/schema';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';

const patchSchema = z.object({
  justificanteEstado: z.enum(['subido', 'validado', 'rechazado']).optional(),
  estado: z.enum(['apuntado', 'no_va']).optional(),
});

// Validar/rechazar justificante o marcar no_va desde el panel.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireModule('salidas');
  if (isGuardResponse(guard)) return guard;
  try {
    const { id } = await params;
    const cambios = patchSchema.parse(await request.json());
    if (Object.keys(cambios).length === 0) return NextResponse.json({ error: 'Nada que cambiar' }, { status: 400 });
    await db.update(salSignups).set({ ...cambios, updatedAt: new Date() }).where(eq(salSignups.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
