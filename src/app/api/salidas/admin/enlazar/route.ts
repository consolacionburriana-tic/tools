import { NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { salSignups } from '@/db/schema';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';

const bodySchema = z.object({ signupId: z.string().uuid(), eduStudentId: z.string().uuid() });

// Enlaza una entrada MANUAL con su alumno real. Si el alumno ya tenía inscripción en
// esa salida, el justificante manual se traslada a ella y la fila manual desaparece.
// Los campos manual_* se conservan como traza de lo que tecleó la familia.
export async function POST(request: Request) {
  const guard = await requireModule('salidas');
  if (isGuardResponse(guard)) return guard;
  try {
    const { signupId, eduStudentId } = bodySchema.parse(await request.json());
    const [manual] = await db
      .select()
      .from(salSignups)
      .where(and(eq(salSignups.id, signupId), isNull(salSignups.studentId)))
      .limit(1);
    if (!manual) return NextResponse.json({ error: 'Entrada manual no encontrada' }, { status: 404 });

    const [existente] = await db
      .select()
      .from(salSignups)
      .where(and(eq(salSignups.tripId, manual.tripId), eq(salSignups.studentId, eduStudentId)))
      .limit(1);

    if (existente) {
      await db
        .update(salSignups)
        .set({
          estado: 'apuntado',
          justificanteUrl: manual.justificanteUrl ?? existente.justificanteUrl,
          justificanteEstado: manual.justificanteEstado ?? existente.justificanteEstado,
          justificanteSubidoAt: manual.justificanteSubidoAt ?? existente.justificanteSubidoAt,
          emailContacto: manual.emailContacto ?? existente.emailContacto,
          manualNombre: manual.manualNombre,
          manualClase: manual.manualClase,
          manualIdentificador: manual.manualIdentificador,
          updatedAt: new Date(),
        })
        .where(eq(salSignups.id, existente.id));
      await db.delete(salSignups).where(eq(salSignups.id, manual.id));
      return NextResponse.json({ ok: true, mergedInto: existente.id });
    }

    await db
      .update(salSignups)
      .set({ studentId: eduStudentId, estado: 'apuntado', updatedAt: new Date() })
      .where(eq(salSignups.id, manual.id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
