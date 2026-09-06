import { CalendarDays } from 'lucide-react';

import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { etapaDeCursoHorario } from '@/lib/horarios';
import {
  getCeldas,
  getOpcionesNavegador,
  getPeriodos,
  getPeriodoVigente,
  getTramosNoLectivos,
  type VistaHorario,
} from '@/lib/horarios-server';
import { Navegador } from '@/components/horarios/navegador';
import { Selector } from '@/components/horarios/selector';
import { SelectorPeriodo } from '@/components/horarios/selector-periodo';

export const dynamic = 'force-dynamic';

export default async function HorariosPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; clave?: string; periodo?: string }>;
}) {
  const sp = await searchParams;
  const user = await getSessionUser();
  const puedeVerProfes = canAccess(user, 'horarios-profes');

  const periodos = await getPeriodos();
  const vigente = await getPeriodoVigente();
  const periodo = periodos.find((p) => p.id === sp.periodo) ?? vigente;

  if (!periodo) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <CalendarDays className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-600" />
        <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-200">Todavía no hay ningún horario.</p>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Impórtalo desde el botón de arriba.</p>
      </div>
    );
  }

  const opciones = await getOpcionesNavegador(periodo.id);
  let vista = (sp.vista === 'profe' || sp.vista === 'aula' ? sp.vista : 'clase') as VistaHorario;
  if (vista === 'profe' && !puedeVerProfes) vista = 'clase';

  // Sin elección, se abre por lo primero que haya: siempre se ve algo al entrar.
  const porDefecto =
    vista === 'clase'
      ? (opciones.clases[0] ? `${opciones.clases[0].curso}|${opciones.clases[0].letra ?? ''}` : '')
      : vista === 'profe'
        ? (opciones.profes[0]?.id ?? '')
        : (opciones.espacios[0]?.id ?? '');
  const clave = sp.clave || porDefecto;

  const celdas = clave ? await getCeldas(periodo.id, vista, clave) : [];

  // En la vista de una clase se pintan también sus recreos y comedores aunque estén vacíos:
  // sin ellos la mañana parece seguida y no se entiende dónde está el patio.
  if (vista === 'clase' && clave) {
    const etapa = etapaDeCursoHorario(clave.split('|')[0]);
    celdas.push(...(await getTramosNoLectivos(periodo.id, etapa)));
  }

  const titulo =
    vista === 'clase'
      ? (opciones.clases.find((c) => `${c.curso}|${c.letra ?? ''}` === clave)?.etiqueta ?? 'esta clase')
      : vista === 'profe'
        ? (opciones.profes.find((p) => p.id === clave)?.nombre ?? 'este profesor')
        : (opciones.espacios.find((e) => e.id === clave)?.nombre ?? 'este aula');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{titulo}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {periodo.nombre} · curso {periodo.academicYear}
          </p>
        </div>
        {periodos.length > 1 && <SelectorPeriodo periodos={periodos} actual={periodo.id} />}
      </div>

      <Selector opciones={opciones} vista={vista} clave={clave} puedeVerProfes={puedeVerProfes} />
      <Navegador celdas={celdas} titulo={titulo} />
    </div>
  );
}
