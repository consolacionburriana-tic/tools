import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { salTrips } from '@/db/schema';
import { verifyFamilyStudent } from '@/lib/familias-server';
import { subirPrivado } from '@/lib/blob';
import {
  getResponsablesEmails,
  getTripStats,
  registrarJustificante,
} from '@/lib/salidas-server';
import { sendJustificanteAlert, sendJustificanteConfirmacion } from '@/lib/salidas-email';

export const dynamic = 'force-dynamic';

// Subida del justificante de pago por la familia (multipart). Tras registrar,
// avisa a los responsables (Resend) con el mini-report y confirma a la familia.
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const identificador = String(form.get('identificador') ?? '');
    const eduStudentId = String(form.get('eduStudentId') ?? '');
    const tripId = String(form.get('tripId') ?? '');
    const email = String(form.get('email') ?? '').trim() || null;
    const file = form.get('file');
    if (!identificador || !eduStudentId || !tripId || !(file instanceof File)) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
    }

    const hijo = await verifyFamilyStudent(identificador, eduStudentId);
    if (!hijo) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const [trip] = await db.select().from(salTrips).where(eq(salTrips.id, tripId)).limit(1);
    if (!trip || trip.estado !== 'abierta') {
      return NextResponse.json({ error: 'Esta salida no admite justificantes ahora mismo' }, { status: 400 });
    }

    let pathname: string;
    try {
      pathname = await subirPrivado(`salidas/${tripId}/${eduStudentId}`, file);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Error subiendo el archivo' }, { status: 400 });
    }

    await registrarJustificante({ tripId, eduStudentId, pathname, emailContacto: email });

    // Avisos sin bloquear la respuesta
    void (async () => {
      try {
        const [stats, destinatarios] = await Promise.all([getTripStats(tripId), getResponsablesEmails(tripId)]);
        if (stats) {
          await sendJustificanteAlert({
            trip,
            alumnoLabel: `${hijo.maskedName} (${hijo.curso ?? ''}${hijo.letra && hijo.letra !== 'PDC' ? ` ${hijo.letra}` : ''})`,
            stats,
            destinatarios,
          });
        }
        if (email) await sendJustificanteConfirmacion({ trip, maskedName: hijo.maskedName, email });
      } catch (err) {
        console.error('Error enviando avisos de justificante:', err);
      }
    })();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error subiendo justificante:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
