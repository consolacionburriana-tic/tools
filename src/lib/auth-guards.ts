// Guards centrales de auth. TODAS las rutas/layout de gestión pasan por aquí:
// cuando cambie algo del sistema de auth, este es el único sitio que tocar.
import { cache } from 'react';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth, resolverAcceso } from '@/auth';
import { canAccess, type Acceso, type Module, type Role } from '@/lib/permissions';
import { COOKIE_EMULACION, decodificarEmulacion, emulacionVigente, motivoBloqueoEmulando } from '@/lib/emulacion';

export interface SessionUser extends Acceso {
  email: string;
  nombre: string | null;
  role: Role | null;
  modulosExtra: Module[];
  modulosBloqueados: Module[];
  modulosGrupos: Module[];
  /**
   * Solo si un SuperTIC está emulando: quién es DE VERDAD (los demás campos son los de la persona
   * emulada, así que toda pantalla y todo permiso se ven como los vería ella). Null = sesión normal.
   */
  emulando: { email: string; nombre: string | null } | null;
}

/** Usuario REAL de la sesión (el que hizo login), sin emulación. Para empezar/salir de emular. */
export const getSessionReal = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  if (!session?.user?.email) return null;
  return {
    email: session.user.email.toLowerCase(),
    nombre: session.user.name ?? null,
    role: session.user.role ?? null,
    modulosExtra: session.user.modulosExtra ?? [],
    modulosBloqueados: session.user.modulosBloqueados ?? [],
    modulosGrupos: session.user.modulosGrupos ?? [],
    emulando: null,
  };
});

/** A quién está emulando este SuperTIC ahora (o null): lee la cookie y la valida contra la sesión real. */
async function emuladoPor(real: SessionUser): Promise<string | null> {
  if (real.role !== 'supertic') return null;
  let valor: string | undefined;
  try {
    valor = (await cookies()).get(COOKIE_EMULACION)?.value;
  } catch {
    return null; // fuera de una petición (un worker, un cron): no hay cookie que mirar
  }
  const par = decodificarEmulacion(valor);
  return emulacionVigente(par, real.email, real.role) ? par.objetivo : null;
}

/** El usuario emulado, ya resuelto contra la BBDD (cacheado por petición: layout + página no repiten el viaje). */
const resolverEmulado = cache(async (objetivo: string, realEmail: string, realNombre: string | null): Promise<SessionUser | null> => {
  const acceso = await resolverAcceso(objetivo);
  if (!acceso.role) return null; // la persona perdió el acceso: se vuelve a ser uno mismo
  return {
    email: objetivo,
    nombre: acceso.nombre ?? null,
    role: acceso.role,
    modulosExtra: acceso.modulosExtra,
    modulosBloqueados: acceso.modulosBloqueados,
    modulosGrupos: acceso.modulosGrupos,
    emulando: { email: realEmail, nombre: realNombre },
  };
});

/**
 * Usuario de la sesión actual, o null si no hay login. Si un SuperTIC está emulando a alguien, es
 * ESA persona (con su rol y sus módulos) y `emulando` dice quién es de verdad.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const real = await getSessionReal();
  if (!real) return null;
  const objetivo = await emuladoPor(real);
  if (!objetivo) return real;
  return (await resolverEmulado(objetivo, real.email, real.nombre)) ?? real;
}

/**
 * Quién firma lo que se escribe (el libro de cambios, «hecho por»): la persona real, también cuando
 * emula, con la nota de a quién estaba emulando. Así un cambio hecho «como Fulana» no se le atribuye a ella.
 */
export function autorDe(user: SessionUser): string {
  return user.emulando ? `${user.emulando.email} (emulando a ${user.email})` : user.email;
}

/**
 * Para lo que actuaría en la cuenta de Google de la persona emulada (Drive, Calendar, correo desde su
 * buzón): si se está emulando, devuelve una respuesta 403 lista para retornar; si no, null.
 */
export function bloquearSiEmulando(user: SessionUser, queHace: string): NextResponse | null {
  if (!user.emulando) return null;
  return NextResponse.json({ error: motivoBloqueoEmulando(queHace) }, { status: 403 });
}

/**
 * Guard para route handlers de gestión: devuelve el usuario si tiene el módulo,
 * o una NextResponse 401/403 lista para retornar.
 */
export async function requireModule(modulo: Module): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canAccess(user, modulo)) return NextResponse.json({ error: 'Sin permiso para este módulo' }, { status: 403 });
  return user;
}

/**
 * Guard para route handlers que se abren con cualquiera de varios módulos: el de gestionar y
 * el de solo ver (`cuentas` / `cuentas-ver`). Las escrituras siguen pidiendo `requireModule`.
 */
export async function requireAlgunModulo(modulos: readonly Module[]): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!modulos.some((m) => canAccess(user, m))) return NextResponse.json({ error: 'Sin permiso para este módulo' }, { status: 403 });
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
  return user !== null && canAccess(user, modulo);
}
