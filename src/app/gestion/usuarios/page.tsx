export const dynamic = 'force-dynamic';

import { db } from '@/db';
import { authUsers } from '@/db/schema';
import { getSessionUser } from '@/lib/auth-guards';
import { getTeachers } from '@/lib/educamos-server';
import type { Module, Role } from '@/lib/permissions';
import { nombreProfe } from '@/lib/profes';
import { RolesGrid, type FilaUsuario } from '@/components/usuarios/roles-grid';

export const metadata = { title: 'Usuarios y roles · Tools Consolación' };

export default async function UsuariosPage() {
  const user = (await getSessionUser())!; // el layout ya garantiza sesión + módulo
  const [profes, usuarios] = await Promise.all([getTeachers(), db.select().from(authUsers)]);
  const porEmail = new Map(usuarios.map((u) => [u.email, u]));

  const filas: FilaUsuario[] = profes
    .filter((p) => p.email)
    .map((p) => {
      const u = porEmail.get(p.email!);
      return {
        email: p.email!,
        nombre: nombreProfe(p) || null,
        rolExplicito: (u?.active ? (u.role as Role) : null) ?? null,
        esProfe: true,
        bloqueado: !!u && !u.active, // fila en auth con active=false → sin acceso
        modulosExtra: ((u?.modulosExtra ?? []) as Module[]),
        modulosBloqueados: ((u?.modulosBloqueados ?? []) as Module[]),
      };
    });
  // Usuarios con fila propia que no son profes del claustro (p. ej. tic@)
  for (const u of usuarios) {
    if (!filas.some((f) => f.email === u.email)) {
      filas.push({
        email: u.email,
        nombre: u.nombre,
        rolExplicito: u.active ? (u.role as Role) : null,
        esProfe: false,
        bloqueado: !u.active,
        modulosExtra: (u.modulosExtra ?? []) as Module[],
        modulosBloqueados: (u.modulosBloqueados ?? []) as Module[],
      });
    }
  }
  // Con rol explícito primero, luego alfabético
  filas.sort((a, b) => Number(!!b.rolExplicito) - Number(!!a.rolExplicito) || a.email.localeCompare(b.email));

  return (
    <>
      <h1 className="sr-only">Usuarios y roles</h1>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        {filas.length} personas · el rol da el punto de partida y luego se afina por módulos
      </p>
      <RolesGrid filas={filas} miEmail={user.email} />
    </>
  );
}
