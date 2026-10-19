// Nouvinguts: queries. Ficha: docs/28-nouvinguts.md.
//
// La lista y la ficha se cargan en UNA tanda (`Promise.all` con subconsultas): el nouvingut,
// su ficha central, sus marcas, los materiales de su clase, su campaña de licencias y la
// última subida a ASM. Las escrituras de cada paso llaman al código del módulo dueño del dato
// (protección de datos, banco, AMPA, materiales, licencias): esto no se queda con la
// autoridad de nada, solo con lo que no vive en otro sitio.
import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { db } from '@/db';
import {
  asmEntregas,
  authUsers,
  cfgAjustes,
  eduStudents,
  licCampaigns,
  licOrders,
  licStudents,
  matEstados,
  matMateriales,
  nouAlumnos,
  nouMarcas,
  nouNotas,
  nouPasos,
  type NouAlumno,
} from '@/db/schema';
import { academicYearActual } from '@/lib/constants';
import { aplicaMaterial, estadoVisible, type DestinoMaterial, type EstadoMaterial } from '@/lib/alumnado';
import { entraEnAlcance } from '@/lib/autoasm-construir';
import { guardarProteccion } from '@/lib/alumnado-server';
import { setAmpa, setBanco } from '@/lib/bancolibros-server';
import { guardarEstadosMaterial } from '@/lib/materiales-server';
import { setStudentManualCompleted } from '@/lib/licencias-server';
import { hoyISO } from '@/lib/tableros';
import { appBaseUrl } from '@/lib/constants';
import { COLEGIO } from '@/lib/colegio';
import { emailConfigurado, enviar } from '@/lib/email';
import { correoAlta, correoListo, correoNota, correoParteTerminada, type AlumnoCorreo } from '@/lib/nouvinguts-email';
import {
  claveNombre,
  diasDesde,
  eventosDeCambio,
  GRUPO_AVISO_LABEL,
  ROLES_DE_GRUPO,
  type EventoAviso,
  type GrupoAviso,
  emparejarAltas,
  esInicioDeCurso,
  etiquetaCurso,
  leerAjustesNouvinguts,
  pasosDeNouvingut,
  procesoEfectivo,
  resumenPasos,
  type AccionPaso,
  type AjustesNouvinguts,
  type AltaEducamos,
  type AltaNouvingut,
  type ClavePaso,
  type DatosNouvingut,
  type MarcaPaso,
  type PasoProceso,
  type ResultadoPaso,
  type ResumenPasos,
} from '@/lib/nouvinguts';

export interface Firma {
  email: string;
  nombre: string | null;
}

export interface NouvingutVista {
  id: string;
  eduStudentId: string | null;
  nombre: string;
  curso: string | null;
  clase: string;
  fechaMatricula: string;
  dias: number;
  atascado: boolean;
  origen: 'manual' | 'sync';
  estado: 'abierto' | 'cerrado';
  cerradoAt: string | null;
  cerradoPor: string | null;
  notas: number;
  pasos: ResultadoPaso[];
  resumen: ResumenPasos;
}

export interface NotaVista {
  id: string;
  paso: ClavePaso | null;
  texto: string;
  autor: string | null;
  /** «Secretaría, TIC»: también se mandó por correo. */
  enviadaA: string | null;
  at: string;
}

export interface Candidato {
  id: string;
  nombre: string;
  clase: string;
  alta: string; // ISO
}

export interface FichaNouvingut extends NouvingutVista {
  datos: DatosNouvingut;
  notasLista: NotaVista[];
  avisoVinculo: string | null;
  /** Lo tecleado al apuntarlo (solo se edita mientras espera a Educamos). */
  apuntado: { nombre: string | null; apellidos: string | null; curso: string | null };
  nia: string | null;
  tutor: string | null;
  candidatos: Candidato[];
  diasAtasco: number;
}

const AJUSTES_CLAVE = 'nouvinguts';
const MOTIVO_NO_PEDIRA = 'No pedirá licencias (Nouvinguts)';

function nombreCompleto(...partes: (string | null | undefined)[]): string {
  return partes.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function clase(curso: string | null, letra: string | null): string {
  if (!curso) return 'Sin curso';
  return letra && !/PDC/i.test(curso) && letra.toUpperCase() !== 'PDC' ? `${etiquetaCurso(curso)} ${letra}` : etiquetaCurso(curso);
}

// ─── Lectura ──────────────────────────────────────────────────────────────────

type Filtro = { estado: 'abierto' | 'cerrado' } | { id: string } | { ids: string[] };

async function cargar(filtro: Filtro, veBecas: boolean) {
  const cond = 'id' in filtro ? eq(nouAlumnos.id, filtro.id) : 'ids' in filtro ? inArray(nouAlumnos.id, filtro.ids) : eq(nouAlumnos.estado, filtro.estado);
  const ids = db.select({ id: nouAlumnos.id }).from(nouAlumnos).where(cond);
  const eduIds = db
    .select({ id: nouAlumnos.eduStudentId })
    .from(nouAlumnos)
    .where(and(cond, sql`${nouAlumnos.eduStudentId} is not null`));
  const year = academicYearActual();
  // La campaña vigente es la más reciente: el mismo criterio que el banco de libros y el escritorio.
  const campaniaVigente = db.select({ id: licCampaigns.id }).from(licCampaigns).orderBy(desc(licCampaigns.createdAt)).limit(1);
  const enCampania = and(inArray(licStudents.campaignId, campaniaVigente), inArray(licStudents.eduStudentId, eduIds));

  const [filas, config, ajustesFila, marcas, notas, alumnos, materiales, estadosMat, campania, licAlumnos, pedidos, subidas] =
    await Promise.all([
      db.select().from(nouAlumnos).where(cond).orderBy(asc(nouAlumnos.fechaMatricula), asc(nouAlumnos.createdAt)),
      db.select().from(nouPasos),
      db.select({ valor: cfgAjustes.valor }).from(cfgAjustes).where(eq(cfgAjustes.clave, AJUSTES_CLAVE)),
      db.select().from(nouMarcas).where(inArray(nouMarcas.nouvingutId, ids)),
      db
        .select({ id: nouNotas.nouvingutId, n: count() })
        .from(nouNotas)
        .where(inArray(nouNotas.nouvingutId, ids))
        .groupBy(nouNotas.nouvingutId),
      db
        .select({
          id: eduStudents.id,
          nombre: eduStudents.nombre,
          apellido1: eduStudents.apellido1,
          apellido2: eduStudents.apellido2,
          curso: eduStudents.curso,
          letra: eduStudents.letra,
          nia: eduStudents.nia,
          matricula: eduStudents.matricula,
          tutorPersonal: eduStudents.tutorPersonal,
          emailGoogle: eduStudents.emailGoogle,
          bancoLibros: eduStudents.bancoLibros,
          ampa: eduStudents.ampa,
          pdImagen: eduStudents.pdImagen,
          pdRedes: eduStudents.pdRedes,
          pdAmpa: eduStudents.pdAmpa,
          pdOng: eduStudents.pdOng,
          pdDesestimaCorreo: eduStudents.pdDesestimaCorreo,
          pdActualizadoAt: eduStudents.pdActualizadoAt,
          active: eduStudents.active,
          createdAt: eduStudents.createdAt,
        })
        .from(eduStudents)
        .where(inArray(eduStudents.id, eduIds)),
      db
        .select({ id: matMateriales.id, nombre: matMateriales.nombre, destinos: matMateriales.destinos })
        .from(matMateriales)
        .where(and(eq(matMateriales.academicYear, year), eq(matMateriales.activo, true)))
        .orderBy(asc(matMateriales.createdAt)),
      db
        .select({ materialId: matEstados.materialId, eduStudentId: matEstados.eduStudentId, estado: matEstados.estado })
        .from(matEstados)
        .where(inArray(matEstados.eduStudentId, eduIds)),
      db.select({ id: licCampaigns.id, nombre: licCampaigns.name }).from(licCampaigns).orderBy(desc(licCampaigns.createdAt)).limit(1),
      db
        .select({ id: licStudents.id, eduStudentId: licStudents.eduStudentId, manualCompletedAt: licStudents.manualCompletedAt })
        .from(licStudents)
        .where(enCampania),
      db
        .select({ studentId: licOrders.studentId, confirmedAt: licOrders.confirmedAt, createdAt: licOrders.createdAt })
        .from(licOrders)
        .where(
          and(
            inArray(licOrders.studentId, db.select({ id: licStudents.id }).from(licStudents).where(enCampania)),
            eq(licOrders.archived, false),
          ),
        ),
      db
        .select({ createdAt: asmEntregas.createdAt, desdeCurso: asmEntregas.desdeCurso })
        .from(asmEntregas)
        .where(and(eq(asmEntregas.academicYear, year), sql`${asmEntregas.modo} in ('ftp','manual')`, eq(asmEntregas.estado, 'ok')))
        .orderBy(desc(asmEntregas.createdAt))
        .limit(1),
    ]);

  const ajustes = leerAjustesNouvinguts(ajustesFila[0]?.valor);
  const proceso = procesoEfectivo(config);
  const hoy = hoyISO();
  const alumnoPorId = new Map(alumnos.map((a) => [a.id, a]));
  const notasPorId = new Map(notas.map((n) => [n.id, Number(n.n)]));
  const marcasPorId = new Map<string, Partial<Record<ClavePaso, MarcaPaso>>>();
  for (const m of marcas) {
    const suyas = marcasPorId.get(m.nouvingutId) ?? {};
    suyas[m.paso as ClavePaso] = { valor: m.valor, porNombre: m.porNombre ?? m.por, at: m.at.toISOString() };
    marcasPorId.set(m.nouvingutId, suyas);
  }
  const estadoMat = new Map<string, Map<string, EstadoMaterial | null>>();
  for (const e of estadosMat) {
    const suyo = estadoMat.get(e.eduStudentId) ?? new Map();
    const valido = e.estado === 'pagado' || e.estado === 'no' || e.estado === 'becado' || e.estado === 'no_aplica' ? e.estado : null;
    suyo.set(e.materialId, estadoVisible(valido, veBecas));
    estadoMat.set(e.eduStudentId, suyo);
  }
  const licPorEdu = new Map(licAlumnos.map((l) => [l.eduStudentId, l]));
  const pedidoPorLic = new Map(pedidos.map((p) => [p.studentId, (p.confirmedAt ?? p.createdAt).toISOString()]));
  const subida = subidas[0] ?? null;

  const vistas = filas.map((f) => {
    const a = f.eduStudentId ? alumnoPorId.get(f.eduStudentId) : undefined;
    const curso = a ? a.curso : f.curso;
    const lic = a ? licPorEdu.get(a.id) : undefined;
    const datos: DatosNouvingut = {
      vinculado: !!a,
      activo: a?.active ?? true,
      avisoVinculo: f.avisoVinculo,
      curso,
      matricula: a?.matricula ?? null,
      proteccion: a
        ? {
            actualizadoAt: a.pdActualizadoAt?.toISOString() ?? null,
            imagen: a.pdImagen,
            redes: a.pdRedes,
            ampa: a.pdAmpa,
            ong: a.pdOng,
          }
        : null,
      desestimaCorreo: a?.pdDesestimaCorreo ?? false,
      bancoLibros: a?.bancoLibros ?? null,
      ampa: a?.ampa ?? null,
      emailGoogle: a?.emailGoogle ?? null,
      materiales: a
        ? materiales
            .filter((m) => aplicaMaterial(m.destinos as DestinoMaterial[], { curso: a.curso, letra: a.letra }))
            .map((m) => ({ id: m.id, nombre: m.nombre, estado: estadoMat.get(a.id)?.get(m.id) ?? null }))
        : [],
      asmSubidaAt:
        a && subida && subida.createdAt > a.createdAt && entraEnAlcance(a.curso, subida.desdeCurso) ? subida.createdAt.toISOString() : null,
      licencias: {
        campania: campania[0]?.nombre ?? null,
        enCampania: !!lic,
        pedidoAt: lic ? (pedidoPorLic.get(lic.id) ?? null) : null,
        noPedira: !!lic?.manualCompletedAt,
      },
      marcas: marcasPorId.get(f.id) ?? {},
    };
    const pasos = pasosDeNouvingut(proceso, datos);
    const resumen = resumenPasos(pasos);
    const dias = diasDesde(f.fechaMatricula, hoy);
    const vista: NouvingutVista = {
      id: f.id,
      eduStudentId: f.eduStudentId,
      nombre: a ? nombreCompleto(a.nombre, a.apellido1, a.apellido2) : nombreCompleto(f.nombre, f.apellidos),
      curso,
      clase: a ? clase(a.curso, a.letra) : etiquetaCurso(f.curso),
      fechaMatricula: f.fechaMatricula,
      dias,
      atascado: f.estado === 'abierto' && !resumen.listo && dias > ajustes.diasAtasco,
      origen: f.origen === 'sync' ? 'sync' : 'manual',
      estado: f.estado === 'cerrado' ? 'cerrado' : 'abierto',
      cerradoAt: f.cerradoAt?.toISOString() ?? null,
      cerradoPor: f.cerradoPor,
      notas: notasPorId.get(f.id) ?? 0,
      pasos,
      resumen,
    };
    return { vista, datos, fila: f, alumno: a };
  });
  return { vistas, proceso, ajustes };
}

function veBecasDe(role: string | null): boolean {
  return role === 'direccion' || role === 'secretaria' || role === 'tic' || role === 'supertic' || role === 'orientacion';
}

export async function listaNouvinguts(
  estado: 'abierto' | 'cerrado',
  role: string | null,
): Promise<{ nouvinguts: NouvingutVista[]; proceso: PasoProceso[]; ajustes: AjustesNouvinguts }> {
  const { vistas, proceso, ajustes } = await cargar({ estado }, veBecasDe(role));
  const nouvinguts = vistas.map((v) => v.vista);
  // Cerrados: los últimos primero. Abiertos: los que llevan más días, arriba.
  if (estado === 'cerrado') nouvinguts.sort((a, b) => (b.cerradoAt ?? '').localeCompare(a.cerradoAt ?? ''));
  return { nouvinguts, proceso, ajustes };
}

export async function fichaNouvingut(id: string, role: string | null): Promise<FichaNouvingut | null> {
  const [{ vistas, ajustes }, notas] = await Promise.all([
    cargar({ id }, veBecasDe(role)),
    db.select().from(nouNotas).where(eq(nouNotas.nouvingutId, id)).orderBy(asc(nouNotas.createdAt)),
  ]);
  const v = vistas[0];
  if (!v) return null;
  const candidatos = v.fila.eduStudentId ? [] : await candidatosPorNombre(v.fila);
  return {
    ...v.vista,
    datos: v.datos,
    avisoVinculo: v.fila.avisoVinculo,
    apuntado: { nombre: v.fila.nombre, apellidos: v.fila.apellidos, curso: v.fila.curso },
    nia: v.alumno?.nia ?? null,
    tutor: v.alumno?.tutorPersonal ?? null,
    candidatos,
    diasAtasco: ajustes.diasAtasco,
    notasLista: notas.map((n) => ({
      id: n.id,
      paso: (n.paso as ClavePaso | null) ?? null,
      texto: n.texto,
      autor: n.autorNombre ?? n.autorEmail,
      enviadaA: n.enviadaA,
      at: n.createdAt.toISOString(),
    })),
  };
}

/** Para el escritorio: cuántos hay en curso y cuántos ya se pueden cerrar o tienen aviso. */
export async function cuentaNouvinguts(): Promise<number> {
  const [fila] = await db.select({ n: count() }).from(nouAlumnos).where(eq(nouAlumnos.estado, 'abierto'));
  return Number(fila?.n ?? 0);
}

/**
 * Alumnos activos de la BBDD central que se llaman igual (nombre y apellidos normalizados). Se
 * compara en memoria y no con `ilike` para no depender de los acentos: son ~650 filas de seis
 * columnas, una consulta.
 */
async function candidatosPorNombre(f: Pick<NouAlumno, 'nombre' | 'apellidos'>): Promise<Candidato[]> {
  const clave = claveNombre(f.nombre, f.apellidos);
  if (!clave) return [];
  const filas = await db
    .select({
      id: eduStudents.id,
      nombre: eduStudents.nombre,
      apellido1: eduStudents.apellido1,
      apellido2: eduStudents.apellido2,
      curso: eduStudents.curso,
      letra: eduStudents.letra,
      createdAt: eduStudents.createdAt,
    })
    .from(eduStudents)
    .where(eq(eduStudents.active, true));
  return filas
    .filter((a) => claveNombre(a.nombre, a.apellido1, a.apellido2) === clave)
    .map((a) => ({ id: a.id, nombre: nombreCompleto(a.nombre, a.apellido1, a.apellido2), clase: clase(a.curso, a.letra), alta: a.createdAt.toISOString() }));
}

/** Buscador para vincular a mano: alumnos activos por nombre o apellidos (todas las palabras). */
export async function buscarAlumnos(q: string): Promise<Candidato[]> {
  const palabras = q.trim().split(/\s+/).filter((p) => p.length >= 2).slice(0, 4);
  if (palabras.length === 0) return [];
  const filas = await db
    .select({
      id: eduStudents.id,
      nombre: eduStudents.nombre,
      apellido1: eduStudents.apellido1,
      apellido2: eduStudents.apellido2,
      curso: eduStudents.curso,
      letra: eduStudents.letra,
      createdAt: eduStudents.createdAt,
    })
    .from(eduStudents)
    .where(
      and(
        eq(eduStudents.active, true),
        ...palabras.map((p) =>
          or(ilike(eduStudents.nombre, `%${p}%`), ilike(eduStudents.apellido1, `%${p}%`), ilike(eduStudents.apellido2, `%${p}%`)),
        ),
      ),
    )
    .orderBy(desc(eduStudents.createdAt))
    .limit(15);
  return filas.map((a) => ({ id: a.id, nombre: nombreCompleto(a.nombre, a.apellido1, a.apellido2), clase: clase(a.curso, a.letra), alta: a.createdAt.toISOString() }));
}

export async function getProceso(): Promise<{ proceso: PasoProceso[]; ajustes: AjustesNouvinguts }> {
  const [config, ajustesFila] = await Promise.all([
    db.select().from(nouPasos),
    db.select({ valor: cfgAjustes.valor }).from(cfgAjustes).where(eq(cfgAjustes.clave, AJUSTES_CLAVE)),
  ]);
  return { proceso: procesoEfectivo(config), ajustes: leerAjustesNouvinguts(ajustesFila[0]?.valor) };
}

// ─── Altas ────────────────────────────────────────────────────────────────────

export class ErrorNouvinguts extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/**
 * Apuntar a mano («tengo uno nuevo»). Si ya hay un nouvingut abierto con ese nombre, no se
 * duplica. Si en la BBDD central ya hay alguien activo con ese nombre y sin nouvingut (llegó
 * antes de que alguien lo apuntara), NO se vincula a ciegas: queda con aviso para elegirlo.
 */
export async function apuntarNouvingut(alta: AltaNouvingut, firma: Firma): Promise<{ id: string }> {
  const clave = claveNombre(alta.nombre, alta.apellidos);
  const abiertos = await db
    .select({
      id: nouAlumnos.id,
      nombre: nouAlumnos.nombre,
      apellidos: nouAlumnos.apellidos,
      eNombre: eduStudents.nombre,
      eApellido1: eduStudents.apellido1,
      eApellido2: eduStudents.apellido2,
    })
    .from(nouAlumnos)
    .leftJoin(eduStudents, eq(eduStudents.id, nouAlumnos.eduStudentId))
    .where(eq(nouAlumnos.estado, 'abierto'));
  const repetido = abiertos.find(
    (n) => claveNombre(n.nombre, n.apellidos) === clave || claveNombre(n.eNombre, n.eApellido1, n.eApellido2) === clave,
  );
  if (repetido) throw new ErrorNouvinguts('Ya está en nouvinguts', 409);

  const id = crypto.randomUUID();
  const yaEnEducamos = (await candidatosPorNombre(alta)).length > 0;
  const statements: BatchItem<'pg'>[] = [
    db.insert(nouAlumnos).values({
      id,
      nombre: alta.nombre,
      apellidos: alta.apellidos,
      curso: alta.curso,
      fechaMatricula: alta.fechaMatricula,
      origen: 'manual',
      avisoVinculo: yaEnEducamos ? 'Ya hay alguien en Educamos con este nombre: elige si es él' : null,
      createdBy: firma.email,
    }),
  ];
  if (alta.nota) {
    statements.push(
      db.insert(nouNotas).values({ nouvingutId: id, paso: null, texto: alta.nota, autorEmail: firma.email, autorNombre: firma.nombre }),
    );
  }
  await db.batch(statements as [BatchItem<'pg'>, ...BatchItem<'pg'>[]]);
  return { id };
}

export interface ResultadoAltas {
  /** Los nouvinguts que se acaban de crear, para avisar de ellos. */
  nuevosIds?: string[];
  nuevos: number;
  vinculados: number;
  dudosos: number;
  inicioCurso: number;
}

/**
 * Las altas de una sincronización de Educamos (o de «traer altas» al estrenarlo) entran en
 * nouvinguts. Primero se emparejan con lo apuntado a mano (solo coincidencias únicas, ver
 * `emparejarAltas`); el resto entra como nouvingut nuevo, salvo los 3 años de verano, que son
 * del arranque de curso. Una alta que ya tenga nouvingut no se toca.
 */
export async function registrarAltas(altas: (AltaEducamos & { fecha: string })[]): Promise<ResultadoAltas> {
  const resultado: ResultadoAltas = { nuevosIds: [], nuevos: 0, vinculados: 0, dudosos: 0, inicioCurso: 0 };
  if (altas.length === 0) return resultado;
  const [apuntados, yaDentro] = await Promise.all([
    db
      .select({ id: nouAlumnos.id, nombre: nouAlumnos.nombre, apellidos: nouAlumnos.apellidos, curso: nouAlumnos.curso })
      .from(nouAlumnos)
      .where(and(isNull(nouAlumnos.eduStudentId), eq(nouAlumnos.estado, 'abierto'))),
    db
      .select({ id: nouAlumnos.eduStudentId })
      .from(nouAlumnos)
      .where(inArray(nouAlumnos.eduStudentId, altas.map((a) => a.id))),
  ]);
  const dentro = new Set(yaDentro.map((y) => y.id));
  const libres = altas.filter((a) => !dentro.has(a.id));
  const { vinculos, dudosos } = emparejarAltas(apuntados, libres);
  const ahora = new Date();
  const statements: BatchItem<'pg'>[] = [];

  for (const v of vinculos) {
    statements.push(
      db.update(nouAlumnos).set({ eduStudentId: v.altaId, avisoVinculo: null, updatedAt: ahora }).where(eq(nouAlumnos.id, v.apuntadoId)),
    );
  }
  for (const d of dudosos) {
    statements.push(
      db
        .update(nouAlumnos)
        .set({ avisoVinculo: 'Varias altas de Educamos se le parecen: elige cuál es', updatedAt: ahora })
        .where(eq(nouAlumnos.id, d.apuntadoId)),
    );
  }
  const vinculadas = new Set(vinculos.map((v) => v.altaId));
  for (const a of libres) {
    if (vinculadas.has(a.id)) continue;
    if (esInicioDeCurso(a.curso, a.fecha)) {
      resultado.inicioCurso++;
      continue;
    }
    const nuevoId = crypto.randomUUID();
    statements.push(
      db
        .insert(nouAlumnos)
        .values({ id: nuevoId, eduStudentId: a.id, fechaMatricula: a.fecha, origen: 'sync', createdBy: 'sync' })
        .onConflictDoNothing({ target: nouAlumnos.eduStudentId }),
    );
    resultado.nuevosIds!.push(nuevoId);
    resultado.nuevos++;
  }
  resultado.vinculados = vinculos.length;
  resultado.dudosos = dudosos.length;
  if (statements.length) await db.batch(statements as [BatchItem<'pg'>, ...BatchItem<'pg'>[]]);
  return resultado;
}

/**
 * Para estrenarlo: las altas de la BBDD central desde una fecha que todavía no son nouvinguts,
 * con su fecha de alta como fecha de matrícula. Con `dry`, solo dice cuántas serían.
 */
export async function importarAltasDesde(desde: string, dry: boolean): Promise<ResultadoAltas & { nombres: string[] }> {
  const filas = await db
    .select({
      id: eduStudents.id,
      nombre: eduStudents.nombre,
      apellido1: eduStudents.apellido1,
      apellido2: eduStudents.apellido2,
      curso: eduStudents.curso,
      createdAt: eduStudents.createdAt,
      ya: nouAlumnos.id,
    })
    .from(eduStudents)
    .leftJoin(nouAlumnos, eq(nouAlumnos.eduStudentId, eduStudents.id))
    .where(and(eq(eduStudents.active, true), gte(eduStudents.createdAt, new Date(`${desde}T00:00:00`))))
    .orderBy(asc(eduStudents.createdAt));
  const altas = filas
    .filter((f) => !f.ya)
    .map((f) => ({ ...f, fecha: hoyISO(f.createdAt) }));
  const entran = altas.filter((a) => !esInicioDeCurso(a.curso, a.fecha));
  if (dry) {
    return {
      nuevos: entran.length,
      vinculados: 0,
      dudosos: 0,
      inicioCurso: altas.length - entran.length,
      nombres: entran.slice(0, 40).map((a) => nombreCompleto(a.nombre, a.apellido1, a.apellido2)),
    };
  }
  return { ...(await registrarAltas(altas)), nombres: [] };
}

// ─── Escrituras de un nouvingut ───────────────────────────────────────────────

async function filaDe(id: string): Promise<NouAlumno> {
  const [fila] = await db.select().from(nouAlumnos).where(eq(nouAlumnos.id, id)).limit(1);
  if (!fila) throw new ErrorNouvinguts('Ese nouvingut no existe', 404);
  return fila;
}

function vinculado(fila: NouAlumno): string {
  if (!fila.eduStudentId) throw new ErrorNouvinguts('Todavía no está en Educamos');
  return fila.eduStudentId;
}

async function marcar(id: string, paso: ClavePaso, valor: string | null, firma: Firma): Promise<void> {
  if (valor === null) {
    await db.delete(nouMarcas).where(and(eq(nouMarcas.nouvingutId, id), eq(nouMarcas.paso, paso)));
    return;
  }
  await db
    .insert(nouMarcas)
    .values({ nouvingutId: id, paso, valor, por: firma.email, porNombre: firma.nombre, at: new Date() })
    .onConflictDoUpdate({
      target: [nouMarcas.nouvingutId, nouMarcas.paso],
      set: { valor, por: firma.email, porNombre: firma.nombre, at: new Date() },
    });
}

export interface PermisosPaso {
  proteccion: boolean;
  participantes: boolean;
  materiales: boolean;
}

/** Un paso desde la ficha. Lo que vive en otro módulo se escribe con el código de ese módulo. */
export async function accionPaso(
  id: string,
  accion: AccionPaso,
  firma: Firma,
  permisos: PermisosPaso,
): Promise<{ antes: ResumenPasos | null }> {
  // Cómo estaba antes, para saber después si ha terminado una parte (y avisar): `avisarCambio`.
  const [fila, antes] = await Promise.all([filaDe(id), resumenDe(id)]);
  await escribirPaso(id, fila, accion, firma, permisos);
  return { antes };
}

async function resumenDe(id: string): Promise<ResumenPasos | null> {
  const { vistas } = await cargar({ id }, true);
  return vistas[0]?.vista.resumen ?? null;
}

async function escribirPaso(id: string, fila: NouAlumno, accion: AccionPaso, firma: Firma, permisos: PermisosPaso): Promise<void> {
  switch (accion.paso) {
    case 'claves':
    case 'foto':
    case 'vinculo_correo':
    case 'ipad':
      await marcar(id, accion.paso, accion.hecho ? 'hecho' : null, firma);
      return;
    case 'matricula': {
      // Un vacío del Excel nunca pisa (computeSyncPlan), así que lo escrito aquí se queda.
      await db.update(eduStudents).set({ matricula: accion.numero, updatedAt: new Date() }).where(eq(eduStudents.id, vinculado(fila)));
      return;
    }
    case 'proteccion': {
      if (!permisos.proteccion) throw new ErrorNouvinguts('La protección de datos la guardan secretaría, dirección o TIC', 403);
      const { imagen, redes, ampa, ong } = accion;
      await guardarProteccion(vinculado(fila), { imagen, redes, ampa, ong }, firma.email);
      return;
    }
    case 'banco':
    case 'ampa': {
      if (!permisos.participantes) throw new ErrorNouvinguts('Esto lo deciden secretaría, dirección o TIC', 403);
      const edu = vinculado(fila);
      if (accion.valor !== null) {
        if (accion.paso === 'banco') await setBanco(edu, accion.valor);
        else await setAmpa([edu], accion.valor);
      }
      await marcar(id, accion.paso, accion.valor === null ? null : 'decidido', firma);
      return;
    }
    case 'materiales': {
      if (!permisos.materiales) throw new ErrorNouvinguts('Los pagos los marcan secretaría, dirección o TIC', 403);
      const hecho = await guardarEstadosMaterial(accion.materialId, [vinculado(fila)], accion.estado, firma.email, () => true);
      if (!hecho || hecho.ids.length === 0) throw new ErrorNouvinguts('Ese material no es de su clase', 404);
      return;
    }
    case 'correo':
      await db.update(eduStudents).set({ emailGoogle: accion.email, updatedAt: new Date() }).where(eq(eduStudents.id, vinculado(fila)));
      return;
    case 'licencias': {
      // Si está en el alumnado de la campaña, «no pedirá» se guarda en Licencias (deja de salir
      // en «Quién falta»); si no, se queda aquí.
      const edu = vinculado(fila);
      const [lic] = await db
        .select({ id: licStudents.id })
        .from(licStudents)
        .where(
          and(
            eq(licStudents.eduStudentId, edu),
            inArray(licStudents.campaignId, db.select({ id: licCampaigns.id }).from(licCampaigns).orderBy(desc(licCampaigns.createdAt)).limit(1)),
          ),
        )
        .limit(1);
      if (lic) {
        await setStudentManualCompleted(lic.id, accion.noPedira, MOTIVO_NO_PEDIRA);
        await marcar(id, 'licencias', null, firma);
      } else {
        await marcar(id, 'licencias', accion.noPedira ? 'no_pedira' : null, firma);
      }
      return;
    }
  }
}

export interface CorreoNota {
  grupos: GrupoAviso[];
  otros: string[];
}

/**
 * Una nota en un paso (o general). Con `correo`, además sale por correo desde el buzón de quien
 * la escribe (`mandarNota`, que lanza el route con `after()`): aquí solo se guarda a quién.
 */
export async function anadirNota(
  id: string,
  paso: ClavePaso | null,
  texto: string,
  firma: Firma,
  correo?: CorreoNota,
): Promise<{ notaId: string; enviadaA: string | null }> {
  await filaDe(id);
  if (correo) {
    const fuera = correo.otros.filter((c) => !c.endsWith(`@${COLEGIO.dominio}`));
    if (fuera.length) throw new ErrorNouvinguts(`Solo correos del colegio (@${COLEGIO.dominio}): ${fuera.join(', ')}`);
    if (!emailConfigurado()) throw new ErrorNouvinguts('El correo no está configurado en este servidor', 503);
  }
  const enviadaA = correo ? [...correo.grupos.map((g) => GRUPO_AVISO_LABEL[g]), ...correo.otros].join(', ') : null;
  const notaId = crypto.randomUUID();
  await db.insert(nouNotas).values({ id: notaId, nouvingutId: id, paso, texto, autorEmail: firma.email, autorNombre: firma.nombre, enviadaA });
  return { notaId, enviadaA };
}

// ─── Correos ──────────────────────────────────────────────────────────────────

export function urlNouvingut(id: string): string {
  return `${appBaseUrl()}/gestion/nouvinguts/${id}`;
}

/** Correos de las personas activas de esos grupos (por rol), sin repetir y sin `menos`. */
export async function correosDeGrupos(grupos: readonly GrupoAviso[], menos: string[] = []): Promise<string[]> {
  const roles = [...new Set(grupos.flatMap((g) => ROLES_DE_GRUPO[g]))];
  if (roles.length === 0) return [];
  const filas = await db
    .select({ email: authUsers.email })
    .from(authUsers)
    .where(and(eq(authUsers.active, true), inArray(authUsers.role, roles)));
  const fuera = new Set(menos.map((m) => m.toLowerCase()));
  return [...new Set(filas.map((f) => f.email.toLowerCase()))].filter((e) => !fuera.has(e));
}

async function ajustesActuales(): Promise<AjustesNouvinguts> {
  const [fila] = await db.select({ valor: cfgAjustes.valor }).from(cfgAjustes).where(eq(cfgAjustes.clave, AJUSTES_CLAVE));
  return leerAjustesNouvinguts(fila?.valor);
}

/** Destinatarios de un evento según los ajustes de Proceso (vacío = ese aviso está apagado). */
async function destinatariosDe(evento: EventoAviso, menos: string[]): Promise<string[]> {
  if (!emailConfigurado()) return [];
  const ajustes = await ajustesActuales();
  return correosDeGrupos(ajustes.avisos[evento], menos);
}

function alumnoCorreo(v: NouvingutVista, origen?: string): AlumnoCorreo {
  return { nombre: v.nombre, clase: v.clase, url: urlNouvingut(v.id), origen };
}

/**
 * «Llega uno nuevo»: un correo por apuntado a mano, o uno con la lista entera por
 * sincronización. Nunca lanza: si el correo falla, el alta ya está guardada.
 */
export async function avisarAltas(ids: string[], quien: Firma | null): Promise<void> {
  try {
    if (ids.length === 0) return;
    const para = await destinatariosDe('alta', quien ? [quien.email] : []);
    if (para.length === 0) return;
    const { vistas } = await cargar({ ids }, true);
    if (vistas.length === 0) return;
    const origen = quien ? `Apuntado a mano por ${quien.nombre ?? quien.email}` : 'Alta de la sincronización de Educamos';
    const { subject, html } = correoAlta(
      vistas.map((v) => alumnoCorreo(v.vista, origen)),
      `${appBaseUrl()}/gestion/nouvinguts`,
    );
    await enviar('nouvinguts', { to: para, subject, html, replyTo: quien?.email });
  } catch (error) {
    console.error('Nouvinguts · aviso de alta:', error instanceof Error ? error.message : error);
  }
}

/** Tras tocar un paso: si ha terminado una parte o ya está listo, avisa a quien toque. */
export async function avisarCambio(id: string, antes: ResumenPasos | null, quien: Firma): Promise<void> {
  try {
    if (!antes || !emailConfigurado()) return;
    const { vistas } = await cargar({ id }, true);
    const v = vistas[0]?.vista;
    if (!v || v.estado !== 'abierto') return;
    for (const evento of eventosDeCambio(antes, v.resumen)) {
      const para = await destinatariosDe(evento, [quien.email]);
      if (para.length === 0) continue;
      const a = alumnoCorreo(v);
      const { subject, html } =
        evento === 'listo'
          ? correoListo(a)
          : correoParteTerminada(
              a,
              evento === 'secretaria_terminada' ? 'secretaria' : 'tic',
              v.pasos.filter((p) => p.estado !== 'hecho' && p.estado !== 'no_aplica'),
            );
      await enviar('nouvinguts', { to: para, subject, html, replyTo: quien.email });
    }
  } catch (error) {
    console.error('Nouvinguts · aviso de cambio:', error instanceof Error ? error.message : error);
  }
}

/** Manda una nota por correo, desde el buzón de quien la escribe (le contestan a él). */
export async function mandarNota(id: string, paso: ClavePaso | null, texto: string, correo: CorreoNota, quien: Firma): Promise<void> {
  try {
    const [delGrupo, { vistas }] = await Promise.all([correosDeGrupos(correo.grupos, [quien.email]), cargar({ id }, true)]);
    const para = [...new Set([...delGrupo, ...correo.otros])];
    const v = vistas[0]?.vista;
    if (!v || para.length === 0) return;
    const titulo = paso ? v.pasos.find((p) => p.clave === paso)?.titulo ?? null : null;
    const { subject, html } = correoNota(alumnoCorreo(v), { texto, paso: titulo, autor: quien.nombre ?? quien.email });
    await enviar('nouvinguts', { to: para, subject, html, como: { nombre: quien.nombre ?? quien.email, email: quien.email } });
  } catch (error) {
    console.error('Nouvinguts · nota por correo:', error instanceof Error ? error.message : error);
  }
}

export async function cerrarNouvingut(id: string, cerrar: boolean, firma: Firma): Promise<void> {
  await filaDe(id);
  await db
    .update(nouAlumnos)
    .set(
      cerrar
        ? { estado: 'cerrado', cerradoAt: new Date(), cerradoPor: firma.nombre ?? firma.email, updatedAt: new Date() }
        : { estado: 'abierto', cerradoAt: null, cerradoPor: null, updatedAt: new Date() },
    )
    .where(eq(nouAlumnos.id, id));
}

/** Fecha de matrícula siempre; nombre, apellidos y curso solo mientras espera a Educamos. */
export async function editarNouvingut(
  id: string,
  datos: { fechaMatricula?: string; nombre?: string; apellidos?: string; curso?: string },
): Promise<void> {
  const fila = await filaDe(id);
  const set: Partial<NouAlumno> = { updatedAt: new Date() };
  if (datos.fechaMatricula) set.fechaMatricula = datos.fechaMatricula;
  if (!fila.eduStudentId) {
    if (datos.nombre) set.nombre = datos.nombre;
    if (datos.apellidos) set.apellidos = datos.apellidos;
    if (datos.curso) set.curso = datos.curso;
  }
  await db.update(nouAlumnos).set(set).where(eq(nouAlumnos.id, id));
}

/** Quitar un apuntado por error. Solo lo que aún no está vinculado: lo demás se cierra. */
export async function quitarNouvingut(id: string): Promise<void> {
  const fila = await filaDe(id);
  if (fila.eduStudentId) throw new ErrorNouvinguts('Ya está en Educamos: ciérralo en vez de quitarlo');
  await db.delete(nouAlumnos).where(eq(nouAlumnos.id, id));
}

/**
 * Vincular a mano un apuntado con su ficha central (cuando el emparejado no fue único). Si esa
 * alta ya entró sola como nouvingut, se FUNDEN: el de la sincronización se queda con la fecha,
 * las notas y las marcas del apuntado, y el apuntado desaparece.
 */
export async function vincularNouvingut(id: string, eduStudentId: string): Promise<{ id: string }> {
  const fila = await filaDe(id);
  if (fila.eduStudentId) throw new ErrorNouvinguts('Ya está vinculado');
  const [[alumno], [existente]] = await Promise.all([
    db.select({ id: eduStudents.id }).from(eduStudents).where(eq(eduStudents.id, eduStudentId)).limit(1),
    db.select().from(nouAlumnos).where(eq(nouAlumnos.eduStudentId, eduStudentId)).limit(1),
  ]);
  if (!alumno) throw new ErrorNouvinguts('Ese alumno no existe', 404);
  const ahora = new Date();
  if (!existente) {
    await db.update(nouAlumnos).set({ eduStudentId, avisoVinculo: null, updatedAt: ahora }).where(eq(nouAlumnos.id, id));
    return { id };
  }
  const marcasApuntado = await db.select().from(nouMarcas).where(eq(nouMarcas.nouvingutId, id));
  const statements: BatchItem<'pg'>[] = [db.update(nouNotas).set({ nouvingutId: existente.id }).where(eq(nouNotas.nouvingutId, id))];
  if (marcasApuntado.length) {
    statements.push(
      db
        .insert(nouMarcas)
        .values(marcasApuntado.map((m) => ({ ...m, nouvingutId: existente.id })))
        .onConflictDoNothing({ target: [nouMarcas.nouvingutId, nouMarcas.paso] }),
    );
  }
  await db.batch([
    ...(statements as [BatchItem<'pg'>]),
    db
      .update(nouAlumnos)
      .set({ fechaMatricula: fila.fechaMatricula, origen: 'manual', estado: 'abierto', avisoVinculo: null, updatedAt: ahora })
      .where(eq(nouAlumnos.id, existente.id)),
    db.delete(nouAlumnos).where(eq(nouAlumnos.id, id)),
  ]);
  return { id: existente.id };
}

// ─── Proceso ──────────────────────────────────────────────────────────────────

export async function guardarProceso(
  pasos: { clave: ClavePaso; activo: boolean; responsable: string; desdeCurso: string | null }[],
  ajustes: AjustesNouvinguts,
  email: string,
): Promise<void> {
  const ahora = new Date();
  const statements: BatchItem<'pg'>[] = pasos.map((p, orden) =>
    db
      .insert(nouPasos)
      .values({ clave: p.clave, orden, activo: p.activo, responsable: p.responsable, desdeCurso: p.desdeCurso, updatedBy: email, updatedAt: ahora })
      .onConflictDoUpdate({
        target: nouPasos.clave,
        set: { orden, activo: p.activo, responsable: p.responsable, desdeCurso: p.desdeCurso, updatedBy: email, updatedAt: ahora },
      }),
  );
  statements.push(
    db
      .insert(cfgAjustes)
      .values({ clave: AJUSTES_CLAVE, valor: ajustes, updatedByEmail: email, updatedAt: ahora })
      .onConflictDoUpdate({ target: cfgAjustes.clave, set: { valor: ajustes, updatedByEmail: email, updatedAt: ahora } }),
  );
  await db.batch(statements as [BatchItem<'pg'>, ...BatchItem<'pg'>[]]);
}
