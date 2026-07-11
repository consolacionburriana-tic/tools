import { NextResponse } from 'next/server';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { licEmailTemplates } from '@/db/schema';
import { hasModule, getSessionUser } from '@/lib/auth-guards';

const isAdmin = () => hasModule('licencias');

// Plantillas de correo compartidas entre gestores (guardar/cargar/borrar).
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const plantillas = await db.select().from(licEmailTemplates).orderBy(desc(licEmailTemplates.updatedAt));
  return NextResponse.json({ plantillas });
}

const saveSchema = z.object({
  id: z.string().uuid().optional(), // con id = actualizar
  nombre: z.string().min(2),
  subject: z.string().min(2),
  body: z.string().min(2),
});

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const { id, ...datos } = saveSchema.parse(await request.json());
    const user = await getSessionUser();
    if (id) {
      const [p] = await db
        .update(licEmailTemplates)
        .set({ ...datos, updatedAt: new Date() })
        .where(eq(licEmailTemplates.id, id))
        .returning();
      return NextResponse.json({ ok: true, plantilla: p });
    }
    const [p] = await db
      .insert(licEmailTemplates)
      .values({ ...datos, createdByEmail: user?.email ?? null })
      .returning();
    return NextResponse.json({ ok: true, plantilla: p }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const { id } = z.object({ id: z.string().uuid() }).parse(await request.json());
    await db.delete(licEmailTemplates).where(eq(licEmailTemplates.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
