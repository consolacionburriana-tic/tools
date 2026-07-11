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
  registrarJustificanteManual,
} from '@/lib/salidas-server';
import { sendJustificanteAlert, sendJustificanteConfirmacion } from '@/lib/salidas-email';

export const dynamic = 'force-dynamic';

// Subida del justificante de pago por la familia (multipart). Dos modos:
// - normal: identificador + eduStudentId verificados contra la BBDD central
// - MANUAL: la familia no se encontró y teclea clase + nombre (queda muy marcada
//   en el panel para que gestión la enlace y arregle el dato de origen)
// Tras registrar, avisa a los responsables (Resend) con mini-report y confirma a la familia.
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const identificador = String(form.get('identificador') ?? '').trim();
    const eduStudentId = String(form.get('eduStudentId') ?? '');
    const manualNombre = String(form.get('manualNombre') ?? '').trim();
    const manualClase = String(form.get('manualClase') ?? '').trim();
    const tripId = String(form.get('tripId') ?? '');
    const email = String(form.get('email') ?? '').trim() || null;
    const file = form.get('file');
    const esManual = !eduStudentId && manualNombre.length >= 5 && manualClase.length > 0;
    if (!tripId || !(file instanceof File) || (!esManual && (!identificador || !eduStudentId))) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
    }

    let alumnoLabel: string;
    let maskedName: string;
    if (esManual) {
      alumnoLabel = `${manualNombre} (${manualClase}) — ⚠️ ENTRADA MANUAL, hay que enlazarla`;
      maskedName = manualNombre;
    } else {
      const hijo = await verifyFamilyStudent(identificador, eduStudentId);
      if (!hijo) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      alumnoLabel = `${hijo.maskedName} (${hijo.curso ?? ''}${hijo.letra && hijo.letra !== 'PDC' ? ` ${hijo.letra}` : ''})`;
      maskedName = hijo.maskedName;
    }

    const [trip] = await db.select().from(salTrips).where(eq(salTrips.id, tripId)).limit(1);
    if (!trip || trip.estado !== 'abierta') {
      return NextResponse.json({ error: 'Esta salida no admite justificantes ahora mismo' }, { status: 400 });
    }

    let pathname: string;
    try {
      pathname = await subirPrivado(`salidas/${tripId}/${esManual ? 'manual' : eduStudentId}`, file);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Error subiendo el archivo' }, { status: 400 });
    }

    if (esManual) {
      await registrarJustificanteManual({
        tripId,
        nombre: manualNombre,
        clase: manualClase,
        identificador: identificador || null,
        pathname,
        emailContacto: email,
      });
    } else {
      await registrarJustificante({ tripId, eduStudentId, pathname, emailContacto: email });
    }

    // Avisos sin bloquear la respuesta
    void (async () => {
      try {
        const [stats, destinatarios] = await Promise.all([getTripStats(tripId), getResponsablesEmails(tripId)]);
        if (stats) await sendJustificanteAlert({ trip, alumnoLabel, stats, destinatarios });
        if (email) await sendJustificanteConfirmacion({ trip, maskedName, email });
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
