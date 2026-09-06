export const dynamic = 'force-dynamic';

import Image from 'next/image';
import { redirect } from 'next/navigation';
import {
  AlarmClock,
  Apple,
  BookMarked,
  Bus,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Database,
  GraduationCap,
  KeyRound,
  Library,
  LogOut,
  NotebookPen,
  Settings2,
} from 'lucide-react';
import { count, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { abcBehaviorReports, eduStudents, eduSyncRuns, eduTeachers, licOrders } from '@/db/schema';
import { signOut } from '@/auth';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess, ROLE_LABELS, type Module } from '@/lib/permissions';
import { getCurrentCampaign } from '@/lib/licencias-server';
import { getEstadoAutoasm } from '@/lib/autoasm-entregas';
import { esTemporadaLicencias } from '@/lib/licencias';
import {
  AutoasmDestacada,
  LicenciasDestacada,
  ModuleCard,
  Rotulo,
  Stat,
  ToolDoble,
} from '@/components/home/escritorio-cards';

export const metadata = { title: 'Escritorio · Tools Consolación' };

export default async function EscritorioPage() {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  if (!user.role) redirect('/gestion/sin-acceso');
  const puede = (m: Module) => canAccess(user, m);
  // Junio y septiembre, Licencias manda: sale arriba del todo (ver esTemporadaLicencias).
  const ahora = new Date();
  const licenciasArriba = puede('licencias') && esTemporadaLicencias(ahora);
  const configuracion = puede('profes') || puede('usuarios') || puede('educamos') || puede('autoasm');

  // Stats solo de los módulos que el rol puede ver
  const [alumnos, profes, ultimoSync, pedidos, registrosAbc, estadoAsm] = await Promise.all([
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
    // AUTOASM avisa solo: sube al principio en el arranque de curso y cuando hay alumnado
    // nuevo que todavía no ha pasado por Apple School Manager.
    puede('autoasm') ? getEstadoAutoasm(ahora).catch(() => null) : null,
  ]);

  const asm = estadoAsm ?? null;
  const autoasmArriba = asm !== null && (asm.esTemporada || asm.alumnosSinPasar.length > 0);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Image src="/logobur.png" alt="" width={36} height={36} className="h-9 w-auto rounded-lg bg-white" />
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

      <main className="anim-stagger mx-auto max-w-3xl space-y-6 px-4 py-6">
        {(alumnos || pedidos || registrosAbc) && (
          <section className="anim-stagger grid grid-cols-2 gap-3 sm:grid-cols-4">
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

        {/* ── 1. Licencias, cuando es su temporada ──────────────────────── */}
        {licenciasArriba && <LicenciasDestacada />}

        {/* ── 1b. AUTOASM, en el arranque de curso o si hay alumnos sin cuenta ─ */}
        {autoasmArriba && asm && (
          <AutoasmDestacada alumnosNuevos={asm.alumnosSinPasar.length} esTemporada={asm.esTemporada} />
        )}

        {/* ── 2. El día a día: registrar y consultar, de un toque ─────────── */}
        <section className="anim-stagger grid gap-3 sm:grid-cols-2">
          <ToolDoble
            icon={<AlarmClock className="h-6 w-6" />}
            title="Puntualidad"
            desc="Quién llega tarde a las 8:05 y sus consecuencias"
            registrar="/puntualidad"
            registrarLabel="Registrar retraso"
            panel={puede('puntualidad') ? '/gestion/puntualidad' : undefined}
            color="naranja"
          />
          <ToolDoble
            icon={<ClipboardList className="h-6 w-6" />}
            title="Registro ABC"
            desc="Incidencias de conducta y su análisis"
            registrar="/registro-abc"
            registrarLabel="Registrar conducta"
            panel={puede('abc') ? '/gestion/abc' : undefined}
            color="teal"
          />
        </section>

        {/* ── 3. El resto de la gestión ──────────────────────────────────── */}
        <section className="anim-stagger space-y-3">
          {puede('licencias') && !licenciasArriba && (
            <ModuleCard
              href="/gestion/licencias"
              icon={<BookMarked className="h-6 w-6" />}
              title="Licencias digitales"
              desc="Pedidos, dashboard, exportaciones, packs y correos"
            />
          )}
          {puede('horarios') && (
            <ModuleCard
              href="/gestion/horarios"
              icon={<CalendarDays className="h-6 w-6" />}
              title="Horarios"
              desc="Horario por clase, por profesor y por aula, e importación desde Educamos"
            />
          )}
          {puede('bancolibros') && (
            <ModuleCard
              href="/gestion/bancolibros"
              icon={<Library className="h-6 w-6" />}
              title="Banco de libros"
              desc="Participantes, lotes por clase y valoración de cada libro"
            />
          )}
          {puede('salidas') && (
            <ModuleCard
              href="/gestion/salidas"
              icon={<Bus className="h-6 w-6" />}
              title="Salidas y pagos"
              desc="Excursiones, justificantes de pago y seguimiento por clase"
            />
          )}
          {puede('evaluaciones') && (
            <ModuleCard
              href="/gestion/evaluaciones"
              icon={<ClipboardCheck className="h-6 w-6" />}
              title="Evaluaciones"
              desc="Evalúa actividades con el alumnado o el claustro y mira los resultados"
            />
          )}
          {puede('cuaderno') && (
            <ModuleCard
              href="/gestion/cuaderno"
              icon={<NotebookPen className="h-6 w-6" />}
              title="Cuaderno de tutor"
              desc="Genera la documentación de tutoría de cada clase y déjala en el Drive de sus tutores"
            />
          )}
        </section>

        {/* ── 4. Configuración general: se toca de mes en mes, no a diario ── */}
        {configuracion && (
          <section className="anim-stagger space-y-3">
            <Rotulo>
              <Settings2 className="h-3.5 w-3.5" /> Configuración general
            </Rotulo>
            {puede('profes') && (
              <ModuleCard
                href="/gestion/profes"
                icon={<GraduationCap className="h-6 w-6" />}
                title="Tutorías"
                desc="Asignar rápido qué profe tutoriza cada clase"
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
            {puede('educamos') && (
              <ModuleCard
                href="/gestion/educamos"
                icon={<Database className="h-6 w-6" />}
                title="BBDD central (Educamos)"
                desc="Sincronizar alumnado y profesorado desde los exports"
              />
            )}
            {puede('autoasm') && !autoasmArriba && (
              <ModuleCard
                href="/gestion/autoasm"
                icon={<Apple className="h-6 w-6" />}
                title="AUTOASM (Apple School Manager)"
                desc="Generar y revisar los seis CSV de ASM y descargarlos en un ZIP"
              />
            )}
          </section>
        )}

      </main>
    </div>
  );
}
