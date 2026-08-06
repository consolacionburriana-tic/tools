export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { db } from '@/db';
import { authUsers } from '@/db/schema';
import { getSessionUser } from '@/lib/auth-guards';
import { getTeachers } from '@/lib/educamos-server';
import type { Role } from '@/lib/permissions';
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
        nombre: [p.nombre, p.apellido1, p.apellido2].filter(Boolean).join(' ') || null,
        rolExplicito: (u?.active ? (u.role as Role) : null) ?? null,
        esProfe: true,
        bloqueado: !!u && !u.active, // fila en auth con active=false → sin acceso
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
      });
    }
  }
  // Con rol explícito primero, luego alfabético
  filas.sort((a, b) => Number(!!b.rolExplicito) - Number(!!a.rolExplicito) || a.email.localeCompare(b.email));

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="font-semibold text-zinc-900 dark:text-zinc-100">Usuarios y roles</h1>
            <p className="text-xs text-zinc-500">
              {filas.length} personas · el claustro activo ya entra como Profe sin alta manual
            </p>
          </div>
          <Link
            href="/gestion"
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
          >
            <ChevronLeft className="h-4 w-4" /> Escritorio
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <RolesGrid filas={filas} miEmail={user.email} />
      </main>
    </div>
  );
}
