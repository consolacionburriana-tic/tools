import { NextResponse } from 'next/server';
import { hasModule } from '@/lib/auth-guards';
import { db } from '@/db';
import { students } from '@/db/schema';
import { asc, desc } from 'drizzle-orm';

export async function GET() {
  if (!(await hasModule('abc'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const result = await db.select().from(students).orderBy(desc(students.destacado), asc(students.fullName));
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error cargando alumnos:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await hasModule('abc'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const body = await request.json() as { fullName: string; displayName: string; className: string };
    const [student] = await db.insert(students).values(body).returning();
    return NextResponse.json(student, { status: 201 });
  } catch (error) {
    console.error('Error creando alumno:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
