import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { authUsers } from '@/db/schema';
import { eduTeachers } from '@/db/schema';
import { DOMINIO_LOGIN, type Module, type Role } from '@/lib/permissions';

// Sesión larga a propósito (10 meses ≈ un curso): el claustro no debe re-loguearse
// a mitad de curso. El rol se refresca contra la BBDD cada 15 min sin re-login.
const DIEZ_MESES_S = 300 * 24 * 60 * 60;
const REFRESCO_ROL_MS = 15 * 60 * 1000;

export interface AccesoResuelto {
  role: Role | null;
  modulosExtra: Module[];
  modulosBloqueados: Module[];
}

const SIN_ACCESO: AccesoResuelto = { role: null, modulosExtra: [], modulosBloqueados: [] };

/**
 * Resuelve el acceso de un email: fila en auth_users manda (rol + ajustes por
 * persona); si no la hay pero es un profe activo de la BBDD central, es 'profe'
 * automáticamente y sin ajustes (sin alta manual).
 */
async function resolverAcceso(email: string): Promise<AccesoResuelto> {
  const e = email.toLowerCase();
  const [usuario] = await db.select().from(authUsers).where(eq(authUsers.email, e)).limit(1);
  if (usuario) {
    if (!usuario.active) return SIN_ACCESO;
    return {
      role: usuario.role as Role,
      modulosExtra: (usuario.modulosExtra ?? []) as Module[],
      modulosBloqueados: (usuario.modulosBloqueados ?? []) as Module[],
    };
  }
  const [profe] = await db.select({ active: eduTeachers.active }).from(eduTeachers).where(eq(eduTeachers.email, e)).limit(1);
  return profe?.active ? { role: 'profe', modulosExtra: [], modulosBloqueados: [] } : SIN_ACCESO;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      authorization: { params: { hd: DOMINIO_LOGIN, prompt: 'select_account' } },
    }),
  ],
  session: { strategy: 'jwt', maxAge: DIEZ_MESES_S },
  pages: { signIn: '/gestion/login' },
  callbacks: {
    // El parámetro hd es cosmético: la restricción real de dominio es esta.
    signIn({ profile }) {
      return !!profile?.email?.toLowerCase().endsWith(`@${DOMINIO_LOGIN}`);
    },
    async jwt({ token, user }) {
      const ahora = Date.now();
      const email = user?.email ?? token.email;
      const toca =
        !!user?.email ||
        (!!token.email && (typeof token.roleCheckedAt !== 'number' || ahora - token.roleCheckedAt > REFRESCO_ROL_MS));
      if (email && toca) {
        const acceso = await resolverAcceso(email);
        token.role = acceso.role;
        token.modulosExtra = acceso.modulosExtra;
        token.modulosBloqueados = acceso.modulosBloqueados;
        token.roleCheckedAt = ahora;
      }
      return token;
    },
    session({ session, token }) {
      session.user.role = (token.role as Role | null) ?? null;
      session.user.modulosExtra = (token.modulosExtra as Module[] | undefined) ?? [];
      session.user.modulosBloqueados = (token.modulosBloqueados as Module[] | undefined) ?? [];
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
    };
  }
}
