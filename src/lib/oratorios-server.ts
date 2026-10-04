// Capa de servidor de Oratorios y Godly Play. Ficha: docs/26-oratorios.md
//
// La pantalla recibe TODO de una vez (tipos, horario, sesiones del curso, disponibilidad…)
// y calcula los candidatos en el cliente con `oratorios.ts`: así pasar de semana no cuesta
// un viaje a Neon. Aquí solo se lee en una tanda y se escribe.
import { and, asc, eq, inArray, isNotNull, lte, ne, or, sql } from 'drizzle-orm';

import { db } from '@/db';
import {
  authUsers,
  eduStudents,
  eduTeachers,
  horActividades,
  horAsignaciones,
  horAsignacionGrupos,
  horAsignacionProfes,
  horFestivos,
  horMaterias,
  horPeriodos,
  horRejillaAmbitos,
  horRejillas,
  horSesiones,
  horTramos,
  oraAjustes,
  oraCatalogo,
  oraDisponibilidad,
  oraSesiones,
  oraTipos,
  salTrips,
  type EntradaHistorialOra,
  type OraCatalogo,
  type OraSesion,
  type OraTipo,
} from '@/db/schema';
import { academicYearActual } from '@/lib/constants';
import { compararClases, etapaDeCurso } from '@/lib/cursos';
import { enviar } from '@/lib/email';
import { nombreProfe as nombreProfeHorario } from '@/lib/horarios';
import {
  avisoAlConfirmar,
  avisoTrasCambio,
  claveClase,
  etiquetaClase,
  hoyEnEspana,
  nivelDe,
  profesDe,
  siguienteNumero,
  trimestresPorDefecto,
  type AccionLote,
  type AccionSesion,
  type Clase,
  type Disponibilidad,
  type EntradaSesionCatalogo,
  type EntradaTipo,
  type Frecuencia,
  type HuecoHorario,
  type Nivel,
  type NuevaSesion,
  type Periodo,
  type ProfeAfectado,
  type RangoFechas,
  type SalidaDia,
  type SesionCatalogo,
  type SesionOra,
  type TipoCorreo,
  type TipoMomento,
  type TramoRejilla,
  type Trimestre,
  type UsoSesion,
} from '@/lib/oratorios';
import { correoProfe } from '@/lib/oratorios-email';
import { borrarEvento, guardarEvento } from '@/lib/oratorios-google';
import { nombreProfeBreve, pilaProfe } from '@/lib/profes';

/** Un error por algo que ha enviado la persona (va a la pantalla tal cual, con un 400). */
export class ErrorDeEntrada extends Error {}

// ─── Mapeos ──────────────────────────────────────────────────────────────────

function iso(d: Date | string | null): string | null {
  if (d === null) return null;
  return typeof d === 'string' ? d : d.toISOString();
}

export function aSesion(f: OraSesion): SesionOra {
  return {
    id: f.id,
    tipoId: f.tipoId,
    academicYear: f.academicYear,
    curso: f.curso,
    letra: f.letra,
    numero: f.numero,
    catalogoId: f.catalogoId,
    fecha: f.fecha,
    horaInicio: f.horaInicio,
    horaFin: f.horaFin,
    responsableEmail: f.responsableEmail,
    responsableNombre: f.responsableNombre,
    profeId: f.profeId,
    profeNombre: f.profeNombre,
    materia: f.materia,
    profes: f.profes ?? [],
    estado: f.estado as SesionOra['estado'],
    avisoEstado: f.avisoEstado as SesionOra['avisoEstado'],
    avisoTipo: f.avisoTipo as TipoCorreo,
    avisoProgramadoPara: f.avisoProgramadoPara,
    avisoEnviadoAt: iso(f.avisoEnviadoAt),
    avisoManual: f.avisoManual,
    avisoError: f.avisoError,
    googleEventId: f.googleEventId,
    calendarioError: f.calendarioError,
    notas: f.notas,
    historial: f.historial ?? [],
    createdAt: iso(f.createdAt) ?? '',
    updatedAt: iso(f.updatedAt) ?? '',
  };
}

function aTipo(t: OraTipo): TipoMomento {
  return {
    id: t.id,
    codigo: t.codigo,
    nombre: t.nombre,
    nombreCorreo: t.nombreCorreo,
    emoji: t.emoji,
    calendarioId: t.calendarioId,
    frecuencia: t.frecuencia as Frecuencia,
    cantidad: t.cantidad,
    etapas: t.etapas ?? [],
    clases: t.clases ?? null,
    textoCorreo: t.textoCorreo,
    avisoDias: t.avisoDias,
    sinRepetir: t.sinRepetir,
    orden: t.orden,
    activo: t.activo,
  };
}

function aCatalogo(f: OraCatalogo): SesionCatalogo {
  return {
    id: f.id,
    tipoId: f.tipoId,
    nombre: f.nombre,
    enlace: f.enlace,
    academicYear: f.academicYear,
    cursos: f.cursos && f.cursos.length > 0 ? f.cursos : null,
    orden: f.orden,
    activo: f.activo,
  };
}

// ─── Lecturas ────────────────────────────────────────────────────────────────

export async function getTipos(): Promise<TipoMomento[]> {
  const filas = await db.select().from(oraTipos).orderBy(asc(oraTipos.orden), asc(oraTipos.nombre));
  return filas.map(aTipo);
}

/** El abanico de sesiones de todos los tipos (lo que se hace en cada momento). */
export async function getCatalogo(): Promise<SesionCatalogo[]> {
  const filas = await db.select().from(oraCatalogo).orderBy(asc(oraCatalogo.orden), asc(oraCatalogo.createdAt));
  return filas.map(aCatalogo);
}

/** Lo que se hizo en OTROS cursos con la app (momentos confirmados con sesión del abanico). */
export async function getUsosPrevios(academicYear = academicYearActual()): Promise<UsoSesion[]> {
  const filas = await db
    .select({ catalogoId: oraSesiones.catalogoId, academicYear: oraSesiones.academicYear, curso: oraSesiones.curso, letra: oraSesiones.letra })
    .from(oraSesiones)
    .where(and(isNotNull(oraSesiones.catalogoId), ne(oraSesiones.academicYear, academicYear), eq(oraSesiones.estado, 'confirmado')));
  return filas.map((f) => ({ catalogoId: f.catalogoId!, academicYear: f.academicYear, curso: nivelDe(f.curso), letra: f.letra }));
}

export interface AjustesOra {
  academicYear: string;
  trimestres: Trimestre[];
  accesoComun: boolean;
  guardados: boolean; // false = trimestres por defecto, sin tocar
}

function ajustesDeFila(
  academicYear: string,
  fila: { trimestres: Trimestre[]; accesoComun: boolean } | undefined,
  inicioCurso: string | null,
): AjustesOra {
  const trimestres = fila && fila.trimestres.length === 3 ? fila.trimestres : trimestresPorDefecto(academicYear, inicioCurso);
  return { academicYear, trimestres, accesoComun: fila?.accesoComun ?? false, guardados: Boolean(fila && fila.trimestres.length === 3) };
}

export async function getAjustes(academicYear = academicYearActual()): Promise<AjustesOra> {
  const [[fila], ordinario] = await Promise.all([
    db.select().from(oraAjustes).where(eq(oraAjustes.academicYear, academicYear)).limit(1),
    db
      .select({ inicio: horPeriodos.fechaInicio })
      .from(horPeriodos)
      .where(and(eq(horPeriodos.academicYear, academicYear), eq(horPeriodos.esOrdinario, true), eq(horPeriodos.active, true)))
      .limit(1),
  ]);
  return ajustesDeFila(academicYear, fila, ordinario[0]?.inicio ?? null);
}

export async function getDisponibilidad(email: string): Promise<Disponibilidad[]> {
  const filas = await db
    .select()
    .from(oraDisponibilidad)
    .where(eq(oraDisponibilidad.responsableEmail, email.toLowerCase()));
  return filas.map((f) => ({ dia: f.diaSemana, horaInicio: f.horaInicio, horaFin: f.horaFin, nivel: f.nivel as Nivel }));
}

export interface PersonaOra {
  id: string;
  nombre: string; // 'David Soler'
  pila: string;
  email: string | null;
}

/** El claustro activo (para el selector de responsable, el alta a mano y los correos). */
async function getProfes(): Promise<PersonaOra[]> {
  const filas = await db
    .select({
      id: eduTeachers.id,
      nombre: eduTeachers.nombre,
      apellido1: eduTeachers.apellido1,
      apellido2: eduTeachers.apellido2,
      nombreMostrado: eduTeachers.nombreMostrado,
      email: eduTeachers.email,
    })
    .from(eduTeachers)
    .where(eq(eduTeachers.active, true));
  return filas
    .map((p) => ({ id: p.id, nombre: nombreProfeBreve(p), pila: pilaProfe(p), email: p.email?.toLowerCase() ?? null }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/** Todo el horario de todas las clases, en dos consultas en paralelo (ver 04-convenciones). */
async function getHorario(): Promise<{ periodos: Periodo[]; horario: HuecoHorario[]; tramos: TramoRejilla[] }> {
  const [periodos, filas, profes, tramos] = await Promise.all([
    db
      .select({ id: horPeriodos.id, fechaInicio: horPeriodos.fechaInicio, fechaFin: horPeriodos.fechaFin, prioridad: horPeriodos.prioridad, esOrdinario: horPeriodos.esOrdinario })
      .from(horPeriodos)
      .where(eq(horPeriodos.active, true)),
    db
      .select({
        asignacionId: horAsignaciones.id,
        periodoId: horAsignaciones.periodoId,
        dia: horSesiones.diaSemana,
        horaInicio: horTramos.horaInicio,
        horaFin: horTramos.horaFin,
        materia: horMaterias.nombre,
        etiqueta: horAsignaciones.etiqueta,
        actividad: horActividades.codigo,
        actividadNombre: horActividades.nombre,
        curso: horAsignacionGrupos.curso,
        letra: horAsignacionGrupos.letra,
      })
      .from(horSesiones)
      .innerJoin(horTramos, eq(horTramos.id, horSesiones.tramoId))
      .innerJoin(horAsignaciones, eq(horAsignaciones.id, horSesiones.asignacionId))
      .innerJoin(horActividades, eq(horActividades.id, horAsignaciones.actividadId))
      .innerJoin(horPeriodos, eq(horPeriodos.id, horAsignaciones.periodoId))
      .leftJoin(horMaterias, eq(horMaterias.id, horAsignaciones.materiaId))
      .leftJoin(horAsignacionGrupos, eq(horAsignacionGrupos.asignacionId, horAsignaciones.id))
      .where(and(eq(horAsignaciones.active, true), eq(horPeriodos.active, true))),
    db
      .select({
        asignacionId: horAsignacionProfes.asignacionId,
        id: eduTeachers.id,
        nombre: eduTeachers.nombre,
        apellido1: eduTeachers.apellido1,
        nombreMostrado: eduTeachers.nombreMostrado,
        rol: horAsignacionProfes.rol,
        principal: horAsignacionProfes.principal,
      })
      .from(horAsignacionProfes)
      .innerJoin(eduTeachers, eq(eduTeachers.id, horAsignacionProfes.eduTeacherId))
      .where(inArray(horAsignacionProfes.asignacionId, db.select({ id: horAsignaciones.id }).from(horAsignaciones).where(eq(horAsignaciones.active, true)))),
    db
      .select({
        dia: horTramos.diaSemana,
        horaInicio: horTramos.horaInicio,
        horaFin: horTramos.horaFin,
        tipo: horTramos.tipo,
        etapa: horRejillaAmbitos.etapa,
        curso: horRejillaAmbitos.curso,
      })
      .from(horTramos)
      .innerJoin(horRejillas, eq(horRejillas.id, horTramos.rejillaId))
      .innerJoin(horRejillaAmbitos, eq(horRejillaAmbitos.rejillaId, horRejillas.id))
      .innerJoin(horPeriodos, eq(horPeriodos.id, horRejillas.periodoId))
      .where(eq(horPeriodos.active, true)),
  ]);

  const profesPor = new Map<string, HuecoHorario['profes']>();
  for (const p of profes) {
    const lista = profesPor.get(p.asignacionId) ?? [];
    lista.push({ id: p.id, nombre: nombreProfeHorario(p.nombre, p.apellido1, p.nombreMostrado), titular: p.rol === 'titular' || p.principal });
    profesPor.set(p.asignacionId, lista);
  }

  const horario: HuecoHorario[] = filas.map((f) => ({
    periodoId: f.periodoId,
    curso: f.curso,
    letra: f.letra,
    dia: f.dia,
    horaInicio: f.horaInicio,
    horaFin: f.horaFin,
    materia: f.materia ?? f.etiqueta ?? f.actividadNombre,
    actividad: f.actividad,
    profes: profesPor.get(f.asignacionId) ?? [],
  }));

  const vistos = new Set<string>();
  const tramosOut: TramoRejilla[] = [];
  for (const t of tramos) {
    const etapa = t.etapa ?? etapaDeCurso(t.curso) ?? '';
    const k = `${etapa}|${t.dia}|${t.horaInicio}|${t.horaFin}|${t.tipo}`;
    if (vistos.has(k)) continue;
    vistos.add(k);
    tramosOut.push({ etapa, dia: t.dia, horaInicio: t.horaInicio, horaFin: t.horaFin, tipo: t.tipo });
  }
  return { periodos, horario, tramos: tramosOut };
}

async function getClasesAlumnado(): Promise<Clase[]> {
  const filas = await db
    .selectDistinct({ curso: eduStudents.curso, letra: eduStudents.letra })
    .from(eduStudents)
    .where(and(eq(eduStudents.active, true), isNotNull(eduStudents.curso)));
  return filas.filter((f): f is Clase => Boolean(f.curso)).sort(compararClases);
}

function rangoCurso(academicYear: string): RangoFechas {
  const y = Number(academicYear.slice(0, 4));
  return { inicio: `${y}-08-01`, fin: `${y + 1}-07-31` };
}

async function getFestivos(academicYear: string): Promise<RangoFechas[]> {
  const filas = await db
    .select({ inicio: horFestivos.fechaInicio, fin: horFestivos.fechaFin })
    .from(horFestivos)
    .where(eq(horFestivos.academicYear, academicYear));
  return filas;
}

async function getSalidas(academicYear: string): Promise<SalidaDia[]> {
  const r = rangoCurso(academicYear);
  const filas = await db
    .select({ fecha: salTrips.fecha, nombre: salTrips.nombre, clases: salTrips.clases })
    .from(salTrips)
    .where(and(isNotNull(salTrips.fecha), sql`${salTrips.fecha} between ${r.inicio} and ${r.fin}`));
  return filas
    .filter((f): f is typeof f & { fecha: string } => Boolean(f.fecha))
    .map((f) => ({ fecha: f.fecha, nombre: f.nombre, clases: (f.clases ?? []).map((c) => claveClase(c)) }));
}

export async function getSesiones(academicYear = academicYearActual()): Promise<SesionOra[]> {
  const filas = await db
    .select()
    .from(oraSesiones)
    .where(eq(oraSesiones.academicYear, academicYear))
    .orderBy(asc(oraSesiones.fecha), asc(oraSesiones.horaInicio));
  return filas.map(aSesion);
}

export interface DatosPanel {
  academicYear: string;
  hoy: string;
  yo: { email: string; nombre: string; profeId: string | null };
  tipos: TipoMomento[];
  ajustes: AjustesOra;
  sesiones: SesionOra[];
  periodos: Periodo[];
  horario: HuecoHorario[];
  tramos: TramoRejilla[];
  clases: Clase[];
  profes: PersonaOra[];
  festivos: RangoFechas[];
  salidas: SalidaDia[];
  disponibilidad: Record<string, Disponibilidad[]>; // por correo de responsable
  catalogo: SesionCatalogo[];
  usosPrevios: UsoSesion[];
}

/** Todo lo que necesita el panel de quien lo lleva, en una tanda. */
export async function getDatosPanel(user: { email: string; nombre: string | null }, academicYear = academicYearActual()): Promise<DatosPanel> {
  const [tipos, ajustes, sesiones, horario, clases, profes, festivos, salidas, disp, catalogo, usosPrevios] = await Promise.all([
    getTipos(),
    getAjustes(academicYear),
    getSesiones(academicYear),
    getHorario(),
    getClasesAlumnado(),
    getProfes(),
    getFestivos(academicYear),
    getSalidas(academicYear),
    db.select().from(oraDisponibilidad),
    getCatalogo(),
    getUsosPrevios(academicYear),
  ]);
  const disponibilidad: Record<string, Disponibilidad[]> = {};
  for (const f of disp) {
    (disponibilidad[f.responsableEmail] ??= []).push({ dia: f.diaSemana, horaInicio: f.horaInicio, horaFin: f.horaFin, nivel: f.nivel as Nivel });
  }
  const email = user.email.toLowerCase();
  const yoProfe = profes.find((p) => p.email === email) ?? null;
  return {
    academicYear,
    hoy: hoyEnEspana(),
    yo: { email, nombre: yoProfe?.nombre ?? user.nombre ?? email, profeId: yoProfe?.id ?? null },
    tipos,
    ajustes,
    sesiones,
    ...horario,
    clases,
    profes,
    festivos,
    salidas,
    disponibilidad,
    catalogo,
    usosPrevios,
  };
}

export interface DatosMios {
  hoy: string;
  tipos: TipoMomento[];
  sesiones: SesionOra[];
}

/**
 * Lo que ve el claustro con `oratorios-ver`: SOLO las sesiones confirmadas (o anuladas) que
 * le quitan una hora a esa persona, o que lleva ella. Los borradores no: nadie se ha enterado.
 */
export async function getMisSesiones(email: string, academicYear = academicYearActual()): Promise<DatosMios> {
  const correo = email.toLowerCase();
  const [tipos, [profe]] = await Promise.all([
    getTipos(),
    db.select({ id: eduTeachers.id }).from(eduTeachers).where(eq(sql`lower(${eduTeachers.email})`, correo)).limit(1),
  ]);
  const mias = profe
    ? or(eq(oraSesiones.responsableEmail, correo), sql`${oraSesiones.profes} @> ${JSON.stringify([{ id: profe.id }])}::jsonb`)
    : eq(oraSesiones.responsableEmail, correo);
  const filas = await db
    .select()
    .from(oraSesiones)
    .where(and(eq(oraSesiones.academicYear, academicYear), inArray(oraSesiones.estado, ['confirmado', 'anulado']), mias))
    .orderBy(asc(oraSesiones.fecha), asc(oraSesiones.horaInicio));
  // Una anulada solo le importa a quien llegó a enterarse (se confirmó antes de anularla).
  const sesiones = filas.map(aSesion).filter((s) => s.estado !== 'anulado' || s.historial.some((h) => h.que === 'confirmada'));
  return { hoy: hoyEnEspana(), tipos, sesiones };
}

export async function accesoComunActivo(academicYear = academicYearActual()): Promise<boolean> {
  const [fila] = await db.select({ a: oraAjustes.accesoComun }).from(oraAjustes).where(eq(oraAjustes.academicYear, academicYear)).limit(1);
  return fila?.a ?? false;
}

// ─── Escrituras: ajustes, tipos, disponibilidad ────────────────────────────────

export async function guardarAjustes(
  entrada: { academicYear: string; trimestres?: Trimestre[]; accesoComun?: boolean },
  por: string,
): Promise<AjustesOra> {
  const actual = await getAjustes(entrada.academicYear);
  const valores = {
    trimestres: entrada.trimestres ?? actual.trimestres,
    accesoComun: entrada.accesoComun ?? actual.accesoComun,
    updatedAt: new Date(),
    updatedBy: por,
  };
  await db
    .insert(oraAjustes)
    .values({ academicYear: entrada.academicYear, ...valores })
    .onConflictDoUpdate({ target: oraAjustes.academicYear, set: valores });
  return getAjustes(entrada.academicYear);
}

export async function guardarTipo(id: string | null, e: EntradaTipo): Promise<TipoMomento> {
  const valores = {
    codigo: e.codigo,
    nombre: e.nombre,
    nombreCorreo: e.nombreCorreo,
    emoji: e.emoji,
    calendarioId: e.calendarioId?.trim() || null,
    frecuencia: e.frecuencia,
    cantidad: e.cantidad,
    etapas: e.etapas,
    clases: e.clases && e.clases.length > 0 ? e.clases : null,
    textoCorreo: e.textoCorreo?.trim() || null,
    avisoDias: e.avisoDias,
    sinRepetir: e.sinRepetir,
    activo: e.activo,
    updatedAt: new Date(),
  };
  if (id) {
    const [fila] = await db.update(oraTipos).set(valores).where(eq(oraTipos.id, id)).returning();
    if (!fila) throw new Error('No existe ese tipo');
    return aTipo(fila);
  }
  const [{ n }] = await db.select({ n: sql<number>`coalesce(max(${oraTipos.orden}), 0) + 1` }).from(oraTipos);
  const [fila] = await db.insert(oraTipos).values({ ...valores, orden: Number(n) }).returning();
  return aTipo(fila);
}

export async function guardarDisponibilidad(email: string, huecos: Disponibilidad[]): Promise<Disponibilidad[]> {
  const correo = email.toLowerCase();
  // Foto entera: se borra lo de esa persona y se escribe lo que hay en pantalla.
  await db.delete(oraDisponibilidad).where(eq(oraDisponibilidad.responsableEmail, correo));
  const unicos = new Map<string, Disponibilidad>();
  for (const h of huecos) unicos.set(`${h.dia}|${h.horaInicio}`, h);
  if (unicos.size > 0) {
    await db.insert(oraDisponibilidad).values(
      [...unicos.values()].map((h) => ({ responsableEmail: correo, diaSemana: h.dia, horaInicio: h.horaInicio, horaFin: h.horaFin, nivel: h.nivel })),
    );
  }
  return getDisponibilidad(correo);
}

// ─── Escrituras: el abanico de sesiones ──────────────────────────────────────

export async function guardarSesionCatalogo(id: string | null, e: EntradaSesionCatalogo, por: string): Promise<SesionCatalogo> {
  const valores = {
    nombre: e.nombre.trim(),
    enlace: e.enlace?.trim() || null,
    academicYear: e.academicYear,
    cursos: e.cursos && e.cursos.length > 0 ? e.cursos : null,
    activo: e.activo,
    updatedAt: new Date(),
  };
  if (id) {
    // El tipo no se cambia: lo que ya se ha planificado con ella es de ese tipo.
    const [fila] = await db.update(oraCatalogo).set(valores).where(eq(oraCatalogo.id, id)).returning();
    if (!fila) throw new ErrorDeEntrada('Esa sesión ya no existe');
    return aCatalogo(fila);
  }
  const [{ n }] = await db
    .select({ n: sql<number>`coalesce(max(${oraCatalogo.orden}), 0) + 1` })
    .from(oraCatalogo)
    .where(eq(oraCatalogo.tipoId, e.tipoId));
  const [fila] = await db.insert(oraCatalogo).values({ ...valores, tipoId: e.tipoId, orden: Number(n), createdBy: por }).returning();
  return aCatalogo(fila);
}

/** Solo se borra una sesión que nadie ha elegido; si no, se archiva (así no se pierde lo que se vio). */
export async function borrarSesionCatalogo(id: string): Promise<void> {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(oraSesiones).where(eq(oraSesiones.catalogoId, id));
  if (n > 0) throw new ErrorDeEntrada(`Ya está elegida en ${n} ${n === 1 ? 'momento' : 'momentos'}: archívala en vez de borrarla`);
  await db.delete(oraCatalogo).where(eq(oraCatalogo.id, id));
}

// ─── Escrituras: sesiones ────────────────────────────────────────────────────

interface Quien {
  email: string;
  nombre: string | null;
}

function entrada(por: Quien, que: string, extra: Partial<EntradaHistorialOra> = {}): EntradaHistorialOra {
  return { at: new Date().toISOString(), por: por.nombre ?? por.email, que, ...extra };
}

async function nombreDe(email: string): Promise<string> {
  const correo = email.toLowerCase();
  const [[profe], [usuario]] = await Promise.all([
    db
      .select({ nombre: eduTeachers.nombre, apellido1: eduTeachers.apellido1, apellido2: eduTeachers.apellido2, nombreMostrado: eduTeachers.nombreMostrado })
      .from(eduTeachers)
      .where(eq(sql`lower(${eduTeachers.email})`, correo))
      .limit(1),
    db.select({ nombre: authUsers.nombre }).from(authUsers).where(eq(authUsers.email, correo)).limit(1),
  ]);
  return profe ? nombreProfeBreve(profe) : (usuario?.nombre ?? correo);
}

function principal(profes: readonly ProfeAfectado[]) {
  return { profeId: profes[0]?.id ?? null, profeNombre: profes[0]?.nombre ?? null, materia: profes[0]?.materia ?? null };
}

/** Borradores nuevos, con su número de sesión («Sesión 2») calculado aquí, no en el cliente. */
/** El id de profe de quien lleva la sesión: no se le cuenta como «molestado» en su propia hora. */
async function profeIdDe(email: string): Promise<string | null> {
  const [fila] = await db.select({ id: eduTeachers.id }).from(eduTeachers).where(eq(sql`lower(${eduTeachers.email})`, email.toLowerCase())).limit(1);
  return fila?.id ?? null;
}

function sinResponsable(profes: readonly ProfeAfectado[], responsableId: string | null): ProfeAfectado[] {
  return responsableId ? profes.filter((p) => p.id !== responsableId) : [...profes];
}

export async function crearSesiones(entradas: NuevaSesion[], por: Quien, academicYear = academicYearActual()): Promise<SesionOra[]> {
  const catalogoIds = [...new Set(entradas.map((e) => e.catalogoId).filter((x): x is string => Boolean(x)))];
  const [existentes, delCatalogo] = await Promise.all([
    getSesiones(academicYear),
    catalogoIds.length
      ? db.select({ id: oraCatalogo.id, tipoId: oraCatalogo.tipoId }).from(oraCatalogo).where(inArray(oraCatalogo.id, catalogoIds))
      : Promise.resolve([]),
  ]);
  const tipoDeCatalogo = new Map(delCatalogo.map((c) => [c.id, c.tipoId]));
  for (const e of entradas) {
    if (e.catalogoId && tipoDeCatalogo.get(e.catalogoId) !== e.tipoId) throw new ErrorDeEntrada('Esa sesión no es de este tipo');
  }
  const nombres = new Map<string, string>();
  const ids = new Map<string, string | null>();
  for (const e of new Set(entradas.map((x) => x.responsableEmail.toLowerCase()))) {
    const [nombre, id] = await Promise.all([nombreDe(e), profeIdDe(e)]);
    nombres.set(e, nombre);
    ids.set(e, id);
  }
  const trabajo: Pick<SesionOra, 'tipoId' | 'curso' | 'letra' | 'numero' | 'estado'>[] = [...existentes];
  const valores = entradas.map((e) => {
    const numero = siguienteNumero(trabajo, e.tipoId, e);
    trabajo.push({ tipoId: e.tipoId, curso: e.curso, letra: e.letra, numero, estado: 'borrador' });
    const email = e.responsableEmail.toLowerCase();
    // Si quien lo lleva da clase a ese grupo a esa hora, se lo lleva de su propia hora: no hay
    // que invitarle ni avisarle a él.
    const profes = sinResponsable(e.profes, ids.get(email) ?? null);
    return {
      tipoId: e.tipoId,
      academicYear,
      curso: e.curso,
      letra: e.letra,
      numero,
      catalogoId: e.catalogoId ?? null,
      fecha: e.fecha,
      horaInicio: e.horaInicio,
      horaFin: e.horaFin,
      responsableEmail: email,
      responsableNombre: nombres.get(email) ?? email,
      ...principal(profes),
      profes,
      notas: e.notas ?? null,
      historial: [entrada(por, 'creada')],
      createdBy: por.email,
    };
  });
  const filas = await db.insert(oraSesiones).values(valores).returning();
  return filas.map(aSesion);
}

async function cargar(ids: string[]): Promise<{ sesiones: OraSesion[]; tipos: Map<string, TipoMomento>; correos: Map<string, string> }> {
  const [sesiones, tipos] = await Promise.all([db.select().from(oraSesiones).where(inArray(oraSesiones.id, ids)), getTipos()]);
  const profeIds = [...new Set(sesiones.flatMap((s) => profesDe(aSesion(s)).map((p) => p.id)))];
  const correos = new Map<string, string>();
  if (profeIds.length) {
    const filas = await db.select({ id: eduTeachers.id, email: eduTeachers.email }).from(eduTeachers).where(inArray(eduTeachers.id, profeIds));
    for (const f of filas) if (f.email) correos.set(f.id, f.email.toLowerCase());
  }
  return { sesiones, tipos: new Map(tipos.map((t) => [t.id, t])), correos };
}

async function actualizar(id: string, cambios: Partial<typeof oraSesiones.$inferInsert>): Promise<SesionOra> {
  const [fila] = await db.update(oraSesiones).set({ ...cambios, updatedAt: new Date() }).where(eq(oraSesiones.id, id)).returning();
  return aSesion(fila);
}

/** Crea o mueve el evento de una sesión confirmada y guarda el resultado (o el error). */
async function sincronizarCalendario(s: OraSesion, tipo: TipoMomento, correos: Map<string, string>): Promise<Partial<typeof oraSesiones.$inferInsert>> {
  const r = await guardarEvento({ tipo, sesion: aSesion(s), correos });
  return r.ok
    ? { googleEventId: r.eventId, googleCalendarId: r.calendarId, calendarioError: null }
    : { calendarioError: r.error };
}

/** Va de tres en tres: cada llamada a Google tarda ~0,3 s y confirmar un trimestre son 24. */
async function enPool<T, R>(items: readonly T[], fn: (t: T) => Promise<R>, n = 3): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

export async function accionSesion(id: string, a: AccionSesion, por: Quien): Promise<SesionOra | null> {
  const { sesiones, tipos, correos } = await cargar([id]);
  const s = sesiones[0];
  if (!s) return null;
  const tipo = tipos.get(s.tipoId);
  if (!tipo) throw new Error('El tipo de esta sesión ya no existe');
  const hoy = hoyEnEspana();

  if (a.accion === 'notas') return actualizar(id, { notas: a.notas?.trim() || null });

  if (a.accion === 'catalogo') {
    let nombre: string | null = null;
    if (a.catalogoId) {
      const [fila] = await db.select({ tipoId: oraCatalogo.tipoId, nombre: oraCatalogo.nombre }).from(oraCatalogo).where(eq(oraCatalogo.id, a.catalogoId)).limit(1);
      if (!fila || fila.tipoId !== s.tipoId) throw new ErrorDeEntrada('Esa sesión no es de este tipo');
      nombre = fila.nombre;
    }
    return actualizar(id, { catalogoId: a.catalogoId, historial: [...(s.historial ?? []), entrada(por, nombre ? `sesión: ${nombre}` : 'sesión: quitada')] });
  }

  if (a.accion === 'profes' || a.accion === 'mover') {
    const profes = sinResponsable(a.profes, await profeIdDe(s.responsableEmail));
    const cambios: Partial<typeof oraSesiones.$inferInsert> = { ...principal(profes), profes };
    const historial = [...(s.historial ?? [])];
    if (a.accion === 'mover') {
      Object.assign(cambios, { fecha: a.fecha, horaInicio: a.horaInicio, horaFin: a.horaFin });
      historial.push(entrada(por, `movida: ${s.fecha} ${s.horaInicio} → ${a.fecha} ${a.horaInicio}`));
      // Recolocar una «por reprogramar» la devuelve a borrador (su evento ya se quitó).
      if (s.estado === 'reprogramar') cambios.estado = 'borrador';
    } else {
      historial.push(entrada(por, `profes: ${profes.map((p) => p.nombre).join(', ') || '—'}`));
    }
    cambios.historial = historial;
    if (s.estado === 'confirmado') {
      const tras = avisoTrasCambio(aSesion(s), 'mover');
      if (tras) Object.assign(cambios, tras, { avisoProgramadoPara: null });
      else if (s.avisoEstado === 'programado' && a.accion === 'mover') {
        Object.assign(cambios, avisoAlConfirmar(a.fecha, tipo.avisoDias, hoy));
      }
      Object.assign(cambios, await sincronizarCalendario({ ...s, ...cambios } as OraSesion, tipo, correos));
    }
    return actualizar(id, cambios);
  }

  if (a.accion === 'reprogramar' && s.estado !== 'confirmado') return aSesion(s);
  if (a.accion === 'anular' && s.estado === 'anulado') return aSesion(s);

  // reprogramar / anular: fuera del calendario (Google avisa de la cancelación).
  const quitado = await borrarEvento(s, s.googleCalendarId ?? tipo.calendarioId);
  const base: Partial<typeof oraSesiones.$inferInsert> = quitado.ok
    ? { googleEventId: null, calendarioError: null }
    : { calendarioError: `No se pudo quitar del calendario: ${quitado.error}` };
  if (a.accion === 'reprogramar') {
    const avisado = s.avisoEstado === 'enviado';
    return actualizar(id, {
      ...base,
      estado: 'reprogramar',
      avisoEstado: 'no',
      avisoProgramadoPara: null,
      avisoTipo: avisado ? 'cambio' : s.avisoTipo,
      historial: [...(s.historial ?? []), entrada(por, 'a reprogramar')],
    });
  }
  const tras = avisoTrasCambio(aSesion(s), 'anular')!;
  return actualizar(id, { ...base, estado: 'anulado', ...tras, avisoProgramadoPara: null, historial: [...(s.historial ?? []), entrada(por, 'anulada')] });
}

/** Solo se borran de verdad los borradores: lo confirmado se anula y deja rastro. */
export async function borrarSesion(id: string): Promise<boolean> {
  const filas = await db.delete(oraSesiones).where(and(eq(oraSesiones.id, id), eq(oraSesiones.estado, 'borrador'))).returning({ id: oraSesiones.id });
  return filas.length > 0;
}

export interface ResultadoLote {
  sesiones: SesionOra[];
  borradas: string[];
  mensaje: string;
}

export async function accionLote(accion: AccionLote, ids: string[], por: Quien, dias?: number): Promise<ResultadoLote> {
  if (accion === 'descartar') {
    const filas = await db
      .delete(oraSesiones)
      .where(and(inArray(oraSesiones.id, ids), eq(oraSesiones.estado, 'borrador')))
      .returning({ id: oraSesiones.id });
    return { sesiones: [], borradas: filas.map((f) => f.id), mensaje: `${filas.length} borradores descartados` };
  }
  if (accion === 'enviar') return enviarAvisos(ids, por);

  const { sesiones, tipos, correos } = await cargar(ids);
  const hoy = hoyEnEspana();

  if (accion === 'confirmar' || accion === 'calendario') {
    const aTocar = sesiones.filter((s) =>
      accion === 'confirmar' ? s.estado === 'borrador' || (s.estado === 'confirmado' && !s.googleEventId) : s.estado === 'confirmado',
    );
    const hechas = await enPool(aTocar, async (s) => {
      const tipo = tipos.get(s.tipoId)!;
      const cambios: Partial<typeof oraSesiones.$inferInsert> = {};
      if (s.estado === 'borrador') {
        cambios.estado = 'confirmado';
        cambios.historial = [...(s.historial ?? []), entrada(por, 'confirmada')];
        if (s.avisoEstado === 'no') Object.assign(cambios, avisoAlConfirmar(s.fecha, tipo.avisoDias, hoy));
      }
      Object.assign(cambios, await sincronizarCalendario({ ...s, ...cambios } as OraSesion, tipo, correos));
      return actualizar(s.id, cambios);
    });
    const errores = hechas.filter((s) => s.calendarioError).length;
    return { sesiones: hechas, borradas: [], mensaje: errores ? `${hechas.length} confirmadas · ${errores} sin evento en Calendar` : `${hechas.length} confirmadas` };
  }

  const vivas = sesiones.filter((s) => s.estado === 'confirmado' || (s.estado === 'anulado' && s.avisoEstado === 'pendiente'));
  const hechas = await Promise.all(
    vivas.map((s) => {
      if (accion === 'manual') {
        return actualizar(s.id, {
          avisoEstado: 'enviado',
          avisoManual: true,
          avisoEnviadoAt: new Date(),
          avisoError: null,
          avisoProgramadoPara: null,
          historial: [...(s.historial ?? []), entrada(por, 'avisado en persona', { fecha: s.fecha, horaInicio: s.horaInicio, horaFin: s.horaFin })],
        });
      }
      if (accion === 'no_avisar') return actualizar(s.id, { avisoEstado: 'no', avisoProgramadoPara: null });
      // programar
      const d = dias ?? tipos.get(s.tipoId)?.avisoDias ?? 7;
      return actualizar(s.id, { ...avisoAlConfirmar(s.fecha, d, hoy), avisoError: null });
    }),
  );
  return { sesiones: hechas, borradas: [], mensaje: `${hechas.length} actualizadas` };
}

// ─── Avisos por correo ───────────────────────────────────────────────────────

/**
 * Manda los avisos de estas sesiones, UN correo por profe (y responsable, tipo y clase de
 * correo): si a Ana le tocan dos oratorios en el mismo envío, recibe uno con los dos.
 */
export async function enviarAvisos(ids: string[], por: Quien | null): Promise<ResultadoLote> {
  const { sesiones, tipos } = await cargar(ids);
  const elegibles = sesiones.filter(
    (s) =>
      (s.estado === 'confirmado' && (s.avisoEstado === 'pendiente' || s.avisoEstado === 'programado')) ||
      (s.estado === 'anulado' && s.avisoEstado === 'pendiente' && s.avisoTipo === 'anulacion'),
  );
  if (elegibles.length === 0) return { sesiones: [], borradas: [], mensaje: 'Nada que avisar' };

  const profeIds = [...new Set(elegibles.flatMap((s) => profesDe(aSesion(s)).map((p) => p.id)))];
  const responsables = [...new Set(elegibles.map((s) => s.responsableEmail))];
  const [profes, delResponsable] = await Promise.all([
    profeIds.length
      ? db
          .select({ id: eduTeachers.id, email: eduTeachers.email, nombre: eduTeachers.nombre, apellido1: eduTeachers.apellido1, apellido2: eduTeachers.apellido2, nombreMostrado: eduTeachers.nombreMostrado })
          .from(eduTeachers)
          .where(inArray(eduTeachers.id, profeIds))
      : Promise.resolve([]),
    db
      .select({ email: eduTeachers.email, nombre: eduTeachers.nombre, apellido1: eduTeachers.apellido1, apellido2: eduTeachers.apellido2, nombreMostrado: eduTeachers.nombreMostrado })
      .from(eduTeachers)
      .where(inArray(sql`lower(${eduTeachers.email})`, responsables)),
  ]);
  const profePor = new Map(profes.map((p) => [p.id, p]));
  const firmaPor = new Map(delResponsable.map((p) => [p.email!.toLowerCase(), { pila: pilaProfe(p), nombre: nombreProfeBreve(p) }]));

  // Grupos: responsable · tipo · clase de correo · profe.
  const grupos = new Map<string, { s: OraSesion[]; profeId: string }>();
  const sinCorreo = new Set<string>();
  for (const s of elegibles) {
    const lista = profesDe(aSesion(s));
    if (lista.length === 0) sinCorreo.add(s.id);
    for (const p of lista) {
      if (!profePor.get(p.id)?.email) {
        sinCorreo.add(s.id);
        continue;
      }
      const k = `${s.responsableEmail}|${s.tipoId}|${s.avisoTipo}|${p.id}`;
      const g = grupos.get(k) ?? { s: [], profeId: p.id };
      g.s.push(s);
      grupos.set(k, g);
    }
  }

  const fallos = new Map<string, string>();
  const ok = new Set<string>();
  await enPool([...grupos.values()], async (g) => {
    const s0 = g.s[0];
    const tipo = tipos.get(s0.tipoId)!;
    const profe = profePor.get(g.profeId)!;
    const firma = firmaPor.get(s0.responsableEmail) ?? { pila: s0.responsableNombre ?? s0.responsableEmail, nombre: s0.responsableNombre ?? s0.responsableEmail };
    const items = [...g.s]
      .sort((a, b) => `${a.fecha}${a.horaInicio}`.localeCompare(`${b.fecha}${b.horaInicio}`))
      .map((s) => {
        const mio = profesDe(aSesion(s)).find((p) => p.id === g.profeId);
        const avisado = [...(s.historial ?? [])].reverse().find((h) => h.que.startsWith('avis') && h.fecha);
        const antes =
          s.avisoTipo === 'cambio' && avisado && (avisado.fecha !== s.fecha || avisado.horaInicio !== s.horaInicio)
            ? { fecha: avisado.fecha!, horaInicio: avisado.horaInicio!, horaFin: avisado.horaFin! }
            : null;
        return { fecha: s.fecha, horaInicio: s.horaInicio, horaFin: s.horaFin, clase: etiquetaClase(s), materia: mio?.materia ?? s.materia, antes };
      });
    const { subject, html } = correoProfe({
      tipoCorreo: s0.avisoTipo as TipoCorreo,
      nombreCorreo: tipo.nombreCorreo,
      textoExtra: tipo.textoCorreo,
      saludo: pilaProfe(profe),
      firma: firma.pila || firma.nombre,
      items,
    });
    try {
      await enviar('oratorios', { to: profe.email!, subject, html, como: { nombre: firma.nombre, email: s0.responsableEmail } });
      for (const s of g.s) ok.add(s.id);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error('Oratorios · correo:', m);
      for (const s of g.s) fallos.set(s.id, m.slice(0, 300));
    }
  });

  const quien = por ?? { email: 'cron', nombre: 'aviso programado' };
  const hechas = await Promise.all(
    elegibles.map((s) => {
      const error = fallos.get(s.id) ?? (sinCorreo.has(s.id) ? 'Algún profe no tiene correo en la BBDD central' : null);
      if (ok.has(s.id) && !fallos.has(s.id)) {
        return actualizar(s.id, {
          avisoEstado: s.estado === 'anulado' ? 'no' : 'enviado',
          avisoEnviadoAt: new Date(),
          avisoManual: false,
          avisoProgramadoPara: null,
          avisoError: sinCorreo.has(s.id) ? 'Algún profe no tiene correo en la BBDD central' : null,
          historial: [...(s.historial ?? []), entrada(quien, s.avisoTipo === 'anulacion' ? 'avisada la anulación' : 'aviso enviado', { fecha: s.fecha, horaInicio: s.horaInicio, horaFin: s.horaFin })],
        });
      }
      return actualizar(s.id, { avisoError: error ?? 'No se pudo enviar' });
    }),
  );
  const enviados = hechas.filter((s) => !s.avisoError || s.avisoEstado === 'enviado').length;
  const errores = elegibles.length - enviados;
  return { sesiones: hechas, borradas: [], mensaje: errores ? `${enviados} avisados · ${errores} con error` : `${enviados} avisados` };
}

/** Cron diario: los avisos programados para hoy o antes que aún no han salido. */
export async function enviarAvisosDebidos(): Promise<ResultadoLote> {
  const hoy = hoyEnEspana();
  const debidas = await db
    .select({ id: oraSesiones.id })
    .from(oraSesiones)
    .where(and(eq(oraSesiones.estado, 'confirmado'), eq(oraSesiones.avisoEstado, 'programado'), lte(oraSesiones.avisoProgramadoPara, hoy)));
  if (debidas.length === 0) return { sesiones: [], borradas: [], mensaje: 'Nada que avisar' };
  return enviarAvisos(debidas.map((d) => d.id), null);
}

