import { Suspense } from 'react';
import { CalendarDays } from 'lucide-react';

import { getSessionUser } from '@/lib/auth-guards';
import { canAccess, horariosSoloSuTutoria } from '@/lib/permissions';
import { clasesDeTutor } from '@/lib/puntualidad-server';
import {
  getCeldas,
  getFranjasDeProfe,
  getOpcionesNavegador,
  getPeriodos,
  getTramosNoLectivos,
  type VistaHorario,
} from '@/lib/horarios-server';
import { elegirPeriodoVigente } from '@/lib/horarios';
import { Vacio } from '@/components/ui/vacio';
import { EsqueletoRejilla } from '@/components/horarios/esqueleto';
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

  // El vigente se ELIGE de la lista que ya tenemos: `getPeriodoVigente()` volvía a pedir los
  // periodos a Neon, así que eran dos viajes (~300 ms) para la misma fila.
  const periodos = await getPeriodos();
  const periodo =
    periodos.find((p) => p.id === sp.periodo) ?? elegirPeriodoVigente(periodos, new Date().toISOString().slice(0, 10));

  if (!periodo) {
    return (
      <>
        <h1 className="sr-only">Horarios</h1>
        <Vacio icono={<CalendarDays />} titulo="Todavía no hay ningún horario">
          Se importa del export de Educamos con el botón «Importar» de arriba.
        </Vacio>
      </>
    );
  }

  // Un profe raso solo ve el horario de SU tutoría (David, 2-nov-2026): ni otras clases, ni el
  // horario de otros profes, ni la pestaña de Aula, que es para ver etapas enteras. Se filtra AQUÍ,
  // en el servidor, y no solo en la pantalla: lo que no se manda no se puede curiosear.
  const soloTutoria = horariosSoloSuTutoria(user);
  const [todas, propias] = await Promise.all([
    getOpcionesNavegador(periodo.id),
    soloTutoria && user ? clasesDeTutor(user.email) : Promise.resolve([]),
  ]);
  const suyas = new Set(propias.map((c) => `${c.curso}|${c.letra ?? ''}`));
  const opciones = soloTutoria
    ? { clases: todas.clases.filter((c) => suyas.has(`${c.curso}|${c.letra ?? ''}`)), profes: [], espacios: [] }
    : todas;
  let vista = (sp.vista === 'profe' || sp.vista === 'aula' ? sp.vista : 'clase') as VistaHorario;
  if (soloTutoria || (vista === 'profe' && !puedeVerProfes)) vista = 'clase';

  if (soloTutoria && opciones.clases.length === 0) {
    return (
      <>
        <h1 className="sr-only">Horarios</h1>
        <Vacio icono={<CalendarDays />} titulo="Aquí ves el horario de tu tutoría">
          {propias.length === 0
            ? 'No tienes ninguna tutoría asignada este curso. Tu horario propio está en «Mi horario».'
            : 'Tu tutoría todavía no tiene horario importado. Tu horario propio está en «Mi horario».'}
        </Vacio>
      </>
    );
  }

  // Sin elección, se abre por lo primero que haya: siempre se ve algo al entrar.
  const porDefecto =
    vista === 'clase'
      ? (opciones.clases[0] ? `${opciones.clases[0].curso}|${opciones.clases[0].letra ?? ''}` : '')
      : vista === 'profe'
        ? (opciones.profes[0]?.id ?? '')
        : (opciones.espacios[0]?.id ?? '');
  // Quien solo ve su tutoría no puede pedir otra por la URL: si la clave no es suya, se abre la suya.
  const clave = soloTutoria
    ? (opciones.clases.some((c) => `${c.curso}|${c.letra ?? ''}` === sp.clave) ? sp.clave! : porDefecto)
    : sp.clave || porDefecto;

  const titulo =
    vista === 'clase'
      ? (opciones.clases.find((c) => `${c.curso}|${c.letra ?? ''}` === clave)?.etiqueta ?? 'esta clase')
      : vista === 'profe'
        ? (opciones.profes.find((p) => p.id === clave)?.nombre ?? 'este profesor')
        : (opciones.espacios.find((e) => e.id === clave)?.nombre ?? 'este aula');

  return (
    <div className="space-y-4">
      <h1 className="sr-only">Horarios</h1>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{titulo}</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {periodo.nombre} · curso {periodo.academicYear}
          </p>
        </div>
        {periodos.length > 1 && <SelectorPeriodo periodos={periodos} actual={periodo.id} />}
      </div>

      {/* Con una sola tutoría no hay nada que elegir: se enseña su horario y ya. */}
      {!(soloTutoria && opciones.clases.length <= 1) && (
        <Selector opciones={opciones} vista={vista} clave={clave} puedeVerProfes={puedeVerProfes} soloClase={soloTutoria} />
      )}
      {/* El horario va en su propio Suspense: el selector se pinta al momento y la
          cuadrícula, que es la consulta lenta, enseña su esqueleto mientras llega. La `key`
          es lo que hace que el esqueleto vuelva a salir al cambiar de clase (si no, React
          reutiliza el contenido anterior y parece que no ha pasado nada al tocar). */}
      <Suspense key={`${periodo.id}:${vista}:${clave}`} fallback={<EsqueletoHorario />}>
        <Horario periodoId={periodo.id} vista={vista} clave={clave} titulo={titulo} />
      </Suspense>
    </div>
  );
}

async function Horario({
  periodoId,
  vista,
  clave,
  titulo,
}: {
  periodoId: string;
  vista: VistaHorario;
  clave: string;
  titulo: string;
}) {
  // En la vista de una clase se pintan también sus recreos y comedores aunque estén vacíos:
  // sin ellos la mañana parece seguida y no se entiende dónde está el patio. Las dos
  // consultas son independientes, así que van a la vez: encadenadas costaban ~650 ms.
  const [curso, letra] = clave.split('|');
  // En la de un profe, las franjas de su rejilla: sin ellas se pierden el recreo y las horas
  // en las que no da clase, porque ahí solo hay celdas donde hay sesiones.
  const [celdas, noLectivos, franjas] = await Promise.all([
    clave ? getCeldas(periodoId, vista, clave) : Promise.resolve([]),
    vista === 'clase' && clave
      ? getTramosNoLectivos(periodoId, { curso, letra: letra || null })
      : Promise.resolve([]),
    vista === 'profe' && clave ? getFranjasDeProfe(periodoId, clave) : Promise.resolve([]),
  ]);

  return <Navegador celdas={[...celdas, ...noLectivos]} franjas={franjas} titulo={titulo} />;
}

function EsqueletoHorario() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Cargando el horario</span>
      <EsqueletoRejilla />
    </div>
  );
}
