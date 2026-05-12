import { NextResponse } from 'next/server';
import { db } from '@/db';
import { students } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const result = await db.select().from(students).where(eq(students.active, true));
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error cargando alumnos:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { fullName: string; displayName: string; className: string };
    const [student] = await db.insert(students).values(body).returning();
    return NextResponse.json(student, { status: 201 });
  } catch (error) {
    console.error('Error creando alumno:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
