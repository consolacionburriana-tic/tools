export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  BookMarked,
  Bus,
  ClipboardList,
  Database,
  KeyRound,
  Library,
  LogOut,
  MessageSquareText,
  Users,
} from 'lucide-react';
import { count, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { abcBehaviorReports, eduStudents, eduSyncRuns, eduTeachers, licOrders } from '@/db/schema';
import { signOut } from '@/auth';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess, ROLE_LABELS, type Module } from '@/lib/permissions';
import { getCurrentCampaign } from '@/lib/licencias-server';

export const metadata = { title: 'Escritorio · Tools Consolación' };

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
      {sub && <p className="text-xs text-zinc-400">{sub}</p>}
    </div>
  );
}

function ModuleCard({
  href,
  icon,
  title,
  desc,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-4 transition-colors hover:border-blue-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-blue-700"
    >
      <span className="mt-0.5 text-blue-600 dark:text-blue-400">{icon}</span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 font-medium text-zinc-900 dark:text-zinc-100">
          {title}
          {badge && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
              {badge}
            </span>
          )}
        </span>
        <span className="block text-xs text-zinc-500">{desc}</span>
      </span>
    </Link>
  );
}

function ComingSoon({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-dashed border-zinc-200 bg-white/50 p-4 opacity-60 dark:border-zinc-800 dark:bg-zinc-900/50">
      <span className="mt-0.5 text-zinc-400">{icon}</span>
      <span>
        <span className="flex items-center gap-2 font-medium text-zinc-500">
          {title}
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800">
            próximamente
          </span>
        </span>
      </span>
    </div>
  );
}

export default async function EscritorioPage() {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  if (!user.role) redirect('/gestion/sin-acceso');
  const puede = (m: Module) => canAccess(user.role, m);

  // Stats solo de los módulos que el rol puede ver
  const [alumnos, profes, ultimoSync, pedidos, registrosAbc] = await Promise.all([
    puede('educamos') ? db.select({ n: count() }).from(eduStudents).where(eq(eduStudents.active, true)) : null,
    puede('educamos') ? db.select({ n: count() }).from(eduTeachers).where(eq(eduTeachers.active, true)) : null,
    puede('educamos') ? db.select().from(eduSyncRuns).orderBy(desc(eduSyncRuns.createdAt)).limit(1) : null,
    puede('licencias')
      ? getCurrentCampaign().then((c) =>
          c
            ? db
                .select({ n: count() })
                .from(licOrders)
                .where(eq(licOrders.campaignId, c.id))
            : null,
        )
      : null,
    puede('abc') ? db.select({ n: count() }).from(abcBehaviorReports) : null,
  ]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logobur.png" alt="" width={36} height={36} className="h-9 w-auto rounded-lg bg-white" />
            <div>
              <h1 className="font-semibold text-zinc-900 dark:text-zinc-100">Tools Consolación</h1>
              <p className="text-xs text-zinc-500">
                {user.nombre ?? user.email} · {user.role ? ROLE_LABELS[user.role] : ''}
              </p>
            </div>
          </div>
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/gestion/login' });
            }}
          >
            <button className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
              <LogOut className="h-4 w-4" /> Salir
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        {(alumnos || pedidos || registrosAbc) && (
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {alumnos && <Stat label="Alumnado activo" value={alumnos[0].n} />}
            {profes && (
              <Stat
                label="Profesorado activo"
                value={profes[0].n}
                sub={
                  ultimoSync?.[0]
                    ? `BBDD del ${new Date(ultimoSync[0].createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`
                    : undefined
                }
              />
            )}
            {pedidos && <Stat label="Pedidos de licencias" value={pedidos[0].n} />}
            {registrosAbc && <Stat label="Registros ABC" value={registrosAbc[0].n} />}
          </section>
        )}

        <section className="space-y-3">
          <ModuleCard
            href="/registro-abc"
            icon={<ClipboardList className="h-6 w-6" />}
            title="Registrar conducta (ABC)"
            desc="Formulario rápido de incidencias — para todo el claustro"
          />
          {puede('abc') && (
            <ModuleCard
              href="/gestion/abc"
              icon={<MessageSquareText className="h-6 w-6" />}
              title="Panel del Registro ABC"
              desc="Listado, gráficos y configuración de alumnado destacado"
            />
          )}
          {puede('licencias') && (
            <ModuleCard
              href="/gestion/licencias"
              icon={<BookMarked className="h-6 w-6" />}
              title="Licencias digitales"
              desc="Pedidos, dashboard, exportaciones, packs y correos"
            />
          )}
          {puede('educamos') && (
            <ModuleCard
              href="/gestion/educamos"
              icon={<Database className="h-6 w-6" />}
              title="BBDD central (Educamos)"
              desc="Sincronizar alumnado y profesorado desde los exports"
            />
          )}
          {puede('usuarios') && (
            <ModuleCard
              href="/gestion/usuarios"
              icon={<KeyRound className="h-6 w-6" />}
              title="Usuarios y roles"
              desc="Quién puede entrar y con qué permisos"
            />
          )}
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <ComingSoon icon={<Bus className="h-6 w-6" />} title="Salidas y pagos" />
          <ComingSoon icon={<Library className="h-6 w-6" />} title="Banco de libros" />
          <ComingSoon icon={<Users className="h-6 w-6" />} title="Evaluaciones" />
        </section>
      </main>
    </div>
  );
}
