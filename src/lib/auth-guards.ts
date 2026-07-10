// Guards centrales de auth. TODAS las rutas/layout de gestión pasan por aquí:
// cuando cambie algo del sistema de auth, este es el único sitio que tocar.
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { canAccess, type Module, type Role } from '@/lib/permissions';

export interface SessionUser {
  email: string;
  nombre: string | null;
  role: Role | null;
}

/** Usuario de la sesión actual, o null si no hay login. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.email) return null;
  return {
    email: session.user.email.toLowerCase(),
    nombre: session.user.name ?? null,
    role: session.user.role ?? null,
  };
}

/**
 * Guard para route handlers de gestión: devuelve el usuario si tiene el módulo,
 * o una NextResponse 401/403 lista para retornar.
 */
export async function requireModule(modulo: Module): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canAccess(user.role, modulo)) return NextResponse.json({ error: 'Sin permiso para este módulo' }, { status: 403 });
  return user;
}

/** Guard para endpoints que solo exigen sesión del claustro (p. ej. formulario ABC). */
export async function requireSession(): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  return user;
}

export function isGuardResponse(x: SessionUser | NextResponse): x is NextResponse {
  return x instanceof NextResponse;
}

/** Versión booleana para código existente estilo `if (!(await isAdmin())) ...`. */
export async function hasModule(modulo: Module): Promise<boolean> {
  const user = await getSessionUser();
  return user !== null && canAccess(user.role, modulo);
}
