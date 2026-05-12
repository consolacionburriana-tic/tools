import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { behaviorReports } from '@/db/schema';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';

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
  behaviors: z.array(z.string()).min(1, 'Selecciona al menos una conducta'),
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
    const date = new Date(data.reportDate);
    const dayOfWeek = date.getDay();

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

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    console.error('Error guardando registro:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
