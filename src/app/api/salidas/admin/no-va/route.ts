import { NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { salSignups } from '@/db/schema';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { marcarNoVa } from '@/lib/salidas-server';

const bodySchema = z.object({ tripId: z.string().uuid(), eduStudentId: z.string().uuid() });

// "No va" lo marca el PROFESORADO (decisión 2026-07-11): crea/actualiza la inscripción.
export async function POST(request: Request) {
  const guard = await requireModule('salidas');
  if (isGuardResponse(guard)) return guard;
  try {
    const { tripId, eduStudentId } = bodySchema.parse(await request.json());
    await marcarNoVa(tripId, eduStudentId);
    const [signup] = await db
      .select({ id: salSignups.id })
      .from(salSignups)
      .where(and(eq(salSignups.tripId, tripId), eq(salSignups.studentId, eduStudentId)))
      .limit(1);
    return NextResponse.json({ ok: true, signupId: signup?.id ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
