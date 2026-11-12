import { NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { authGrupoMiembros, authGrupos } from '@/db/schema';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { MODULOS_DE_GRUPO } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

// Grupos de usuarios (docs/01-auth-roles.md): crear, renombrar, elegir sus módulos, meter y
// sacar personas, y borrar. Lo mismo que Usuarios y roles: solo quien tiene el módulo `usuarios`.
// Un grupo solo SUMA módulos, así que nadie se puede dejar fuera a sí mismo desde aquí.
const nombreSchema = z.string().trim().min(1, 'Ponle un nombre al grupo').max(60);

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('crear'), nombre: nombreSchema, descripcion: z.string().trim().max(200).optional() }),
  z.object({
    action: z.literal('editar'),
    id: z.string().uuid(),
    nombre: nombreSchema.optional(),
    descripcion: z.string().trim().max(200).nullable().optional(),
    // La lista COMPLETA de módulos del grupo. Los reservados a SuperTIC no se pueden dar.
    modulos: z.array(z.enum(MODULOS_DE_GRUPO as [string, ...string[]])).optional(),
  }),
  z.object({
    action: z.literal('miembro'),
    id: z.string().uuid(),
    email: z.string().email().transform((e) => e.toLowerCase()),
    dentro: z.boolean(),
  }),
  z.object({ action: z.literal('borrar'), id: z.string().uuid() }),
]);

/** ¿Ya hay otro grupo con ese nombre (sin mirar mayúsculas)? */
async function nombreOcupado(nombre: string, salvo?: string): Promise<boolean> {
  const [fila] = await db
    .select({ id: authGrupos.id })
    .from(authGrupos)
    .where(sql`lower(${authGrupos.nombre}) = lower(${nombre})`)
    .limit(1);
  return !!fila && fila.id !== salvo;
}

export async function POST(request: Request) {
  const guard = await requireModule('usuarios');
  if (isGuardResponse(guard)) return guard;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 });
  }
  const body = parsed.data;
  try {
    if (body.action === 'crear') {
      if (await nombreOcupado(body.nombre)) {
        return NextResponse.json({ error: 'Ya hay un grupo con ese nombre' }, { status: 400 });
      }
      const [grupo] = await db
        .insert(authGrupos)
        .values({ nombre: body.nombre, descripcion: body.descripcion || null, modulos: [] })
        .returning({ id: authGrupos.id, nombre: authGrupos.nombre, descripcion: authGrupos.descripcion });
      return NextResponse.json({ ok: true, grupo: { ...grupo, modulos: [], miembros: [] } });
    }

    if (body.action === 'editar') {
      if (body.nombre && (await nombreOcupado(body.nombre, body.id))) {
        return NextResponse.json({ error: 'Ya hay un grupo con ese nombre' }, { status: 400 });
      }
      const cambios: Partial<typeof authGrupos.$inferInsert> = { updatedAt: new Date() };
      if (body.nombre !== undefined) cambios.nombre = body.nombre;
      if (body.descripcion !== undefined) cambios.descripcion = body.descripcion || null;
      if (body.modulos !== undefined) cambios.modulos = [...new Set(body.modulos)];
      const hecho = await db.update(authGrupos).set(cambios).where(eq(authGrupos.id, body.id)).returning({ id: authGrupos.id });
      if (hecho.length === 0) return NextResponse.json({ error: 'Ese grupo ya no existe' }, { status: 404 });
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'miembro') {
      if (body.dentro) {
        const [grupo] = await db.select({ id: authGrupos.id }).from(authGrupos).where(eq(authGrupos.id, body.id)).limit(1);
        if (!grupo) return NextResponse.json({ error: 'Ese grupo ya no existe' }, { status: 404 });
        await db.insert(authGrupoMiembros).values({ grupoId: body.id, email: body.email }).onConflictDoNothing();
      } else {
        await db
          .delete(authGrupoMiembros)
          .where(and(eq(authGrupoMiembros.grupoId, body.id), eq(authGrupoMiembros.email, body.email)));
      }
      return NextResponse.json({ ok: true });
    }

    // borrar: los miembros se van con él (ON DELETE CASCADE). Es configuración, no histórico.
    await db.delete(authGrupos).where(eq(authGrupos.id, body.id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
