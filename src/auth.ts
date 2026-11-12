import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { authGrupoMiembros, authGrupos, authUsers } from '@/db/schema';
import { eduTeachers } from '@/db/schema';
import { DOMINIO_LOGIN, type Module, type Role } from '@/lib/permissions';
import { CONFIGURACION } from '@/lib/configuracion';
import { sesionCaducada } from '@/lib/sesion';
import { nombreProfe } from '@/lib/profes';

// Sesión larga a propósito (≈ un curso; los valores están en `configuracion.ts`): el claustro no debe re-loguearse
// a mitad de curso. El rol se refresca contra la BBDD cada 15 min sin re-login.
const DURACION_SESION_S = CONFIGURACION.sesion.duracionDias * 24 * 60 * 60;
const REFRESCO_ROL_MS = CONFIGURACION.sesion.refrescoRolMinutos * 60 * 1000;

export interface AccesoResuelto {
  /** Nombre para mostrar (solo lo usa la emulación, para el indicador). */
  nombre?: string | null;
  role: Role | null;
  modulosExtra: Module[];
  modulosBloqueados: Module[];
  /** Unión de los módulos de sus grupos (`auth_grupos`). */
  modulosGrupos: Module[];
}

const SIN_ACCESO: AccesoResuelto = { role: null, modulosExtra: [], modulosBloqueados: [], modulosGrupos: [] };

/** Módulos que le dan a alguien sus grupos (unión, sin repetidos). */
export async function modulosDeGruposDe(email: string): Promise<Module[]> {
  try {
    const filas = await db
      .select({ modulos: authGrupos.modulos })
      .from(authGrupoMiembros)
      .innerJoin(authGrupos, eq(authGrupos.id, authGrupoMiembros.grupoId))
      .where(eq(authGrupoMiembros.email, email.toLowerCase()));
    return [...new Set(filas.flatMap((f) => f.modulos ?? []))] as Module[];
  } catch (e) {
    // Si las tablas de grupos aún no están en Neon (auth-grupos.sql pendiente), el login no
    // puede caerse por ello: sin grupos, cada uno entra con su rol como siempre.
    console.error('[auth] no se pudieron leer los grupos', e);
    return [];
  }
}

/**
 * Resuelve el acceso de un email: fila en auth_users manda (rol + ajustes por
 * persona); si no la hay pero es un profe activo de la BBDD central, es 'profe'
 * automáticamente y sin ajustes (sin alta manual). En los dos casos, sus grupos suman.
 */
export async function resolverAcceso(email: string): Promise<AccesoResuelto> {
  const e = email.toLowerCase();
  // Fila y grupos no dependen el uno del otro: van en la misma tanda.
  const [[usuario], modulosGrupos] = await Promise.all([
    db.select().from(authUsers).where(eq(authUsers.email, e)).limit(1),
    modulosDeGruposDe(e),
  ]);
  if (usuario) {
    if (!usuario.active) return SIN_ACCESO;
    return {
      nombre: usuario.nombre,
      role: usuario.role as Role,
      modulosExtra: (usuario.modulosExtra ?? []) as Module[],
      modulosBloqueados: (usuario.modulosBloqueados ?? []) as Module[],
      modulosGrupos,
    };
  }
  const [profe] = await db
    .select({
      active: eduTeachers.active,
      nombre: eduTeachers.nombre,
      apellido1: eduTeachers.apellido1,
      apellido2: eduTeachers.apellido2,
      nombreMostrado: eduTeachers.nombreMostrado,
    })
    .from(eduTeachers)
    .where(eq(eduTeachers.email, e))
    .limit(1);
  return profe?.active
    ? { nombre: nombreProfe(profe) || null, role: 'profe', modulosExtra: [], modulosBloqueados: [], modulosGrupos }
    : SIN_ACCESO;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      authorization: { params: { hd: DOMINIO_LOGIN, prompt: 'select_account' } },
    }),
  ],
  session: { strategy: 'jwt', maxAge: DURACION_SESION_S },
  pages: { signIn: '/gestion/login' },
  callbacks: {
    // El parámetro hd es cosmético: la restricción real de dominio es esta.
    signIn({ profile }) {
      return !!profile?.email?.toLowerCase().endsWith(`@${DOMINIO_LOGIN}`);
    },
    async jwt({ token, user }) {
      const ahora = Date.now();
      // Fecha del último login con Google: es lo que cuenta el tope del profesorado. En una sesión
      // anterior a este cambio no existe, y se sella ahora (empiezan a contar desde hoy).
      if (user?.email || typeof token.loginAt !== 'number') token.loginAt = ahora;
      const email = user?.email ?? token.email;
      const toca =
        !!user?.email ||
        (!!token.email && (typeof token.roleCheckedAt !== 'number' || ahora - token.roleCheckedAt > REFRESCO_ROL_MS));
      if (email && toca) {
        const acceso = await resolverAcceso(email);
        token.role = acceso.role;
        token.modulosExtra = acceso.modulosExtra;
        token.modulosBloqueados = acceso.modulosBloqueados;
        token.modulosGrupos = acceso.modulosGrupos;
        token.roleCheckedAt = ahora;
      }
      // Profe y tutor: a los dos meses de entrar se cierra la sesión. Devolver null borra la cookie.
      if (sesionCaducada(token.role as string | null | undefined, token.loginAt as number, ahora)) return null;
      return token;
    },
    session({ session, token }) {
      session.user.role = (token.role as Role | null) ?? null;
      session.user.modulosExtra = (token.modulosExtra as Module[] | undefined) ?? [];
      session.user.modulosBloqueados = (token.modulosBloqueados as Module[] | undefined) ?? [];
      session.user.modulosGrupos = (token.modulosGrupos as Module[] | undefined) ?? [];
      return session;
    },
  },
});

declare module 'next-auth' {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: Role | null;
      modulosExtra: Module[];
      modulosBloqueados: Module[];
      modulosGrupos: Module[];
    };
  }
}
