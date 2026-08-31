import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { behaviorReports } from '@/db/schema';
import { desc, and, eq, gte, lte, inArray } from 'drizzle-orm';
import { getResend, FROM } from '@/lib/email';
import { buildReportEmail } from '@/lib/email-template';
import { hasModule, isGuardResponse, requireSession } from '@/lib/auth-guards';
import { getAbcStudentParaEmail, getTeacherFromSession, resolveAbcStudent } from '@/lib/abc-server';

const reportSchema = z.object({
  // Alumno: fila de config del ABC o alumno de la BBDD central (se autocrea la config)
  abcStudentId: z.string().uuid().optional(),
  eduStudentId: z.string().uuid().optional(),
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  context: z.enum(['aula', 'patio', 'comedor', 'otros']),
  contextNote: z.string().nullable().optional(),
  timeSlot: z.enum(['primera_hora', 'antes_patio', 'bajadas', 'patio', 'almuerzo', 'despues_patio', 'ultima_hora']),
  presentPeople: z.array(z.string()),
  presentNames: z.string().nullable().optional(),
  behaviors: z.array(z.string()).min(1),
  involvedWith: z.string().nullable().optional(),
  antecedents: z.string().nullable().optional(),
  consequences: z.string().nullable().optional(),
  redirectActions: z.string().nullable().optional(),
  effectivenessRating: z.number().min(0).max(5).nullable().optional(),
  reasons: z.array(z.string()).optional(),
  reasonOther: z.string().nullable().optional(),
  comments: z.string().nullable().optional(),
});

// Listado para el panel del módulo
export async function GET(request: Request) {
  if (!(await hasModule('abc'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const studentIds = searchParams.get('studentIds')?.split(',').filter(Boolean);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const all = searchParams.get('all') === 'true';
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '20');
    const offset = (page - 1) * limit;

    const conditions = [];
    if (studentId) conditions.push(eq(behaviorReports.studentId, studentId));
    if (studentIds && studentIds.length > 0) {
      conditions.push(inArray(behaviorReports.studentId, studentIds));
    }
    if (from) conditions.push(gte(behaviorReports.reportDate, from));
    if (to) conditions.push(lte(behaviorReports.reportDate, to));

    let query = db
      .select()
      .from(behaviorReports)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(behaviorReports.reportDate), desc(behaviorReports.createdAt))
      .$dynamic();

    if (!all) {
      query = query.limit(limit).offset(offset);
    }

    const result = await query;
    // teacherId unificado: los registros nuevos llevan edu_teacher_id, los viejos teacher_id.
    // /api/teachers devuelve ambos catálogos, así el panel resuelve nombres sin distinguir.
    return NextResponse.json(result.map((r) => ({ ...r, teacherId: r.eduTeacherId ?? r.teacherId })));
  } catch (error) {
    console.error('Error cargando registros:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// Guardar registro: cualquier persona del claustro con sesión. El profesor sale
// del login (edu_teachers por email), ya no se elige en el formulario.
export async function POST(request: Request) {
  const guard = await requireSession();
  if (isGuardResponse(guard)) return guard;
  try {
    const body = await request.json();
    const parsed = reportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', issues: parsed.error.issues }, { status: 400 });
    }
    const data = parsed.data;
    if (!data.abcStudentId && !data.eduStudentId) {
      return NextResponse.json({ error: 'Falta el alumno' }, { status: 400 });
    }

    const student = await resolveAbcStudent(data);
    if (!student) return NextResponse.json({ error: 'Alumno no encontrado' }, { status: 404 });

    const profe = await getTeacherFromSession(guard.email);
    const dayOfWeek = new Date(data.reportDate).getDay();

    const [report] = await db.insert(behaviorReports).values({
      studentId: student.id,
      eduTeacherId: profe?.id ?? null,
      teacherId: null,
      otherTeacherName: profe ? null : (guard.nombre ?? guard.email),
      reportDate: data.reportDate,
      dayOfWeek,
      context: data.context,
      contextNote: data.contextNote ?? null,
      timeSlot: data.timeSlot,
      presentPeople: data.presentPeople,
      presentNames: data.presentNames ?? null,
      behaviors: data.behaviors,
      involvedWith: data.involvedWith ?? null,
      antecedents: data.antecedents ?? null,
      consequences: data.consequences ?? null,
      redirectActions: data.redirectActions ?? null,
      effectivenessRating: data.effectivenessRating != null ? String(data.effectivenessRating) : null,
      reasons: data.reasons ?? [],
      reasonOther: data.reasonOther ?? null,
      comments: data.comments ?? null,
    }).returning();

    const teacherName = profe
      ? [profe.nombre, profe.apellido1, profe.apellido2].filter(Boolean).join(' ')
      : (guard.nombre ?? guard.email);
    sendNotificationEmail(student.id, teacherName, data).catch((err) =>
      console.error('Error enviando email de notificación:', err)
    );

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    console.error('Error guardando registro:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

async function sendNotificationEmail(abcStudentId: string, teacherName: string, data: z.infer<typeof reportSchema>) {
  if (!process.env.RESEND_API_KEY) return;

  const alumno = await getAbcStudentParaEmail(abcStudentId);
  if (!alumno || alumno.emailRecipients.length === 0) return;

  // Asunto con siglas (se ve en la notificación del móvil); dentro, el nombre completo
  // para las personas configuradas, que son las que llevan el caso.
  const { subject, html } = buildReportEmail({
    studentDisplayName: alumno.siglas,
    studentFullName: alumno.nombreCompleto,
    studentClassName: alumno.clase,
    teacherName,
    reportDate: data.reportDate,
    context: data.context,
    contextNote: data.contextNote,
    timeSlot: data.timeSlot,
    presentPeople: data.presentPeople,
    behaviors: data.behaviors,
    involvedWith: data.involvedWith,
    reasons: data.reasons ?? [],
    reasonOther: data.reasonOther,
    antecedents: data.antecedents,
    consequences: data.consequences,
    redirectActions: data.redirectActions,
    effectivenessRating: data.effectivenessRating != null ? String(data.effectivenessRating) : null,
    comments: data.comments,
  });

  const resend = getResend();
  await resend.emails.send({
    from: FROM,
    to: alumno.emailRecipients,
    subject,
    html,
  });
}
