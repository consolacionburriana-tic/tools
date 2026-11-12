export const dynamic = 'force-dynamic';

import { db } from '@/db';
import { authGrupoMiembros, authGrupos, authUsers } from '@/db/schema';
import { getSessionUser } from '@/lib/auth-guards';
import { puedeEmularUsuarios } from '@/lib/emulacion';
import { getTeachers } from '@/lib/educamos-server';
import type { Module, Role } from '@/lib/permissions';
import { nombreProfe } from '@/lib/profes';
import type { FilaUsuario } from '@/components/usuarios/roles-grid';
import type { GrupoVista } from '@/components/usuarios/grupos-panel';
import { UsuariosVistas } from '@/components/usuarios/usuarios-vistas';

export const metadata = { title: 'Usuarios y roles · Tools Consolación' };

export default async function UsuariosPage() {
  const user = (await getSessionUser())!; // el layout ya garantiza sesión + módulo
  const [profes, usuarios, gruposBd, miembrosBd] = await Promise.all([
    getTeachers(),
    db.select().from(authUsers),
    // Sin las tablas de grupos en Neon (auth-grupos.sql pendiente), la pantalla sigue sirviendo para personas.
    db
      .select({ id: authGrupos.id, nombre: authGrupos.nombre, descripcion: authGrupos.descripcion, modulos: authGrupos.modulos })
      .from(authGrupos)
      .catch(() => []),
    db
      .select({ grupoId: authGrupoMiembros.grupoId, email: authGrupoMiembros.email })
      .from(authGrupoMiembros)
      .catch(() => []),
  ]);
  const grupos: GrupoVista[] = gruposBd
    .map((g) => ({
      ...g,
      modulos: (g.modulos ?? []) as Module[],
      miembros: miembrosBd.filter((m) => m.grupoId === g.id).map((m) => m.email),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
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
        {filas.length} personas · el rol da el punto de partida, los grupos suman módulos y luego se afina persona a persona
      </p>
      {/* Emulando, «tú» sigue siendo el SuperTIC de verdad, y desde aquí se puede saltar directo a otra persona. */}
      <UsuariosVistas
        filas={filas}
        grupos={grupos}
        miEmail={user.emulando?.email ?? user.email}
        puedeEmular={!!user.emulando || puedeEmularUsuarios(user.role)}
      />
    </>
  );
}
