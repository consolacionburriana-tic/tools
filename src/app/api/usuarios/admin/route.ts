import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { authUsers } from '@/db/schema';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { ROLES } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase()),
  role: z.enum(ROLES).nullable(), // null = quitar la fila (vuelve al rol automático)
  nombre: z.string().optional(),
});

// Asigna/quita rol. Un profe activo sin fila explícita ya es 'profe' automáticamente,
// así que quitar la fila no es dejar sin acceso: es volver al comportamiento por defecto.
export async function POST(request: Request) {
  const guard = await requireModule('usuarios');
  if (isGuardResponse(guard)) return guard;
  try {
    const { email, role, nombre } = bodySchema.parse(await request.json());
    // Autoprotección: no puedes quitarte a ti mismo el supertic
    if (email === guard.email && role !== 'supertic' && guard.role === 'supertic') {
      return NextResponse.json({ error: 'No puedes quitarte tu propio rol de SuperTIC' }, { status: 400 });
    }
    if (role === null) {
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
