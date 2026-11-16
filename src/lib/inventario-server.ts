// Inventario y aulas: lecturas y escrituras en Neon. Ficha: docs/33-inventario.md.
//
// Todo el módulo cabe en una tanda: ~35 aulas, una veintena de antenas, unos cientos de kits y
// arreglos. Cada pantalla pide `cargarInventario()` entera (una sola ida a Neon con todas las
// consultas en paralelo) y filtra en el cliente, así que buscar, ordenar y cambiar de filtro no
// cuesta ni una petición.
import { and, asc, count, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  eduStudents,
  eduTeachers,
  eduTutorias,
  invAntenas,
  invArreglos,
  invAulas,
  invAv,
  invMobiliario,
  invOcupacion,
  invRobKits,
  invRobModelos,
  invRobRecursos,
} from '@/db/schema';
import { academicYearActual } from '@/lib/constants';
import { hoyEnEspana } from '@/lib/oratorios';
import { nombreProfeBreve } from '@/lib/profes';
import {
  avisoAjusteCursos,
  cartelClase,
  claveClase,
  cursoAnterior,
  cursoPosterior,
  ordenDeNumero,
  siguientesCodigos,
  type AntenaInput,
  type ArregloInput,
  type AulaInput,
  type AvInput,
  type KitInput,
  type MobiliarioInput,
  type ModeloInput,
  type OcupacionInput,
  type RecibirInput,
  type RecursoInput,
} from '@/lib/inventario';

export class ErrorInventario extends Error {}

// ─── Lo que viaja a la pantalla ──────────────────────────────────────────────

export interface AulaInv {
  id: string;
  numero: string | null;
  orden: number;
  piso: string | null;
  nombre: string | null;
  espacioCodigo: string | null;
  notas: string | null;
}

export interface OcupacionInv {
  aulaId: string;
  academicYear: string;
  curso: string | null;
  letra: string | null;
  etiqueta: string | null;
}

export interface AvInv {
  aulaId: string;
  pantalla: string | null;
  marca: string | null;
  audio: string | null;
  appleTv: boolean;
  valoracion: number | null;
  accion: string;
  notas: string | null;
  actualizadoPor: string | null;
  updatedAt: string;
}

export interface MobiliarioInv {
  aulaId: string;
  sillas: number | null;
  mesas: number | null;
  notas: string | null;
  actualizadoPor: string | null;
  updatedAt: string;
}

export interface AntenaInv {
  id: string;
  nombreActual: string;
  nombreNuevo: string | null;
  aulaId: string | null;
  piso: string | null;
  ubicacion: string | null;
  notas: string | null;
}

export interface ArregloInv {
  id: string;
  aulaId: string | null;
  kitId: string | null;
  area: string;
  texto: string;
  prioridad: string;
  hechoAt: string | null;
  hechoPor: string | null;
  creadoPor: string | null;
  createdAt: string;
}

export interface ModeloRob {
  id: string;
  codigoArticulo: string | null;
  nombre: string;
  categoria: string;
  pedidas: number | null;
  prefijo: string | null;
  notas: string | null;
  orden: number;
}

export interface KitRob {
  id: string;
  modeloId: string;
  codigo: string;
  aulaId: string | null;
  estado: string;
  notas: string | null;
  recibidoAt: string | null;
  actualizadoPor: string | null;
  updatedAt: string;
}

export interface RecursoRob {
  id: string;
  modeloId: string;
  titulo: string;
  url: string | null;
  notas: string | null;
}

export interface Tutoria {
  academicYear: string;
  curso: string;
  letra: string | null;
  profeId: string;
  nombre: string;
}

export interface Inventario {
  cursoActual: string;
  hoy: string;
  aulas: AulaInv[];
  ocupacion: OcupacionInv[];
  av: AvInv[];
  mobiliario: MobiliarioInv[];
  antenas: AntenaInv[];
  arreglos: ArregloInv[];
  modelos: ModeloRob[];
  kits: KitRob[];
  recursos: RecursoRob[];
  /** Alumnado activo de cada clase ('3PRI|B' → 23), del curso que corre. */
  alumnos: Record<string, number>;
  tutorias: Tutoria[];
  /** Del 10-jul al 30-sep, el curso que falta por ajustar; si no, null. */
  ajustarCurso: string | null;
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export async function cargarInventario(): Promise<Inventario> {
  const cursoActual = academicYearActual();
  const hoy = hoyEnEspana();
  // Tutorías del curso anterior, del actual y del que viene: la sugerencia de «Clases de cada aula»
  // sigue al tutor de un curso al siguiente.
  const years = [cursoAnterior(cursoActual), cursoActual, cursoPosterior(cursoActual)];
  const [aulas, ocupacion, av, mobiliario, antenas, arreglos, modelos, kits, recursos, alumnos, tutorias] = await Promise.all([
    db
      .select({
        id: invAulas.id,
        numero: invAulas.numero,
        orden: invAulas.orden,
        piso: invAulas.piso,
        nombre: invAulas.nombre,
        espacioCodigo: invAulas.espacioCodigo,
        notas: invAulas.notas,
      })
      .from(invAulas)
      .where(eq(invAulas.activa, true))
      .orderBy(asc(invAulas.orden), asc(invAulas.nombre)),
    db
      .select({
        aulaId: invOcupacion.aulaId,
        academicYear: invOcupacion.academicYear,
        curso: invOcupacion.curso,
        letra: invOcupacion.letra,
        etiqueta: invOcupacion.etiqueta,
      })
      .from(invOcupacion),
    db.select().from(invAv),
    db.select().from(invMobiliario),
    db
      .select({
        id: invAntenas.id,
        nombreActual: invAntenas.nombreActual,
        nombreNuevo: invAntenas.nombreNuevo,
        aulaId: invAntenas.aulaId,
        piso: invAntenas.piso,
        ubicacion: invAntenas.ubicacion,
        notas: invAntenas.notas,
      })
      .from(invAntenas)
      .where(eq(invAntenas.activa, true)),
    db.select().from(invArreglos).orderBy(asc(invArreglos.createdAt)),
    db
      .select({
        id: invRobModelos.id,
        codigoArticulo: invRobModelos.codigoArticulo,
        nombre: invRobModelos.nombre,
        categoria: invRobModelos.categoria,
        pedidas: invRobModelos.pedidas,
        prefijo: invRobModelos.prefijo,
        notas: invRobModelos.notas,
        orden: invRobModelos.orden,
      })
      .from(invRobModelos)
      .where(eq(invRobModelos.activo, true))
      .orderBy(asc(invRobModelos.orden)),
    db.select().from(invRobKits),
    db
      .select({ id: invRobRecursos.id, modeloId: invRobRecursos.modeloId, titulo: invRobRecursos.titulo, url: invRobRecursos.url, notas: invRobRecursos.notas })
      .from(invRobRecursos)
      .orderBy(asc(invRobRecursos.createdAt)),
    db
      .select({ curso: eduStudents.curso, letra: eduStudents.letra, n: count() })
      .from(eduStudents)
      .where(eq(eduStudents.active, true))
      .groupBy(eduStudents.curso, eduStudents.letra),
    db
      .select({
        academicYear: eduTutorias.academicYear,
        curso: eduTutorias.curso,
        letra: eduTutorias.letra,
        profeId: eduTutorias.eduTeacherId,
        nombre: eduTeachers.nombre,
        apellido1: eduTeachers.apellido1,
        apellido2: eduTeachers.apellido2,
        nombreMostrado: eduTeachers.nombreMostrado,
      })
      .from(eduTutorias)
      .innerJoin(eduTeachers, eq(eduTeachers.id, eduTutorias.eduTeacherId))
      .where(inArray(eduTutorias.academicYear, years)),
  ]);

  const hechos = new Set(ocupacion.map((o) => o.academicYear));
  return {
    cursoActual,
    hoy,
    aulas,
    ocupacion,
    av: av.map((a) => ({ ...a, updatedAt: a.updatedAt.toISOString(), createdAt: undefined })) as AvInv[],
    mobiliario: mobiliario.map((m) => ({ ...m, updatedAt: m.updatedAt.toISOString(), createdAt: undefined })) as MobiliarioInv[],
    antenas: antenas.sort((a, b) => (a.piso ?? 'Z').localeCompare(b.piso ?? 'Z') || a.nombreActual.localeCompare(b.nombreActual, 'es', { numeric: true })),
    arreglos: arreglos.map((a) => ({
      id: a.id,
      aulaId: a.aulaId,
      kitId: a.kitId,
      area: a.area,
      texto: a.texto,
      prioridad: a.prioridad,
      hechoAt: iso(a.hechoAt),
      hechoPor: a.hechoPor,
      creadoPor: a.creadoPor,
      createdAt: a.createdAt.toISOString(),
    })),
    modelos,
    kits: kits
      .map((k) => ({
        id: k.id,
        modeloId: k.modeloId,
        codigo: k.codigo,
        aulaId: k.aulaId,
        estado: k.estado,
        notas: k.notas,
        recibidoAt: k.recibidoAt,
        actualizadoPor: k.actualizadoPor,
        updatedAt: k.updatedAt.toISOString(),
      }))
      .sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true })),
    recursos,
    alumnos: Object.fromEntries(alumnos.filter((a) => a.curso).map((a) => [claveClase(a.curso!, a.letra), Number(a.n)])),
    tutorias: tutorias.map((t) => ({
      academicYear: t.academicYear,
      curso: t.curso,
      letra: t.letra,
      profeId: t.profeId,
      nombre: nombreProfeBreve(t),
    })),
    ajustarCurso: avisoAjusteCursos(hoy, (d) => hechos.has(d)),
  };
}

/** Para el escritorio: arreglos urgentes sin hacer y si toca ajustar las clases. Una tanda. */
export async function resumenInventario(): Promise<{ urgentes: number; ajustarCurso: string | null }> {
  const hoy = hoyEnEspana();
  const [[u], years] = await Promise.all([
    db
      .select({ n: count() })
      .from(invArreglos)
      .where(and(eq(invArreglos.prioridad, 'urgente'), isNull(invArreglos.hechoAt))),
    db.selectDistinct({ y: invOcupacion.academicYear }).from(invOcupacion),
  ]);
  const hechos = new Set(years.map((y) => y.y));
  return { urgentes: Number(u?.n ?? 0), ajustarCurso: avisoAjusteCursos(hoy, (d) => hechos.has(d)) };
}

// ─── Escrituras ──────────────────────────────────────────────────────────────

const ahora = () => new Date();

export async function guardarAula(input: AulaInput): Promise<string> {
  if (!input.numero && !input.nombre) throw new ErrorInventario('Pon el número de la puerta o el nombre de la sala');
  const valores = {
    numero: input.numero,
    orden: ordenDeNumero(input.numero),
    piso: input.piso,
    nombre: input.nombre,
    notas: input.notas,
    updatedAt: ahora(),
  };
  try {
    if (input.id) {
      await db.update(invAulas).set(valores).where(eq(invAulas.id, input.id));
      return input.id;
    }
    const [r] = await db.insert(invAulas).values(valores).returning({ id: invAulas.id });
    return r.id;
  } catch (e) {
    if (String((e as Error)?.message).includes('inv_aulas_numero_uq')) throw new ErrorInventario(`Ya hay un aula con el número ${input.numero}`);
    throw e;
  }
}

/** Quitar un aula = dejarla inactiva (lo que colgaba de ella se conserva). */
export async function archivarAula(id: string): Promise<void> {
  await db.update(invAulas).set({ activa: false, numero: null, updatedAt: ahora() }).where(eq(invAulas.id, id));
}

export async function guardarAv(input: AvInput, por: string): Promise<void> {
  const valores = {
    pantalla: input.pantalla,
    marca: input.marca,
    audio: input.audio,
    appleTv: input.appleTv,
    valoracion: input.valoracion,
    accion: input.accion,
    notas: input.notas,
    actualizadoPor: por,
    updatedAt: ahora(),
  };
  await db
    .insert(invAv)
    .values({ aulaId: input.aulaId, ...valores })
    .onConflictDoUpdate({ target: invAv.aulaId, set: valores });
}

export async function guardarMobiliario(input: MobiliarioInput, por: string): Promise<void> {
  const valores = { sillas: input.sillas, mesas: input.mesas, notas: input.notas, actualizadoPor: por, updatedAt: ahora() };
  await db
    .insert(invMobiliario)
    .values({ aulaId: input.aulaId, ...valores })
    .onConflictDoUpdate({ target: invMobiliario.aulaId, set: valores });
}

/**
 * Guarda el reparto de clases de un curso entero: una fila por aula (sin clase ni etiqueta = el
 * aula se queda vacía ese curso). Comprueba que ninguna clase vaya a dos aulas.
 */
export async function guardarOcupacion(input: OcupacionInput, por: string): Promise<void> {
  const vistas = new Set<string>();
  for (const r of input.reparto) {
    if (!r.curso) continue;
    const k = claveClase(r.curso, r.letra);
    if (vistas.has(k)) throw new ErrorInventario(`${cartelClase(r.curso, r.letra)} está en dos aulas`);
    vistas.add(k);
  }
  const conAlgo = input.reparto.filter((r) => r.curso || r.etiqueta);
  const vacias = input.reparto.filter((r) => !r.curso && !r.etiqueta).map((r) => r.aulaId);
  const t = ahora();
  await Promise.all([
    vacias.length
      ? db.delete(invOcupacion).where(and(eq(invOcupacion.academicYear, input.academicYear), inArray(invOcupacion.aulaId, vacias)))
      : null,
    conAlgo.length
      ? db
          .insert(invOcupacion)
          .values(
            conAlgo.map((r) => ({
              aulaId: r.aulaId,
              academicYear: input.academicYear,
              curso: r.curso,
              letra: r.curso ? r.letra : null,
              etiqueta: r.curso ? null : r.etiqueta,
              actualizadoPor: por,
            })),
          )
          .onConflictDoUpdate({
            target: [invOcupacion.aulaId, invOcupacion.academicYear],
            set: {
              curso: sql`excluded.curso`,
              letra: sql`excluded.letra`,
              etiqueta: sql`excluded.etiqueta`,
              actualizadoPor: por,
              updatedAt: t,
            },
          })
      : null,
  ]);
}

export async function guardarAntena(input: AntenaInput, por: string): Promise<void> {
  const valores = {
    nombreActual: input.nombreActual,
    nombreNuevo: input.nombreNuevo,
    aulaId: input.aulaId,
    piso: input.piso,
    ubicacion: input.ubicacion,
    notas: input.notas,
    actualizadoPor: por,
    updatedAt: ahora(),
  };
  try {
    if (input.id) await db.update(invAntenas).set(valores).where(eq(invAntenas.id, input.id));
    else await db.insert(invAntenas).values(valores);
  } catch (e) {
    if (String((e as Error)?.message).includes('inv_antenas_actual_uq')) throw new ErrorInventario(`Ya hay una antena que se llama ${input.nombreActual}`);
    throw e;
  }
}

/** Marca una antena como renombrada: el nombre actual pasa a ser el nuevo. */
export async function antenaRenombrada(id: string, por: string): Promise<void> {
  await db
    .update(invAntenas)
    .set({ nombreActual: sql`coalesce(${invAntenas.nombreNuevo}, ${invAntenas.nombreActual})`, actualizadoPor: por, updatedAt: ahora() })
    .where(eq(invAntenas.id, id));
}

export async function quitarAntena(id: string, por: string): Promise<void> {
  await db.update(invAntenas).set({ activa: false, actualizadoPor: por, updatedAt: ahora() }).where(eq(invAntenas.id, id));
}

export async function guardarArreglo(input: ArregloInput, por: string): Promise<void> {
  const valores = { aulaId: input.aulaId, kitId: input.kitId, area: input.area, texto: input.texto, prioridad: input.prioridad, updatedAt: ahora() };
  if (input.id) await db.update(invArreglos).set(valores).where(eq(invArreglos.id, input.id));
  else await db.insert(invArreglos).values({ ...valores, creadoPor: por });
}

export async function marcarArreglo(id: string, hecho: boolean, por: string): Promise<void> {
  await db
    .update(invArreglos)
    .set({ hechoAt: hecho ? ahora() : null, hechoPor: hecho ? por : null, updatedAt: ahora() })
    .where(eq(invArreglos.id, id));
}

/** Borrar un arreglo: solo para lo apuntado por error (lo hecho se marca, no se borra). */
export async function borrarArreglo(id: string): Promise<void> {
  await db.delete(invArreglos).where(eq(invArreglos.id, id));
}

// ─── Robótica ────────────────────────────────────────────────────────────────

export async function guardarModelo(input: ModeloInput): Promise<string> {
  const valores = {
    nombre: input.nombre,
    codigoArticulo: input.codigoArticulo,
    categoria: input.categoria,
    pedidas: input.pedidas,
    prefijo: input.prefijo?.toUpperCase() ?? null,
    notas: input.notas,
    updatedAt: ahora(),
  };
  try {
    if (input.id) {
      await db.update(invRobModelos).set(valores).where(eq(invRobModelos.id, input.id));
      return input.id;
    }
    const [{ max }] = await db.select({ max: sql<number>`coalesce(max(${invRobModelos.orden}), 0)` }).from(invRobModelos);
    const [r] = await db
      .insert(invRobModelos)
      .values({ ...valores, orden: Number(max) + 1 })
      .returning({ id: invRobModelos.id });
    return r.id;
  } catch (e) {
    if (String((e as Error)?.message).includes('inv_rob_modelos_nombre_uq')) throw new ErrorInventario(`Ya hay un material que se llama «${input.nombre}»`);
    throw e;
  }
}

export async function archivarModelo(id: string): Promise<void> {
  const [k] = await db.select({ n: count() }).from(invRobKits).where(eq(invRobKits.modeloId, id));
  if (Number(k?.n ?? 0) > 0) throw new ErrorInventario('Tiene kits numerados: dalos de baja uno a uno antes de quitarlo');
  await db.update(invRobModelos).set({ activo: false, updatedAt: ahora() }).where(eq(invRobModelos.id, id));
}

/** Ha llegado material: crea `cantidad` kits numerados a continuación (L5, L6…). */
export async function recibirKits(input: RecibirInput, por: string): Promise<string[]> {
  const prefijo = input.prefijo.trim().toUpperCase();
  const existentes = await db.select({ codigo: invRobKits.codigo }).from(invRobKits);
  const codigos = siguientesCodigos(
    prefijo,
    existentes.map((e) => e.codigo),
    input.cantidad,
  );
  const hoy = hoyEnEspana();
  await Promise.all([
    db.insert(invRobKits).values(
      codigos.map((codigo) => ({ modeloId: input.modeloId, codigo, aulaId: input.aulaId, estado: 'ok', recibidoAt: hoy, actualizadoPor: por })),
    ),
    db
      .update(invRobModelos)
      .set({ prefijo, updatedAt: ahora() })
      .where(and(eq(invRobModelos.id, input.modeloId), isNull(invRobModelos.prefijo))),
  ]);
  return codigos;
}

export async function guardarKit(input: KitInput, por: string): Promise<void> {
  try {
    await db
      .update(invRobKits)
      .set({ codigo: input.codigo.toUpperCase(), aulaId: input.aulaId, estado: input.estado, notas: input.notas, actualizadoPor: por, updatedAt: ahora() })
      .where(eq(invRobKits.id, input.id));
  } catch (e) {
    if (String((e as Error)?.message).includes('inv_rob_kits_codigo_uq')) throw new ErrorInventario(`Ya hay un kit con el código ${input.codigo}`);
    throw e;
  }
}

/** Mover varios kits a un aula de una vez. */
export async function moverKits(ids: string[], aulaId: string | null, por: string): Promise<void> {
  if (ids.length === 0) return;
  await db.update(invRobKits).set({ aulaId, actualizadoPor: por, updatedAt: ahora() }).where(inArray(invRobKits.id, ids));
}

/** Deshacer una recepción: solo kits sin arreglos apuntados (si no, mejor darlos de baja). */
export async function borrarKit(id: string): Promise<void> {
  const [a] = await db.select({ n: count() }).from(invArreglos).where(eq(invArreglos.kitId, id));
  if (Number(a?.n ?? 0) > 0) throw new ErrorInventario('Tiene arreglos apuntados: dalo de baja en vez de borrarlo');
  await db.delete(invRobKits).where(eq(invRobKits.id, id));
}

export async function guardarRecurso(input: RecursoInput, por: string): Promise<void> {
  const titulo = input.titulo ?? input.url;
  if (!titulo) throw new ErrorInventario('Pon un título o pega un enlace');
  await db.insert(invRobRecursos).values({ modeloId: input.modeloId, titulo, url: input.url, notas: input.notas, creadoPor: por });
}

export async function borrarRecurso(id: string): Promise<void> {
  await db.delete(invRobRecursos).where(eq(invRobRecursos.id, id));
}
