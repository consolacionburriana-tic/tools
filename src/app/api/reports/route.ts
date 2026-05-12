import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { behaviorReports, students, teachers } from '@/db/schema';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { getResend, FROM } from '@/lib/email';
import { buildReportEmail } from '@/lib/email-template';

const reportSchema = z.object({
  studentId: z.string().uuid(),
  teacherId: z.string().uuid().nullable().optional(),
  otherTeacherName: z.string().nullable().optional(),
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '20');
    const offset = (page - 1) * limit;

    const conditions = [];
    if (studentId) conditions.push(eq(behaviorReports.studentId, studentId));
    if (from) conditions.push(gte(behaviorReports.reportDate, from));
    if (to) conditions.push(lte(behaviorReports.reportDate, to));

    const result = await db
      .select()
      .from(behaviorReports)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(behaviorReports.reportDate), desc(behaviorReports.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error cargando registros:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = reportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', issues: parsed.error.issues }, { status: 400 });
    }

    const data = parsed.data;
    const dayOfWeek = new Date(data.reportDate).getDay();

    const [report] = await db.insert(behaviorReports).values({
      ...data,
      dayOfWeek,
      teacherId: data.teacherId ?? null,
      otherTeacherName: data.otherTeacherName ?? null,
      contextNote: data.contextNote ?? null,
      presentNames: data.presentNames ?? null,
      involvedWith: data.involvedWith ?? null,
      antecedents: data.antecedents ?? null,
      consequences: data.consequences ?? null,
      redirectActions: data.redirectActions ?? null,
      effectivenessRating: data.effectivenessRating != null ? String(data.effectivenessRating) : null,
      reasons: data.reasons ?? [],
      reasonOther: data.reasonOther ?? null,
      comments: data.comments ?? null,
    }).returning();

    // Enviar email de notificación (sin bloquear la respuesta)
    sendNotificationEmail(report.studentId, data).catch((err) =>
      console.error('Error enviando email de notificación:', err)
    );

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    console.error('Error guardando registro:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

async function sendNotificationEmail(studentId: string, data: z.infer<typeof reportSchema>) {
  if (!process.env.RESEND_API_KEY) return;

  // Obtener datos del alumno y del profesor
  const [student] = await db.select().from(students).where(eq(students.id, studentId));
  if (!student || !student.emailRecipients || student.emailRecipients.length === 0) return;

  let teacherName = data.otherTeacherName ?? 'Desconocido';
  if (data.teacherId) {
    const [teacher] = await db.select().from(teachers).where(eq(teachers.id, data.teacherId));
    if (teacher) teacherName = `${teacher.firstName} ${teacher.lastName}`;
  }

  const { subject, html } = buildReportEmail({
    studentDisplayName: student.displayName,
    studentFullName: student.fullName,
    studentClassName: student.className,
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
  // Resend acepta hasta 50 destinatarios por envío; limitamos a 20 en la UI
  await resend.emails.send({
    from: FROM,
    to: student.emailRecipients as string[],
    subject,
    html,
  });
}
