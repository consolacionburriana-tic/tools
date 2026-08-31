import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasModule } from '@/lib/auth-guards';
import { db } from '@/db';
import { abcStudents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getAbcStudentsPanel } from '@/lib/abc-server';

// Solo config del módulo: los datos del alumno (nombre, clase) viven en edu_students y
// se cambian en /gestion/educamos, nunca aquí.
const patchSchema = z.object({
  destacado: z.boolean().optional(),
  active: z.boolean().optional(),
  emailRecipients: z.array(z.string().email().toLowerCase()).max(20).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasModule('abc'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const { id } = await params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', issues: parsed.error.issues }, { status: 400 });
    }
    const cambios = parsed.data;
    if (Object.keys(cambios).length === 0) return NextResponse.json({ error: 'Nada que cambiar' }, { status: 400 });

    if (cambios.emailRecipients) cambios.emailRecipients = [...new Set(cambios.emailRecipients)];
    await db.update(abcStudents).set(cambios).where(eq(abcStudents.id, id));

    const panel = (await getAbcStudentsPanel()).find((s) => s.id === id);
    if (!panel) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json(panel);
  } catch (error) {
    console.error('Error actualizando alumno:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
