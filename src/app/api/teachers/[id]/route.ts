import { NextResponse } from 'next/server';
import { db } from '@/db';
import { teachers } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json() as Partial<{ firstName: string; lastName: string; email: string; stage: string; active: boolean }>;
    const [updated] = await db.update(teachers).set(body).where(eq(teachers.id, id)).returning();
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error actualizando profesor:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.delete(teachers).where(eq(teachers.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error eliminando profesor:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
