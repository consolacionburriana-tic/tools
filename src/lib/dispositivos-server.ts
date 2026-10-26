// Dispositivos 1:1: todo lo que toca Neon. Ficha: docs/29-dispositivos.md.
//
// Dos reglas que mandan sobre todo lo de aquí:
//  1. No se copia nada del alumno: curso, clase y nombre se leen de `edu_students` siempre.
//  2. Quién tiene un iPad del cole vive en el iPad (`dis_aparatos.edu_student_id` /
//     `edu_teacher_id`). El alumno prestado no guarda «el S12»: se busca qué aparato le tiene.
//
// Los iPads del cole para el alumnado son UN solo lote, el de sustitución (David, 20-oct-2026:
// «los de préstamo son de sustitución»): el mismo S3 sirve para prestarlo todo el curso o para
// dejarlo mientras arreglan el de un alumno. Qué es en cada caso lo dice la modalidad del alumno.
import { and, desc, eq, inArray, isNotNull, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  asmEntregas,
  disAlumnos,
  disAparatos,
  disCargadores,
  disHistorial,
  disModelos,
  eduStudents,
  eduTeachers,
  eduTutorias,
  horAsignacionGrupos,
  horAsignacionProfes,
} from '@/db/schema';
import { academicYearActual } from '@/lib/constants';
import { claseLarga } from '@/lib/alumnado';
import { entraEnAlcance, labelCurso, OPCIONES_POR_DEFECTO } from '@/lib/autoasm-construir';
import { compararClases, type Etapa } from '@/lib/cursos';
import { nombresDe } from '@/lib/personas';
import {
  compararCodigos,
  ESTADO_APARATO_LABEL,
  ESTADO_CARGADOR_LABEL,
  esUso,
  etiquetaModelo,
  llevaCompra,
  MODALIDAD_LABEL,
  noSeLoLlevaACasa,
  normalizarCodigo,
  profeLeToca,
  siguientesCodigos,
  textoEstado,
  USO_LABEL,
  type EstadoAlumnoInput,
  type EstadoAparato,
  type EstadoCargador,
  type Modalidad,
  type Uso,
} from '@/lib/dispositivos';

export interface Firma {
  email: string;
  nombre: string | null;
}

export class ErrorDispositivos extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

// ─── Tipos que viajan a la pantalla ───────────────────────────────────────────

export interface EstadoDis {
  modalidad: Modalidad;
  cursoCompra: string | null;
  aCasa: boolean | null;
  firmadoAt: string | null;
  hermanoId: string | null;
  modeloId: string | null;
  numeroSerie: string | null;
  notas: string | null;
  actualizadoPor: string | null;
  updatedAt: string;
}

export interface HermanoDis {
  id: string;
  nombre: string;
  /** Su clase, o «ya no está en el cole». */
  clase: string;
  /** Su curso de compra, si lo tiene apuntado aquí: es lo que hereda el pequeño. */
  cursoCompra: string | null;
}

export interface AlumnoDis {
  id: string;
  nia: string | null;
  nombre: string;
  apellidos: string;
  curso: string;
  letra: string | null;
  clase: string;
  estado: EstadoDis | null;
  hermanos: HermanoDis[];
}

export interface TitularDis {
  tipo: 'alumno' | 'profe';
  id: string;
  nombre: string;
  /** La clase del alumno, o el correo del profe. */
  detalle: string;
  /** false = de baja en el cole: tiene un iPad del cole sin devolver. */
  activo: boolean;
}

export interface CargadorDis {
  id: string;
  /** Lo que lleva escrito el cargador: suele ser el código de su iPad. */
  codigo: string;
  estado: EstadoCargador;
  notas: string | null;
}

export interface AparatoDis {
  id: string;
  uso: Uso;
  codigo: string;
  modeloId: string | null;
  numeroSerie: string | null;
  estado: EstadoAparato;
  notas: string | null;
  /** Su cargador, o null si no tiene (o no se sabe). */
  cargador: CargadorDis | null;
  titular: TitularDis | null;
  asignadoAt: string | null;
}

export interface ProfeDis {
  id: string;
  nombre: string;
  email: string | null;
  /** Le toca iPad del cole: clase o tutoría desde 5º EP, o ESO en su ficha. */
  leToca: boolean;
}

export interface ModeloDis {
  id: string;
  nombre: string;
  capacidadGb: number | null;
  notas: string | null;
  activo: boolean;
  etiqueta: string;
  /** Cuántos iPads (del cole y de alumnos) lo usan: un modelo en uso no se borra, se archiva. */
  enUso: number;
}

export interface AlcanceDis {
  /** Curso mínimo, o null = todo el centro. */
  desdeCurso: string | null;
  /** «Desde 6º EP», ya escrito. */
  etiqueta: string;
  /** De dónde sale: la última subida a ASM, la última entrega o lo de por defecto. */
  origen: string;
}

export interface PanelDispositivos {
  cursoActual: string;
  alcance: AlcanceDis;
  alumnos: AlumnoDis[];
  aparatos: AparatoDis[];
  profes: ProfeDis[];
  modelos: ModeloDis[];
}

// ─── El alcance: el mismo que AUTOASM ─────────────────────────────────────────

/**
 * Quién sale en la lista: los mismos que en AUTOASM (David, 20-oct-2026). El «Alumnado desde»
 * de la última subida a ASM del curso; sin subidas, el de la última entrega; y si no hay
 * ninguna, el de por defecto de AUTOASM.
 */
export async function alcanceDispositivos(academicYear = academicYearActual()): Promise<AlcanceDis> {
  const [subida, entrega] = await Promise.all([
    db
      .select({ desdeCurso: asmEntregas.desdeCurso, at: asmEntregas.createdAt })
      .from(asmEntregas)
      .where(and(eq(asmEntregas.academicYear, academicYear), sql`${asmEntregas.modo} in ('ftp','manual')`, eq(asmEntregas.estado, 'ok')))
      .orderBy(desc(asmEntregas.createdAt))
      .limit(1),
    db.select({ desdeCurso: asmEntregas.desdeCurso }).from(asmEntregas).orderBy(desc(asmEntregas.createdAt)).limit(1),
  ]);
  const fecha = (d: Date) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  if (subida[0]) {
    return { desdeCurso: subida[0].desdeCurso, etiqueta: etiquetaAlcance(subida[0].desdeCurso), origen: `la subida a ASM del ${fecha(subida[0].at)}` };
  }
  if (entrega[0]) {
    return { desdeCurso: entrega[0].desdeCurso, etiqueta: etiquetaAlcance(entrega[0].desdeCurso), origen: 'la última entrega de AUTOASM' };
  }
  const d = OPCIONES_POR_DEFECTO.desdeCurso;
  return { desdeCurso: d, etiqueta: etiquetaAlcance(d), origen: 'lo de por defecto de AUTOASM' };
}

function etiquetaAlcance(desde: string | null): string {
  return desde ? `Desde ${labelCurso(desde)}` : 'Todo el centro';
}

// ─── Lecturas ─────────────────────────────────────────────────────────────────

const iso = (d: Date | null) => (d ? d.toISOString() : null);

function estadoDe(f: typeof disAlumnos.$inferSelect): EstadoDis {
  return {
    modalidad: f.modalidad as Modalidad,
    cursoCompra: f.cursoCompra,
    aCasa: f.aCasa,
    firmadoAt: f.firmadoAt,
    hermanoId: f.hermanoId,
    modeloId: f.modeloId,
    numeroSerie: f.numeroSerie,
    notas: f.notas,
    actualizadoPor: f.actualizadoPor,
    updatedAt: f.updatedAt.toISOString(),
  };
}

const COLS_ALUMNO = {
  id: eduStudents.id,
  nia: eduStudents.nia,
  nombre: eduStudents.nombre,
  apellido1: eduStudents.apellido1,
  apellido2: eduStudents.apellido2,
  curso: eduStudents.curso,
  letra: eduStudents.letra,
  familiaId: eduStudents.familiaId,
  active: eduStudents.active,
};

/** Los iPads del cole con su titular ya escrito. Sin filtro, todos. */
async function leerAparatos(ids?: string[]): Promise<AparatoDis[]> {
  if (ids && ids.length === 0) return [];
  const filas = await db
    .select({
      a: disAparatos,
      alNombre: eduStudents.nombre,
      alApellido1: eduStudents.apellido1,
      alApellido2: eduStudents.apellido2,
      alCurso: eduStudents.curso,
      alLetra: eduStudents.letra,
      alActivo: eduStudents.active,
      prNombre: eduTeachers.nombre,
      prApellido1: eduTeachers.apellido1,
      prApellido2: eduTeachers.apellido2,
      prMostrado: eduTeachers.nombreMostrado,
      prEmail: eduTeachers.email,
      prActivo: eduTeachers.active,
    })
    .from(disAparatos)
    .leftJoin(eduStudents, eq(eduStudents.id, disAparatos.eduStudentId))
    .leftJoin(eduTeachers, eq(eduTeachers.id, disAparatos.eduTeacherId))
    .where(ids ? inArray(disAparatos.id, ids) : undefined);
  const cargadores = await db
    .select()
    .from(disCargadores)
    .where(ids ? inArray(disCargadores.aparatoId, ids) : undefined);
  const cargadorDe = new Map(
    cargadores.map((c): [string, CargadorDis] => [
      c.aparatoId,
      { id: c.id, codigo: c.codigo, estado: c.estado as EstadoCargador, notas: c.notas },
    ]),
  );

  return filas
    .map(({ a, ...t }): AparatoDis => {
      let titular: TitularDis | null = null;
      if (a.eduStudentId) {
        titular = {
          tipo: 'alumno',
          id: a.eduStudentId,
          nombre: nombresDe({ nombre: t.alNombre, apellido1: t.alApellido1, apellido2: t.alApellido2 }).completo,
          detalle: claseLarga(t.alCurso, t.alLetra),
          activo: t.alActivo ?? false,
        };
      } else if (a.eduTeacherId) {
        titular = {
          tipo: 'profe',
          id: a.eduTeacherId,
          nombre: nombresDe({ nombre: t.prNombre, apellido1: t.prApellido1, apellido2: t.prApellido2, nombreMostrado: t.prMostrado }).usual,
          detalle: t.prEmail ?? '',
          activo: t.prActivo ?? false,
        };
      }
      return {
        id: a.id,
        uso: esUso(a.uso) ? a.uso : 'sustitucion',
        codigo: a.codigo,
        modeloId: a.modeloId,
        numeroSerie: a.numeroSerie,
        estado: a.estado as EstadoAparato,
        notas: a.notas,
        cargador: cargadorDe.get(a.id) ?? null,
        titular,
        asignadoAt: iso(a.asignadoAt),
      };
    })
    .sort((x, y) => compararCodigos(x.codigo, y.codigo));
}

async function leerModelos(): Promise<ModeloDis[]> {
  const [modelos, usoAparatos, usoAlumnos] = await Promise.all([
    db.select().from(disModelos),
    db.select({ id: disAparatos.modeloId, n: sql<number>`count(*)::int` }).from(disAparatos).where(isNotNull(disAparatos.modeloId)).groupBy(disAparatos.modeloId),
    db.select({ id: disAlumnos.modeloId, n: sql<number>`count(*)::int` }).from(disAlumnos).where(isNotNull(disAlumnos.modeloId)).groupBy(disAlumnos.modeloId),
  ]);
  const uso = new Map<string, number>();
  for (const u of [...usoAparatos, ...usoAlumnos]) if (u.id) uso.set(u.id, (uso.get(u.id) ?? 0) + u.n);
  return modelos
    .map((m) => ({
      id: m.id,
      nombre: m.nombre,
      capacidadGb: m.capacidadGb,
      notas: m.notas,
      activo: m.activo,
      etiqueta: etiquetaModelo(m),
      enUso: uso.get(m.id) ?? 0,
    }))
    .sort((a, b) => Number(b.activo) - Number(a.activo) || a.etiqueta.localeCompare(b.etiqueta, 'es', { numeric: true }));
}

/** El profesorado activo, y a quién le toca iPad del cole (desde 5º EP). */
async function leerProfes(academicYear: string): Promise<ProfeDis[]> {
  const [profes, horario, tutorias] = await Promise.all([
    db
      .select({
        id: eduTeachers.id,
        nombre: eduTeachers.nombre,
        apellido1: eduTeachers.apellido1,
        apellido2: eduTeachers.apellido2,
        nombreMostrado: eduTeachers.nombreMostrado,
        email: eduTeachers.email,
        etapa: eduTeachers.etapa,
        etapas: eduTeachers.etapas,
      })
      .from(eduTeachers)
      .where(eq(eduTeachers.active, true)),
    db
      .selectDistinct({ id: horAsignacionProfes.eduTeacherId, curso: horAsignacionGrupos.curso })
      .from(horAsignacionProfes)
      .innerJoin(horAsignacionGrupos, eq(horAsignacionGrupos.asignacionId, horAsignacionProfes.asignacionId)),
    db.select({ id: eduTutorias.eduTeacherId, curso: eduTutorias.curso }).from(eduTutorias).where(eq(eduTutorias.academicYear, academicYear)),
  ]);
  const cursos = new Map<string, string[]>();
  for (const f of [...horario, ...tutorias]) cursos.set(f.id, [...(cursos.get(f.id) ?? []), f.curso]);
  return profes
    .map((p) => {
      const etapas: (Etapa | string)[] = p.etapas ?? (p.etapa ? [p.etapa] : []);
      return {
        id: p.id,
        nombre: nombresDe(p).usual,
        email: p.email,
        leToca: profeLeToca(cursos.get(p.id) ?? [], etapas),
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/** El panel entero, en una tanda (más la de hermanos, que depende del alumnado). */
export async function panelDispositivos(): Promise<PanelDispositivos> {
  const cursoActual = academicYearActual();
  const [alcance, todos, estados, aparatos, profes, modelos] = await Promise.all([
    alcanceDispositivos(cursoActual),
    db.select(COLS_ALUMNO).from(eduStudents).where(eq(eduStudents.active, true)),
    db.select().from(disAlumnos),
    leerAparatos(),
    leerProfes(cursoActual),
    leerModelos(),
  ]);
  const porId = new Map(estados.map((e) => [e.eduStudentId, e]));
  const enAlcance = todos.filter((a) => a.curso && entraEnAlcance(a.curso, alcance.desdeCurso));

  // Hermanos: por familia, contando a los que ya no están (el mayor que acabó 4º de ESO y le
  // dejó el iPad al pequeño es justo el caso).
  const familias = [...new Set(enAlcance.map((a) => a.familiaId).filter((f): f is string => Boolean(f)))];
  const parientes = familias.length
    ? await db.select(COLS_ALUMNO).from(eduStudents).where(inArray(eduStudents.familiaId, familias))
    : [];
  const porFamilia = new Map<string, typeof parientes>();
  for (const p of parientes) if (p.familiaId) porFamilia.set(p.familiaId, [...(porFamilia.get(p.familiaId) ?? []), p]);

  const alumnos = enAlcance
    .map((a): AlumnoDis => {
      const n = nombresDe(a);
      const fila = porId.get(a.id);
      return {
        id: a.id,
        nia: a.nia,
        nombre: n.completo,
        apellidos: n.apellidos,
        curso: a.curso!,
        letra: a.letra,
        clase: claseLarga(a.curso, a.letra),
        estado: fila ? estadoDe(fila) : null,
        hermanos: (a.familiaId ? porFamilia.get(a.familiaId) ?? [] : [])
          .filter((h) => h.id !== a.id)
          .map((h) => ({
            id: h.id,
            nombre: nombresDe(h).completo,
            clase: h.active ? claseLarga(h.curso, h.letra) : 'ya no está en el cole',
            cursoCompra: porId.get(h.id)?.cursoCompra ?? null,
          })),
      };
    })
    .sort((x, y) => compararClases(x, y) || x.apellidos.localeCompare(y.apellidos, 'es') || x.nombre.localeCompare(y.nombre, 'es'));

  return { cursoActual, alcance, alumnos, aparatos, profes, modelos };
}

// ─── Historial ────────────────────────────────────────────────────────────────

export interface LineaHistorial {
  texto: string;
  porNombre: string | null;
  at: string;
}

type NuevaLinea = { eduStudentId?: string | null; eduTeacherId?: string | null; aparatoId?: string | null; texto: string };

async function apuntar(lineas: NuevaLinea[], firma: Firma): Promise<void> {
  if (lineas.length === 0) return;
  await db.insert(disHistorial).values(
    lineas.map((l) => ({
      eduStudentId: l.eduStudentId ?? null,
      eduTeacherId: l.eduTeacherId ?? null,
      aparatoId: l.aparatoId ?? null,
      texto: l.texto,
      por: firma.email,
      porNombre: firma.nombre,
    })),
  );
}

export async function historial(filtro: { alumno?: string; aparato?: string; profe?: string }): Promise<LineaHistorial[]> {
  const donde = filtro.alumno
    ? eq(disHistorial.eduStudentId, filtro.alumno)
    : filtro.aparato
      ? eq(disHistorial.aparatoId, filtro.aparato)
      : filtro.profe
        ? eq(disHistorial.eduTeacherId, filtro.profe)
        : null;
  if (!donde) return [];
  const filas = await db.select().from(disHistorial).where(donde).orderBy(desc(disHistorial.at)).limit(50);
  return filas.map((f) => ({ texto: f.texto, porNombre: f.porNombre ?? f.por, at: f.at.toISOString() }));
}

// ─── Estado de un alumno ──────────────────────────────────────────────────────

export interface ResultadoAlumno {
  estado: EstadoDis | null;
  /** Los iPads del cole que han cambiado de manos (dados o devueltos). */
  aparatos: AparatoDis[];
}

/**
 * Guarda cómo tiene el iPad un alumno. `modalidad: null` lo devuelve a «sin informar».
 *
 * El iPad del cole que tenga: si DEJA de estar prestado, vuelve al almacén. Si no lo estaba,
 * no se toca: es uno de sustitución que se le ha dejado mientras arreglan el suyo, y eso no
 * tiene que ver con cómo lo tiene.
 */
export async function guardarEstadoAlumno(input: EstadoAlumnoInput, firma: Firma): Promise<ResultadoAlumno> {
  const cursoActual = academicYearActual();
  const [[alumno], [antes], prestamos] = await Promise.all([
    db.select(COLS_ALUMNO).from(eduStudents).where(eq(eduStudents.id, input.eduStudentId)).limit(1),
    db.select().from(disAlumnos).where(eq(disAlumnos.eduStudentId, input.eduStudentId)).limit(1),
    db
      .select({ id: disAparatos.id, codigo: disAparatos.codigo })
      .from(disAparatos)
      .where(and(eq(disAparatos.eduStudentId, input.eduStudentId), eq(disAparatos.uso, 'sustitucion'))),
  ]);
  const eraPrestado = antes?.modalidad === 'prestado';
  if (!alumno || !alumno.active) throw new ErrorDispositivos('Ese alumno no está en el cole', 404);
  const lineas: NuevaLinea[] = [];
  const tocados = new Set<string>();

  const devolverPrestamos = async (motivo: string, menos?: string) => {
    const ids = prestamos.filter((p) => p.id !== menos).map((p) => p.id);
    if (ids.length === 0) return;
    await db
      .update(disAparatos)
      .set({ eduStudentId: null, asignadoAt: null, updatedAt: new Date(), actualizadoPor: firma.email })
      .where(inArray(disAparatos.id, ids));
    for (const p of prestamos.filter((x) => ids.includes(x.id))) {
      tocados.add(p.id);
      lineas.push({ aparatoId: p.id, eduStudentId: alumno.id, texto: `${p.codigo} vuelve al almacén (${motivo})` });
    }
  };

  if (input.modalidad === null) {
    if (antes) await db.delete(disAlumnos).where(eq(disAlumnos.eduStudentId, alumno.id));
    if (eraPrestado) await devolverPrestamos('vuelve a sin informar');
    lineas.push({ eduStudentId: alumno.id, texto: 'Sin informar' });
    await apuntar(lineas, firma);
    return { estado: null, aparatos: await leerAparatos([...tocados]) };
  }

  const modalidad = input.modalidad;
  // Lo que no viene se queda como estaba (si la modalidad no cambia); lo que viene, manda.
  const igual = antes?.modalidad === modalidad;
  const vale = <K extends keyof typeof disAlumnos.$inferSelect>(k: K, v: unknown) =>
    v !== undefined ? v : igual && antes ? antes[k] : null;

  let cursoCompra = llevaCompra(modalidad) ? (vale('cursoCompra', input.cursoCompra) as string | null) : null;
  let hermanoId = modalidad === 'hermano' ? (vale('hermanoId', input.hermanoId) as string | null) : null;
  if (hermanoId) {
    const [h] = await db.select({ id: eduStudents.id }).from(eduStudents).where(eq(eduStudents.id, hermanoId)).limit(1);
    if (!h || hermanoId === alumno.id) throw new ErrorDispositivos('Ese hermano no existe');
    // El iPad heredado trae el curso de compra del hermano (David, 20-oct-2026).
    if (!cursoCompra) {
      const [suyo] = await db.select({ c: disAlumnos.cursoCompra }).from(disAlumnos).where(eq(disAlumnos.eduStudentId, hermanoId)).limit(1);
      cursoCompra = suyo?.c ?? null;
    }
  } else hermanoId = null;
  const aCasa = modalidad === 'prestado' ? Boolean(vale('aCasa', input.aCasa)) : null;
  const firmadoAt = modalidad === 'prestado' ? (vale('firmadoAt', input.firmadoAt) as string | null) : null;

  const valores = {
    modalidad,
    tipo: 'ipad',
    cursoCompra,
    aCasa,
    firmadoAt,
    hermanoId,
    modeloId: vale('modeloId', input.modeloId) as string | null,
    numeroSerie: (vale('numeroSerie', input.numeroSerie) as string | null) || null,
    notas: (vale('notas', input.notas) as string | null) || null,
    actualizadoPor: firma.email,
    updatedAt: new Date(),
  };
  const [fila] = await db
    .insert(disAlumnos)
    .values({ eduStudentId: alumno.id, ...valores })
    .onConflictDoUpdate({ target: disAlumnos.eduStudentId, set: valores })
    .returning();

  // El iPad del cole: se da el que se pide; si deja de ser prestado, vuelve al almacén.
  if (modalidad !== 'prestado') {
    if (eraPrestado) await devolverPrestamos(`ahora es ${MODALIDAD_LABEL[modalidad].toLowerCase()}`);
  } else if (input.aparatoId === null) {
    await devolverPrestamos('se le quita');
  } else if (input.aparatoId) {
    const [uso] = await db.select({ uso: disAparatos.uso }).from(disAparatos).where(eq(disAparatos.id, input.aparatoId)).limit(1);
    if (uso && uso.uso !== 'sustitucion') throw new ErrorDispositivos('A un alumno se le presta uno de sustitución');
    const dado = await darAparato(input.aparatoId, { tipo: 'alumno', id: alumno.id }, firma, lineas);
    tocados.add(dado);
    // Un alumno, un iPad del cole: si tenía otro (el de una reparación), vuelve.
    await devolverPrestamos('se le da otro', dado);
  }

  const codigo = (await leerAparatos([...tocados, ...prestamos.map((p) => p.id)])).find(
    (a) => a.uso === 'sustitucion' && a.titular?.id === alumno.id,
  )?.codigo;
  const texto = textoEstado({ modalidad, cursoCompra, aCasa, aparato: codigo }, cursoActual);
  if (!antes || textoEstado({ modalidad: antes.modalidad as Modalidad, cursoCompra: antes.cursoCompra, aCasa: antes.aCasa }, cursoActual) !== texto || input.aparatoId !== undefined) {
    lineas.push({ eduStudentId: alumno.id, texto });
  }
  await apuntar(lineas, firma);
  return { estado: estadoDe(fila), aparatos: await leerAparatos([...tocados]) };
}

/**
 * «A todos estos»: la misma modalidad (y curso de compra) a varios alumnos de una vez, para el
 * primer volcado. Solo toca a los que piden; los prestados se quedan sin iPad asignado.
 */
export async function guardarMasivo(
  input: { eduStudentIds: string[]; modalidad: Modalidad; cursoCompra?: string | null; aCasa?: boolean | null },
  firma: Firma,
): Promise<{ estados: Record<string, EstadoDis>; aparatos: AparatoDis[] }> {
  const ids = [...new Set(input.eduStudentIds)];
  const [vivos, prestados] = await Promise.all([
    db.select({ id: eduStudents.id }).from(eduStudents).where(and(inArray(eduStudents.id, ids), eq(eduStudents.active, true))),
    db.select({ id: disAlumnos.eduStudentId }).from(disAlumnos).where(and(inArray(disAlumnos.eduStudentId, ids), eq(disAlumnos.modalidad, 'prestado'))),
  ]);
  const validos = vivos.map((v) => v.id);
  const eranPrestados = prestados.map((p) => p.id).filter((id) => validos.includes(id));
  if (validos.length === 0) return { estados: {}, aparatos: [] };

  const valores = {
    modalidad: input.modalidad,
    tipo: 'ipad',
    cursoCompra: llevaCompra(input.modalidad) ? input.cursoCompra ?? null : null,
    aCasa: input.modalidad === 'prestado' ? Boolean(input.aCasa) : null,
    firmadoAt: null,
    hermanoId: null,
    actualizadoPor: firma.email,
    updatedAt: new Date(),
  };
  const filas = await db
    .insert(disAlumnos)
    .values(validos.map((id) => ({ eduStudentId: id, ...valores })))
    .onConflictDoUpdate({
      target: disAlumnos.eduStudentId,
      set: {
        modalidad: sql`excluded.modalidad`,
        cursoCompra: sql`excluded.curso_compra`,
        aCasa: sql`excluded.a_casa`,
        firmadoAt: sql`excluded.firmado_at`,
        hermanoId: sql`excluded.hermano_id`,
        actualizadoPor: sql`excluded.actualizado_por`,
        updatedAt: sql`excluded.updated_at`,
      },
    })
    .returning();

  // Los que dejan de ser prestados devuelven el iPad del cole que tenían prestado.
  let devueltos: string[] = [];
  if (input.modalidad !== 'prestado' && eranPrestados.length) {
    const tenian = await db
      .select({ id: disAparatos.id, codigo: disAparatos.codigo, alumno: disAparatos.eduStudentId })
      .from(disAparatos)
      .where(and(inArray(disAparatos.eduStudentId, eranPrestados), eq(disAparatos.uso, 'sustitucion')));
    devueltos = tenian.map((t) => t.id);
    if (devueltos.length) {
      await db
        .update(disAparatos)
        .set({ eduStudentId: null, asignadoAt: null, updatedAt: new Date(), actualizadoPor: firma.email })
        .where(inArray(disAparatos.id, devueltos));
    }
    await apuntar(
      tenian.map((t) => ({ aparatoId: t.id, eduStudentId: t.alumno, texto: `${t.codigo} vuelve al almacén (cambio en bloque)` })),
      firma,
    );
  }
  const cursoActual = academicYearActual();
  await apuntar(
    filas.map((f) => ({
      eduStudentId: f.eduStudentId,
      texto: `${textoEstado({ modalidad: input.modalidad, cursoCompra: f.cursoCompra, aCasa: f.aCasa }, cursoActual)} (en bloque)`,
    })),
    firma,
  );
  return {
    estados: Object.fromEntries(filas.map((f) => [f.eduStudentId, estadoDe(f)])),
    aparatos: await leerAparatos(devueltos),
  };
}

// ─── iPads del cole ───────────────────────────────────────────────────────────

/** Le da un iPad del cole a alguien. Devuelve el id. No lo quita a quien lo tenga: avisa. */
async function darAparato(
  aparatoId: string,
  a: { tipo: 'alumno' | 'profe'; id: string },
  firma: Firma,
  lineas: NuevaLinea[],
): Promise<string> {
  const [ap] = await db.select().from(disAparatos).where(eq(disAparatos.id, aparatoId)).limit(1);
  if (!ap) throw new ErrorDispositivos('Ese iPad no existe', 404);
  if (ap.estado === 'baja') throw new ErrorDispositivos(`El ${ap.codigo} está de baja`);
  // Cada uso es para quien es: los de profesorado, para profes; los de sustitución, para alumnos.
  if ((a.tipo === 'profe') !== (ap.uso === 'profesorado')) {
    throw new ErrorDispositivos(a.tipo === 'profe' ? `El ${ap.codigo} no es de profesorado` : `El ${ap.codigo} es de profesorado`);
  }
  const yaEsSuyo = a.tipo === 'alumno' ? ap.eduStudentId === a.id : ap.eduTeacherId === a.id;
  if (yaEsSuyo) return ap.id;
  if (ap.eduStudentId || ap.eduTeacherId) {
    throw new ErrorDispositivos(`El ${ap.codigo} ya lo tiene otra persona: devuélvelo antes desde «iPads del cole»`, 409);
  }
  await db
    .update(disAparatos)
    .set({
      eduStudentId: a.tipo === 'alumno' ? a.id : null,
      eduTeacherId: a.tipo === 'profe' ? a.id : null,
      asignadoAt: new Date(),
      updatedAt: new Date(),
      actualizadoPor: firma.email,
    })
    .where(eq(disAparatos.id, ap.id));
  const nombre = await nombreDe(a);
  lineas.push({
    aparatoId: ap.id,
    eduStudentId: a.tipo === 'alumno' ? a.id : null,
    eduTeacherId: a.tipo === 'profe' ? a.id : null,
    texto: `${ap.codigo} a ${nombre}`,
  });
  return ap.id;
}

async function nombreDe(a: { tipo: 'alumno' | 'profe'; id: string }): Promise<string> {
  if (a.tipo === 'alumno') {
    const [s] = await db.select(COLS_ALUMNO).from(eduStudents).where(eq(eduStudents.id, a.id)).limit(1);
    if (!s) throw new ErrorDispositivos('Ese alumno no existe', 404);
    return nombresDe(s).completo;
  }
  const [p] = await db
    .select({ nombre: eduTeachers.nombre, apellido1: eduTeachers.apellido1, apellido2: eduTeachers.apellido2, nombreMostrado: eduTeachers.nombreMostrado })
    .from(eduTeachers)
    .where(eq(eduTeachers.id, a.id))
    .limit(1);
  if (!p) throw new ErrorDispositivos('Ese profe no existe', 404);
  return nombresDe(p).usual;
}

/** Alta de iPads del cole: N en serie, o uno por cada nº de serie pegado. */
export async function altaAparatos(
  input: { uso: Uso; modeloId?: string | null; cantidad?: number; series?: string[]; notas?: string | null; conCargador?: boolean },
  firma: Firma,
): Promise<AparatoDis[]> {
  const existentes = await db.select({ codigo: disAparatos.codigo, serie: disAparatos.numeroSerie }).from(disAparatos);
  const series = input.series ?? [];
  if (series.length) {
    const ya = new Set(existentes.map((e) => e.serie?.toUpperCase()).filter(Boolean));
    const repetidas = series.filter((s) => ya.has(s.toUpperCase()));
    if (repetidas.length) throw new ErrorDispositivos(`Ya están dados de alta: ${repetidas.slice(0, 5).join(', ')}${repetidas.length > 5 ? '…' : ''}`, 409);
  }
  const n = series.length || input.cantidad || 0;
  const codigos = siguientesCodigos(input.uso, existentes.map((e) => e.codigo), n);
  const filas = await db
    .insert(disAparatos)
    .values(
      codigos.map((codigo, i) => ({
        uso: input.uso,
        codigo,
        modeloId: input.modeloId ?? null,
        numeroSerie: series[i] ?? null,
        notas: input.notas || null,
        actualizadoPor: firma.email,
      })),
    )
    .returning({ id: disAparatos.id, codigo: disAparatos.codigo });
  if (input.conCargador) {
    await db
      .insert(disCargadores)
      .values(filas.map((f) => ({ aparatoId: f.id, codigo: f.codigo, actualizadoPor: firma.email })));
  }
  await apuntar(
    filas.map((f) => ({ aparatoId: f.id, texto: `Alta (${USO_LABEL[input.uso].toLowerCase()})${input.conCargador ? ' con cargador' : ''}` })),
    firma,
  );
  return leerAparatos(filas.map((f) => f.id));
}

/** Cambiar un iPad del cole: datos, estado, o a quién se le da (`titular: null` = devolverlo). */
export async function editarAparato(
  id: string,
  input: {
    codigo?: string;
    modeloId?: string | null;
    numeroSerie?: string | null;
    estado?: EstadoAparato;
    notas?: string | null;
    cargador?: { codigo?: string; estado?: EstadoCargador; notas?: string | null } | null;
    titular?: { tipo: 'alumno' | 'profe'; id: string } | null;
  },
  firma: Firma,
): Promise<AparatoDis> {
  const [ap] = await db.select().from(disAparatos).where(eq(disAparatos.id, id)).limit(1);
  if (!ap) throw new ErrorDispositivos('Ese iPad no existe', 404);
  if (input.titular && (input.estado ?? ap.estado) === 'baja') throw new ErrorDispositivos('Un iPad de baja no se le puede dar a nadie');
  const lineas: NuevaLinea[] = [];
  const cambios: Partial<typeof disAparatos.$inferInsert> = {};

  if (input.codigo !== undefined) {
    const codigo = normalizarCodigo(input.codigo);
    if (!codigo) throw new ErrorDispositivos('El código no puede quedar vacío');
    if (codigo !== ap.codigo) {
      const [otro] = await db.select({ id: disAparatos.id }).from(disAparatos).where(eq(disAparatos.codigo, codigo)).limit(1);
      if (otro) throw new ErrorDispositivos(`Ya hay un iPad con el código ${codigo}`, 409);
      cambios.codigo = codigo;
      lineas.push({ aparatoId: id, texto: `Código ${ap.codigo} → ${codigo}` });
    }
  }
  if (input.modeloId !== undefined) cambios.modeloId = input.modeloId;
  if (input.numeroSerie !== undefined) cambios.numeroSerie = input.numeroSerie?.trim().toUpperCase() || null;
  if (input.notas !== undefined) cambios.notas = input.notas || null;
  if (input.estado !== undefined && input.estado !== ap.estado) {
    cambios.estado = input.estado;
    lineas.push({ aparatoId: id, texto: ESTADO_APARATO_LABEL[input.estado] });
  }

  if (input.cargador !== undefined) await cambiarCargador(ap, input.cargador, firma, lineas);

  // Se devuelve si se pide, si se da de baja (de baja no lo tiene nadie) o si pasa a otra
  // persona: desde la ficha del iPad, darlo a otro es un gesto explícito.
  const mismo =
    input.titular != null &&
    (input.titular.tipo === 'alumno' ? ap.eduStudentId === input.titular.id : ap.eduTeacherId === input.titular.id);
  const devolver = input.titular === null || input.estado === 'baja' || (input.titular != null && !mismo);
  if (devolver && (ap.eduStudentId || ap.eduTeacherId)) {
    const quien = await nombreDe(ap.eduStudentId ? { tipo: 'alumno', id: ap.eduStudentId } : { tipo: 'profe', id: ap.eduTeacherId! }).catch(() => 'quien lo tenía');
    cambios.eduStudentId = null;
    cambios.eduTeacherId = null;
    cambios.asignadoAt = null;
    lineas.push({ aparatoId: id, eduStudentId: ap.eduStudentId, eduTeacherId: ap.eduTeacherId, texto: `${ap.codigo} devuelto por ${quien}` });
  }

  if (Object.keys(cambios).length) {
    await db
      .update(disAparatos)
      .set({ ...cambios, updatedAt: new Date(), actualizadoPor: firma.email })
      .where(eq(disAparatos.id, id));
  }
  if (input.titular && !mismo) await darAparato(id, input.titular, firma, lineas);
  await apuntar(lineas, firma);
  const [fila] = await leerAparatos([id]);
  return fila;
}

/** Crea, cambia o quita el cargador de un iPad (`null` = quitarlo: ya no se sabe que tenga). */
async function cambiarCargador(
  ap: typeof disAparatos.$inferSelect,
  input: { codigo?: string; estado?: EstadoCargador; notas?: string | null } | null,
  firma: Firma,
  lineas: NuevaLinea[],
): Promise<void> {
  const [actual] = await db.select().from(disCargadores).where(eq(disCargadores.aparatoId, ap.id)).limit(1);
  if (input === null) {
    if (!actual) return;
    await db.delete(disCargadores).where(eq(disCargadores.id, actual.id));
    lineas.push({ aparatoId: ap.id, texto: `Cargador ${actual.codigo} quitado` });
    return;
  }
  const codigo = input.codigo !== undefined ? normalizarCodigo(input.codigo) : (actual?.codigo ?? ap.codigo);
  if (!codigo) throw new ErrorDispositivos('El código del cargador no puede quedar vacío');
  const valores = {
    codigo,
    estado: input.estado ?? actual?.estado ?? 'activo',
    notas: input.notas !== undefined ? input.notas || null : (actual?.notas ?? null),
    actualizadoPor: firma.email,
    updatedAt: new Date(),
  };
  if (!actual) {
    await db.insert(disCargadores).values({ aparatoId: ap.id, ...valores });
    lineas.push({ aparatoId: ap.id, texto: `Cargador ${codigo} añadido` });
    return;
  }
  await db.update(disCargadores).set(valores).where(eq(disCargadores.id, actual.id));
  if (valores.estado !== actual.estado) {
    lineas.push({ aparatoId: ap.id, texto: `Cargador ${codigo}: ${ESTADO_CARGADOR_LABEL[valores.estado as EstadoCargador].toLowerCase()}` });
  }
  if (valores.codigo !== actual.codigo) lineas.push({ aparatoId: ap.id, texto: `Cargador ${actual.codigo} → ${valores.codigo}` });
}

/**
 * Quitar un iPad dado de alta por error. Solo si nunca ha tenido titular ni ha pasado nada
 * con él: lo que tiene historia no se borra, se da de baja.
 */
export async function borrarAparato(id: string): Promise<void> {
  const [[ap], hechos] = await Promise.all([
    db.select().from(disAparatos).where(eq(disAparatos.id, id)).limit(1),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(disHistorial)
      .where(and(eq(disHistorial.aparatoId, id), sql`${disHistorial.texto} not like 'Alta%'`)),
  ]);
  if (!ap) throw new ErrorDispositivos('Ese iPad no existe', 404);
  if (ap.eduStudentId || ap.eduTeacherId || (hechos[0]?.n ?? 0) > 0) {
    throw new ErrorDispositivos('Este iPad ya tiene historia: dalo de baja en vez de borrarlo', 409);
  }
  await db.delete(disHistorial).where(eq(disHistorial.aparatoId, id));
  await db.delete(disCargadores).where(eq(disCargadores.aparatoId, id));
  await db.delete(disAparatos).where(eq(disAparatos.id, id));
}

// ─── Modelos ──────────────────────────────────────────────────────────────────

export async function guardarModelo(
  id: string | null,
  input: { nombre: string; capacidadGb?: number | null; notas?: string | null; activo?: boolean },
): Promise<ModeloDis[]> {
  const valores = {
    nombre: input.nombre.trim(),
    capacidadGb: input.capacidadGb ?? null,
    notas: input.notas || null,
    updatedAt: new Date(),
    ...(input.activo !== undefined ? { activo: input.activo } : {}),
  };
  const iguales = await db
    .select({ id: disModelos.id, capacidadGb: disModelos.capacidadGb })
    .from(disModelos)
    .where(sql`lower(${disModelos.nombre}) = lower(${valores.nombre})`);
  if (iguales.some((m) => m.id !== id && (m.capacidadGb ?? null) === valores.capacidadGb)) {
    throw new ErrorDispositivos('Ese modelo ya está en la lista', 409);
  }
  if (id) {
    const r = await db.update(disModelos).set(valores).where(eq(disModelos.id, id)).returning({ id: disModelos.id });
    if (r.length === 0) throw new ErrorDispositivos('Ese modelo no existe', 404);
  } else {
    await db.insert(disModelos).values(valores);
  }
  return leerModelos();
}

/** Quitar un modelo: si algún iPad lo usa, se archiva (deja de ofrecerse); si no, se borra. */
export async function quitarModelo(id: string): Promise<{ modelos: ModeloDis[]; archivado: boolean }> {
  const [[usado], [usadoAlumnos]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(disAparatos).where(eq(disAparatos.modeloId, id)),
    db.select({ n: sql<number>`count(*)::int` }).from(disAlumnos).where(eq(disAlumnos.modeloId, id)),
  ]);
  const archivado = (usado?.n ?? 0) + (usadoAlumnos?.n ?? 0) > 0;
  if (archivado) await db.update(disModelos).set({ activo: false, updatedAt: new Date() }).where(eq(disModelos.id, id));
  else await db.delete(disModelos).where(eq(disModelos.id, id));
  return { modelos: await leerModelos(), archivado };
}

// ─── Lo que leen otros módulos ────────────────────────────────────────────────

export interface ResumenDispositivo {
  modalidad: Modalidad;
  /** «Comprado · 2022-23 · seguro vencido», «Prestado S12 · a casa». Solo para quien tiene el módulo. */
  texto: string;
  /** Lo único que ven tutores y profes. */
  noSeLoLleva: boolean;
}

/**
 * Cómo tiene el iPad cada uno de estos alumnos (los que no salen, sin informar). Lo leen la
 * ficha de Alumnado y el paso «iPad» de Nouvinguts. Una consulta (dos en paralelo).
 */
export async function resumenDispositivos(ids: readonly string[]): Promise<Map<string, ResumenDispositivo>> {
  if (ids.length === 0) return new Map();
  const cursoActual = academicYearActual();
  const [filas, prestamos] = await Promise.all([
    db
      .select({ id: disAlumnos.eduStudentId, modalidad: disAlumnos.modalidad, cursoCompra: disAlumnos.cursoCompra, aCasa: disAlumnos.aCasa })
      .from(disAlumnos)
      .where(inArray(disAlumnos.eduStudentId, [...ids])),
    db
      .select({ id: disAparatos.eduStudentId, codigo: disAparatos.codigo })
      .from(disAparatos)
      .where(and(inArray(disAparatos.eduStudentId, [...ids]), eq(disAparatos.uso, 'sustitucion'))),
  ]);
  const codigo = new Map(prestamos.map((p) => [p.id, p.codigo]));
  return new Map(
    filas.map((f) => {
      const e = { modalidad: f.modalidad as Modalidad, cursoCompra: f.cursoCompra, aCasa: f.aCasa };
      return [f.id, { modalidad: e.modalidad, texto: textoEstado({ ...e, aparato: codigo.get(f.id) }, cursoActual), noSeLoLleva: noSeLoLlevaACasa(e) }];
    }),
  );
}

/** Los alumnos (ids) que tienen un iPad prestado que NO se llevan a casa. Para la lista de Alumnado. */
export async function alumnosQueNoSeLoLlevan(): Promise<Set<string>> {
  const filas = await db
    .select({ id: disAlumnos.eduStudentId })
    .from(disAlumnos)
    .where(and(eq(disAlumnos.modalidad, 'prestado'), or(eq(disAlumnos.aCasa, false), sql`${disAlumnos.aCasa} is null`)));
  return new Set(filas.map((f) => f.id));
}

/** Para el escritorio: cuántos del alcance están sin informar. */
export async function cuentaSinInformar(): Promise<number> {
  const alcance = await alcanceDispositivos();
  const filas = await db
    .select({ curso: eduStudents.curso })
    .from(eduStudents)
    .leftJoin(disAlumnos, eq(disAlumnos.eduStudentId, eduStudents.id))
    .where(and(eq(eduStudents.active, true), sql`${disAlumnos.eduStudentId} is null`));
  return filas.filter((f) => f.curso && entraEnAlcance(f.curso, alcance.desdeCurso)).length;
}
