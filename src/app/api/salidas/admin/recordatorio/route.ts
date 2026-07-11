import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { salTrips } from '@/db/schema';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { getPendientesPago } from '@/lib/salidas-server';
import { sendRecordatorioPago } from '@/lib/salidas-email';

const bodySchema = z.object({
  tripId: z.string().uuid(),
  accion: z.enum(['count', 'test', 'send']),
  subject: z.string().optional(),
  body: z.string().optional(),
  testEmail: z.string().email().optional(),
});

// Recordatorio de pago manual a las familias pendientes (excluye 'no va').
export async function POST(request: Request) {
  const guard = await requireModule('salidas');
  if (isGuardResponse(guard)) return guard;
  try {
    const input = bodySchema.parse(await request.json());
    const [trip] = await db.select().from(salTrips).where(eq(salTrips.id, input.tripId)).limit(1);
    if (!trip) return NextResponse.json({ error: 'Salida no encontrada' }, { status: 404 });
    const familias = await getPendientesPago(input.tripId);

    if (input.accion === 'count') return NextResponse.json({ ok: true, count: familias.length });
    if (!input.subject?.trim() || !input.body?.trim()) {
      return NextResponse.json({ error: 'Faltan asunto o mensaje' }, { status: 400 });
    }
    if (input.accion === 'test') {
      if (!input.testEmail) return NextResponse.json({ error: 'Falta el correo de prueba' }, { status: 400 });
      const r = await sendRecordatorioPago({
        trip,
        subject: input.subject,
        body: input.body,
        familias: [{ nombre: 'Alumno de Prueba', emails: [input.testEmail] }],
      });
      return NextResponse.json({ ok: true, ...r });
    }
    const r = await sendRecordatorioPago({ trip, subject: input.subject, body: input.body, familias });
    return NextResponse.json({ ok: true, ...r, count: familias.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}
