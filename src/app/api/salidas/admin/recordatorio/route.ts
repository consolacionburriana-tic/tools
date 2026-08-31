import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { salTrips } from '@/db/schema';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { getPendientesPago, type PendientePago } from '@/lib/salidas-server';
import { sendRecordatorioPago } from '@/lib/salidas-email';
import { appBaseUrl } from '@/lib/constants';
import { urlAccesoFamilia } from '@/lib/familias';
import { ensureTokens, getFamiliasDeAlumnos, marcarTokensEnviados } from '@/lib/fam-tokens-server';

const DIAS_VALIDEZ = 120;

// Un enlace por familia (agrupada por correo de tutor), indexado por el eduStudentId de cada
// pendiente para poder adjuntarlo a su envío. Si un alumno tiene dos tutores con distinto
// correo, se usa el enlace del primero — el envío ya va a ambos correos en el mismo `to`.
async function enlacesPorAlumno(
  pendientes: PendientePago[],
): Promise<{ porAlumno: Map<string, string>; tokensUsados: string[] }> {
  const eduStudentIds = pendientes.map((p) => p.eduStudentId);
  const { familias } = await getFamiliasDeAlumnos(eduStudentIds);
  if (familias.length === 0) return { porAlumno: new Map(), tokensUsados: [] };
  const expiresAt = new Date(Date.now() + DIAS_VALIDEZ * 24 * 60 * 60 * 1000);
  const tokens = await ensureTokens(familias, { proposito: 'salidas', expiresAt });
  const base = appBaseUrl();
  const porAlumno = new Map<string, string>();
  const tokensUsados: string[] = [];
  for (const f of familias) {
    const asignado = tokens.get(f.email);
    if (!asignado) continue;
    tokensUsados.push(asignado.token);
    const enlace = urlAccesoFamilia(base, 'salidas', asignado.token);
    for (const id of f.hijosObjetivo) if (!porAlumno.has(id)) porAlumno.set(id, enlace);
  }
  return { porAlumno, tokensUsados };
}

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
    const { porAlumno, tokensUsados } = await enlacesPorAlumno(familias);

    if (input.accion === 'test') {
      if (!input.testEmail) return NextResponse.json({ error: 'Falta el correo de prueba' }, { status: 400 });
      const enlaceEjemplo = familias.length > 0 ? porAlumno.get(familias[0].eduStudentId) : undefined;
      const r = await sendRecordatorioPago({
        trip,
        subject: input.subject,
        body: input.body,
        familias: [{ nombre: 'Alumno de Prueba', emails: [input.testEmail], enlace: enlaceEjemplo }],
        replyTo: guard.email,
      });
      return NextResponse.json({ ok: true, ...r });
    }
    const familiasConEnlace = familias.map((f) => ({ ...f, enlace: porAlumno.get(f.eduStudentId) }));
    const r = await sendRecordatorioPago({
      trip,
      subject: input.subject,
      body: input.body,
      familias: familiasConEnlace,
      replyTo: guard.email, // las familias responden al tutor que manda el recordatorio
    });
    if (r.enviados > 0 && tokensUsados.length > 0) await marcarTokensEnviados(tokensUsados);
    return NextResponse.json({ ok: true, ...r, count: familias.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
}
