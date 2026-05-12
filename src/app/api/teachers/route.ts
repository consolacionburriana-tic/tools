import { NextResponse } from 'next/server';
import { db } from '@/db';
import { teachers } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const result = await db.select().from(teachers).where(eq(teachers.active, true));
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error cargando profesores:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { firstName: string; lastName: string; email: string; stage: string };
    const [teacher] = await db.insert(teachers).values(body).returning();
    return NextResponse.json(teacher, { status: 201 });
  } catch (error) {
    console.error('Error creando profesor:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
