import { NextResponse } from 'next/server';
import { hasModule } from '@/lib/auth-guards';
import { db } from '@/db';
import { students } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasModule('abc'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const { id } = await params;
    const body = await request.json() as Partial<{
      fullName: string;
      displayName: string;
      className: string;
      active: boolean;
      emailRecipients: string[];
    }>;
    const [updated] = await db.update(students).set(body).where(eq(students.id, id)).returning();
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error actualizando alumno:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
