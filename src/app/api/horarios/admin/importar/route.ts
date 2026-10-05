import { NextResponse } from 'next/server';

import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { getSessionUser } from '@/lib/auth-guards';
import { puedeEditarHorarios } from '@/lib/permissions';
import { prepararImportacion, type Incidencia, type ResultadoBloque } from '@/lib/horarios-import';
import { leerHorarios } from '@/lib/horarios-lectores';
import { getProfesParaCasar, importarBloques, type ReunionEtapa } from '@/lib/horarios-server';
import { etapaDeCursoHorario } from '@/lib/horarios';
import { CONFIGURACION } from '@/lib/configuracion';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BYTES = CONFIGURACION.archivos.maxMB * 1024 * 1024;

/**
 * Sube un .docx/.xlsx de horarios. Con `confirmar=false` (por defecto) SOLO devuelve la
 * vista previa: nada se escribe hasta que quien importa ve qué va a entrar. Es el mismo
 * patrón del sync de Educamos, y aquí importa el doble porque un horario se sobrescribe
 * entero.
 */
export async function POST(req: Request) {
  const guard = await requireModule('horarios');
  if (isGuardResponse(guard)) return guard;
  const user = await getSessionUser();
  if (!puedeEditarHorarios(user?.role ?? null)) {
    return NextResponse.json({ error: 'No tienes permiso para importar horarios' }, { status: 403 });
  }

  const form = await req.formData();
  const fichero = form.get('fichero');
  if (!(fichero instanceof File)) return NextResponse.json({ error: 'Falta el fichero' }, { status: 400 });
  if (fichero.size > MAX_BYTES) return NextResponse.json({ error: `El fichero pasa de ${CONFIGURACION.archivos.maxMB} MB` }, { status: 400 });
  if (!/\.(docx|xlsx)$/i.test(fichero.name)) {
    return NextResponse.json({ error: 'Solo .docx o .xlsx de Educamos' }, { status: 400 });
  }

  let bloques;
  try {
    bloques = leerHorarios(new Uint8Array(await fichero.arrayBuffer()), fichero.name);
  } catch (e) {
    // El mensaje sí, la traza no: puede llevar trozos del fichero.
    return NextResponse.json({ error: `No se ha podido leer el fichero: ${(e as Error).message}` }, { status: 400 });
  }

  // Todo el criterio (clases, hojas de profe y el cruce entre ellas) vive en
  // `prepararImportacion`, sin BBDD. De aquí solo sale el claustro, para casar por nombre las
  // hojas de quien no aparece en ninguna leyenda del fichero.
  const prep = prepararImportacion(bloques, await getProfesParaCasar());
  const utiles = prep.clases;

  const previa = {
    bloquesTotales: bloques.length,
    deProfesor: bloques.filter((b) => b.tipo === 'profe').length,
    clases: utiles.map((r) => ({
      codigo: r.clase!.codigo,
      nombre: r.clase!.nombre,
      etapa: etapaDeCursoHorario(r.clase!.curso),
      sesiones: r.sesiones.length,
      tramos: r.tramos.length,
      conAula: r.sesiones.filter((s) => s.aulaCodigo).length,
      apoyos: r.sesiones.filter((s) => s.actividadCodigo !== 'clase').length,
      incidencias: r.incidencias.length,
    })),
    incidencias: agrupar([...utiles.flatMap((r) => r.incidencias), ...prep.incidencias]),
    notas: [...new Set(utiles.flatMap((r) => r.notas))],
    ajustes: prep.ajustes,
    hojasProfe: prep.hojasProfe,
    horasProfe: resumirHorasProfe(prep.horasProfe),
    // La reunión de etapa no suele venir en el fichero: se propone la de la configuración del
    // centro para cada etapa que trae, y quien importa decide (marcada por defecto).
    reunionesEtapa: [...new Set(utiles.map((r) => etapaDeCursoHorario(r.clase!.curso)).filter((e): e is NonNullable<typeof e> => !!e))]
      .filter((e) => CONFIGURACION.horarios.reunionesEtapa[e])
      .map((etapa) => ({ etapa, ...CONFIGURACION.horarios.reunionesEtapa[etapa] })),
    // El fichero no dice si es el horario ordinario o el corto de septiembre/junio, pero
    // se nota: el corto no tiene comedor y baja de 6 franjas. Se sugiere, decide la persona.
    periodoSugerido: sugerirPeriodo(utiles),
  };

  if (form.get('confirmar') !== 'true') return NextResponse.json({ previa });

  try {
    const resumen = await importarBloques(utiles, {
      academicYear: String(form.get('academicYear') ?? ''),
      periodoNombre: String(form.get('periodo') ?? 'Ordinario'),
      fechaInicio: String(form.get('desde') ?? ''),
      fechaFin: String(form.get('hasta') ?? ''),
      prioridad: Number(form.get('prioridad') ?? 0),
      esOrdinario: form.get('ordinario') === 'true',
      reunionesEtapa: leerReuniones(form.get('reunionesEtapa')),
    }, prep.horasProfe);
    return NextResponse.json({ previa, resumen });
  } catch (e) {
    // El mensaje sí, la traza no: el fichero lleva nombres del profesorado.
    return NextResponse.json({ error: `La importación ha fallado: ${(e as Error).message}` }, { status: 500 });
  }
}

/** Las incidencias iguales juntas, con lo que se le enseña a quien importa. */
function agrupar(incidencias: Incidencia[]): { tipo: Incidencia['tipo']; clave: string; detalle: string; veces: number }[] {
  const m = new Map<string, { tipo: Incidencia['tipo']; clave: string; detalle: string; veces: number }>();
  for (const i of incidencias) {
    const clave = `${i.tipo} · ${i.crudo ?? i.detalle}`;
    const previa = m.get(clave);
    if (previa) previa.veces++;
    else m.set(clave, { tipo: i.tipo, clave, detalle: i.detalle, veces: 1 });
  }
  return [...m.values()].sort((a, b) => b.veces - a.veces);
}

/** Cuántas horas de profe entran, por tipo y por etiqueta ('Reunión · TIC: 7'). */
function resumirHorasProfe(horas: ReturnType<typeof prepararImportacion>['horasProfe']): { que: string; horas: number; profes: number }[] {
  const m = new Map<string, { horas: number; profes: Set<string> }>();
  for (const h of horas) {
    const que = h.etiqueta ? `${NOMBRES[h.actividadCodigo] ?? h.actividadCodigo} · ${h.etiqueta}` : (NOMBRES[h.actividadCodigo] ?? h.actividadCodigo);
    const fila = m.get(que) ?? { horas: 0, profes: new Set<string>() };
    fila.horas += h.sesiones.length * h.profeCodigos.length;
    h.profeCodigos.forEach((p) => fila.profes.add(p));
    m.set(que, fila);
  }
  return [...m.entries()].map(([que, f]) => ({ que, horas: f.horas, profes: f.profes.size })).sort((a, b) => b.horas - a.horas);
}

const NOMBRES: Record<string, string> = {
  atencion_padres: 'Atención a familias', atencion_alumnos: 'Atención a alumnado', departamento: 'Departamento',
  reunion: 'Reunión', coordinacion: 'Coordinación', oratorio: 'Oratorio', guardia: 'Guardia', tutoria: 'Tutoría',
  libre_disposicion: 'Libre disposición', otros: 'Otros', apoyo_pt: 'Apoyo PT', apoyo_al: 'Audición y lenguaje',
};

/**
 * Ordinario o jornada corta, mirando la forma del horario: el corto no tiene comedor y baja
 * de seis franjas. **Septiembre y junio no se distinguen entre sí** —son el mismo horario en
 * dos momentos del curso— así que eso lo elige la persona; el fichero no lo dice.
 */
function sugerirPeriodo(bloques: ResultadoBloque[]): 'Ordinario' | 'Jornada corta' {
  const conComedor = bloques.some((b) => b.tramos.some((t) => t.tipo === 'comedor'));
  const franjas = Math.max(0, ...bloques.map((b) => b.tramos.filter((t) => t.tipo === 'sesion').length));
  return conComedor || franjas >= 6 ? 'Ordinario' : 'Jornada corta';
}

/** Las reuniones de etapa que ha dejado marcadas quien importa (JSON del formulario), validadas. */
function leerReuniones(valor: FormDataEntryValue | null): ReunionEtapa[] {
  if (typeof valor !== 'string' || !valor) return [];
  try {
    const lista = JSON.parse(valor) as unknown;
    if (!Array.isArray(lista)) return [];
    const hora = /^\d{2}:\d{2}$/;
    return lista
      .filter((r): r is ReunionEtapa =>
        !!r && typeof r.etapa === 'string' && Array.isArray(r.dias) && r.dias.every((d: unknown) => Number.isInteger(d) && (d as number) >= 1 && (d as number) <= 5) &&
        hora.test(r.horaInicio) && hora.test(r.horaFin) && r.horaInicio < r.horaFin && typeof r.etiqueta === 'string')
      .map((r) => ({ etapa: r.etapa, dias: r.dias, horaInicio: r.horaInicio, horaFin: r.horaFin, etiqueta: r.etiqueta.slice(0, 80) || 'Reunión de etapa' }));
  } catch {
    return [];
  }
}
