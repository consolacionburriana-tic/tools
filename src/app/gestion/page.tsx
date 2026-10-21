export const dynamic = 'force-dynamic';

import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Eye, LogOut } from 'lucide-react';
import { count, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { abcBehaviorReports, eduStudents, eduSyncRuns, eduTeachers, licOrders } from '@/db/schema';
import { signOut } from '@/auth';
import { getSessionUser } from '@/lib/auth-guards';
import { canAccess, ROLE_LABELS, type Module } from '@/lib/permissions';
import { getCurrentCampaign } from '@/lib/licencias-server';
import { getEstadoAutoasm } from '@/lib/autoasm-entregas';
import { accesoComunActivo } from '@/lib/oratorios-server';
import { misTarjetas } from '@/lib/tableros-server';
import { cuentaNouvinguts } from '@/lib/nouvinguts-server';
import { cuentaSinInformar } from '@/lib/dispositivos-server';
import { hoyISO, resumenUrgente, textoResumenUrgente } from '@/lib/tableros';
import { esTemporadaLicencias } from '@/lib/licencias';
import { herramientasDe, saludo } from '@/lib/escritorio';
import { CONFIGURACION } from '@/lib/configuracion';
import { Escritorio, type Aviso, type Cifra } from '@/components/home/escritorio';
import { SelectorTema } from '@/components/home/selector-tema';

export const metadata = { title: 'Escritorio · Tools Consolación' };

const ZONA = CONFIGURACION.calendario.zonaHoraria;
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

// Ficha: docs/03-escritorio-admin.md. Aquí se resuelve qué ve cada uno y se cuenta lo que haga
// falta (todo en una tanda); el reparto en grupos está en `src/lib/escritorio.ts` y la pantalla,
// en `components/home/escritorio.tsx`.
export default async function EscritorioPage() {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  // Con sesión pero sin rol (alumnado, cuentas que no son del claustro): a la portada de fuera.
  if (!user.role) redirect('/');
  const puede = (m: Module) => canAccess(user, m);
  const ahora = new Date();
  const temporadaLicencias = puede('licencias') && esTemporadaLicencias(ahora);

  const [alumnos, profes, ultimoSync, pedidos, registrosAbc, estadoAsm, oratoriosComun, misTareas, nouvinguts, sinIpad] = await Promise.all([
    puede('educamos') ? db.select({ n: count() }).from(eduStudents).where(eq(eduStudents.active, true)) : null,
    puede('educamos') ? db.select({ n: count() }).from(eduTeachers).where(eq(eduTeachers.active, true)) : null,
    puede('educamos') ? db.select({ at: eduSyncRuns.createdAt }).from(eduSyncRuns).orderBy(desc(eduSyncRuns.createdAt)).limit(1) : null,
    puede('licencias')
      ? getCurrentCampaign().then((c) => (c ? db.select({ n: count() }).from(licOrders).where(eq(licOrders.campaignId, c.id)) : null))
      : null,
    puede('abc') ? db.select({ n: count() }).from(abcBehaviorReports) : null,
    // AUTOASM avisa en el arranque de curso y cuando hay alumnado nuevo sin pasar por Apple School Manager.
    puede('autoasm') ? getEstadoAutoasm(ahora).catch(() => null) : null,
    // Oratorios: el claustro solo lo ve si quien lo lleva ha abierto el acceso común.
    !puede('oratorios') && puede('oratorios-ver') ? accesoComunActivo().catch(() => false) : false,
    puede('tableros') ? misTarjetas(user.email).catch(() => null) : null,
    puede('nouvinguts') ? cuentaNouvinguts().catch(() => null) : null,
    puede('dispositivos') ? cuentaSinInformar().catch(() => null) : null,
  ]);
  const urgente = misTareas ? resumenUrgente(misTareas, hoyISO(ahora)) : null;
  const textoUrgente = urgente ? textoResumenUrgente(urgente) : '';

  // ── Las cifras: una línea bajo el saludo, solo para quien tiene esos datos ──
  const cifras: Cifra[] = [];
  if (alumnos) cifras.push({ valor: String(alumnos[0].n), etiqueta: 'alumnos' });
  if (profes) cifras.push({ valor: String(profes[0].n), etiqueta: 'profes' });
  if (ultimoSync?.[0]) {
    cifras.push({
      prefijo: 'Educamos al',
      valor: new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: ZONA }).format(ultimoSync[0].at),
      etiqueta: '',
    });
  }
  if (pedidos) cifras.push({ valor: String(pedidos[0].n), etiqueta: 'pedidos de licencias' });
  if (registrosAbc) cifras.push({ valor: String(registrosAbc[0].n), etiqueta: 'registros ABC' });

  // ── Ahora: lo que pide que alguien haga algo hoy ──
  const avisos: Aviso[] = [];
  if (temporadaLicencias) {
    avisos.push({
      clave: 'licencias',
      titulo: 'Campaña de licencias',
      texto:
        ahora.getMonth() === 5
          ? `Pedidos del curso que viene${pedidos ? ` · ${plural(pedidos[0].n, 'pedido', 'pedidos')}` : ''}`
          : `Rezagados, altas y códigos${pedidos ? ` · ${plural(pedidos[0].n, 'pedido', 'pedidos')}` : ''}`,
      href: '/gestion/licencias',
      tono: 'azul',
      icono: 'licencias',
    });
  }
  if (estadoAsm && (estadoAsm.alumnosSinPasar.length > 0 || estadoAsm.esTemporada)) {
    const nuevos = estadoAsm.alumnosSinPasar.length;
    avisos.push({
      clave: 'autoasm',
      titulo: 'Apple School Manager',
      texto: nuevos > 0 ? `${plural(nuevos, 'alumno nuevo', 'alumnos nuevos')} sin cuenta en el iPad` : 'Arranque de curso: falta la primera subida',
      href: '/gestion/autoasm',
      tono: nuevos > 0 ? 'ambar' : 'azul',
      icono: 'autoasm',
    });
  }
  if (urgente && textoUrgente) {
    avisos.push({
      clave: 'tableros',
      titulo: 'Tus tareas',
      texto: textoUrgente,
      href: '/gestion/tableros',
      tono: urgente.vencidas ? 'rojo' : 'azul',
      icono: 'tableros',
    });
  }
  if (nouvinguts) {
    avisos.push({
      clave: 'nouvinguts',
      titulo: 'Nouvinguts',
      texto: `${plural(nouvinguts, 'alumno nuevo', 'alumnos nuevos')} con pasos por hacer`,
      href: '/gestion/nouvinguts',
      tono: 'azul',
      icono: 'nouvinguts',
    });
  }
  if (sinIpad) {
    avisos.push({
      clave: 'dispositivos',
      titulo: 'Dispositivos 1:1',
      texto: `${plural(sinIpad, 'alumno', 'alumnos')} sin informar de su iPad`,
      href: '/gestion/dispositivos',
      tono: 'ambar',
      icono: 'dispositivos',
    });
  }

  const herramientas = herramientasDe(user, {
    oratoriosComun,
    nouvinguts,
    dispositivosSinInformar: sinIpad,
    tableros: misTareas
      ? { pendientes: misTareas.length, urgente: textoUrgente ? { texto: textoUrgente, tono: urgente?.vencidas ? 'rojo' : 'azul' } : null }
      : null,
  });

  const pila = (user.nombre ?? '').trim().split(/\s+/)[0] || null;
  const fecha = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: ZONA }).format(ahora);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Image src="/logobur.png" alt="" width={36} height={36} className="h-9 w-auto shrink-0 rounded-lg bg-white" />
            <div className="min-w-0">
              <p className="truncate font-semibold text-zinc-900 dark:text-zinc-100">Tools Consolación</p>
              <p className="truncate text-xs text-zinc-500">
                {user.nombre ?? user.email} · {ROLE_LABELS[user.role]}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/?vista=familia"
              title="Ver la portada como la ve una familia, sin sesión"
              aria-label="Ver como familia"
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Eye className="h-4 w-4" /> <span className="hidden md:inline">Ver como familia</span>
            </Link>
            <SelectorTema />
            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/gestion/login' });
              }}
            >
              <button
                aria-label="Salir"
                className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <LogOut className="h-4 w-4" /> <span className="hidden md:inline">Salir</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <Escritorio
        saludo={pila ? `${saludo(ahora, ZONA)}, ${pila}` : saludo(ahora, ZONA)}
        fecha={fecha}
        cifras={cifras}
        avisos={avisos}
        herramientas={herramientas}
      />
    </div>
  );
}
