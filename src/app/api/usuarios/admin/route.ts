import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { authUsers, eduTeachers } from '@/db/schema';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { ROLES } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase()),
  // 'set' (defecto): asignar/quitar rol · 'block': dejar sin acceso · 'delete': eliminar definitivamente
  action: z.enum(['set', 'block', 'delete']).optional().default('set'),
  role: z.enum(ROLES).nullable().optional(), // solo para action 'set'; null = quitar la fila
  nombre: z.string().optional(),
});

// Asigna/quita rol, bloquea el acceso o elimina definitivamente a un usuario.
//   set  : un profe activo sin fila ya es 'profe' automático; quitar la fila (role=null)
//          vuelve al comportamiento por defecto, no deja sin acceso.
//   block: crea/actualiza la fila con active=false → resolverRol() devuelve null (sin acceso),
//          aunque siga activo en el claustro. Reversible (volver a asignarle un rol).
//   delete: baja del claustro (edu_teachers.active=false) + borra la fila de auth. Sus datos
//          históricos (registros, salidas creadas…) se conservan por las FKs.
export async function POST(request: Request) {
  const guard = await requireModule('usuarios');
  if (isGuardResponse(guard)) return guard;
  try {
    const { email, action, role, nombre } = bodySchema.parse(await request.json());

    // Autoprotección: no puedes bloquearte/eliminarte a ti mismo ni quitarte el SuperTIC.
    if (email === guard.email && (action !== 'set' || (role !== 'supertic' && guard.role === 'supertic'))) {
      return NextResponse.json({ error: 'No puedes retirarte a ti mismo el acceso' }, { status: 400 });
    }

    if (action === 'block') {
      const [existente] = await db.select().from(authUsers).where(eq(authUsers.email, email)).limit(1);
      await db
        .insert(authUsers)
        .values({ email, role: existente?.role ?? 'profe', nombre, active: false })
        .onConflictDoUpdate({ target: authUsers.email, set: { active: false, updatedAt: new Date() } });
      return NextResponse.json({ ok: true });
    }

    if (action === 'delete') {
      await db.update(eduTeachers).set({ active: false, updatedAt: new Date() }).where(eq(eduTeachers.email, email));
      await db.delete(authUsers).where(eq(authUsers.email, email));
      return NextResponse.json({ ok: true });
    }

    // action === 'set'
    if (role === null || role === undefined) {
      await db.delete(authUsers).where(eq(authUsers.email, email));
    } else {
      await db
        .insert(authUsers)
        .values({ email, role, nombre })
        .onConflictDoUpdate({ target: authUsers.email, set: { role, active: true, updatedAt: new Date() } });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
