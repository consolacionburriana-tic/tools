// Envío de licencias a los alumnos (Fase 5 de docs/11-licencias-v2.md).
//
// La pieza que faltaba del ciclo: llegan los códigos de la editorial, se casan con los alumnos
// y se mandan por correo, uno por licencia, marcando cada una individualmente.
//
// Lo único que no es evidente: **las licencias del banco de libros no existen en ninguna
// tabla**. Son un censo (alumno BdL × libros del banco de su curso, resuelto por idioma) que
// se recalcula a demanda; las de pago sí son filas de `lic_order_items`. Para poder pegarles un
// código y marcarlas enviadas hace falta una fila por licencia en los dos casos, así que
// `sincronizarLicencias()` materializa el censo en `lic_licencias`. Es idempotente y NUNCA
// borra una fila con código o ya enviada: si un alumno se va, su licencia se marca descartada,
// no desaparece.
import { and, desc, eq, inArray, isNotNull, isNull, notInArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  eduStudents,
  licBooks,
  licEnvios,
  licLicencias,
  licOrderItems,
  licOrders,
  licStudents,
  type LicLicencia,
} from '@/db/schema';
import { cursoEfectivo } from '@/lib/licencias';
import { getBancoLibrosCenso, indexarLibros } from '@/lib/licencias-exports';
import {
  resumir,
  type Destino,
  type LicenciaFila,
  type ResumenLicencias,
  type TipoLicencia,
} from '@/lib/licencias-envios';

export type { Destino, LicenciaFila, ResumenLicencias, TipoLicencia };

/** Motivo reservado del descarte automático: distingue "ya no está en el censo" de un descarte
 *  a mano ("esta optativa no la cursa"), que el sincronizador no debe deshacer nunca. */
export const MOTIVO_FUERA_DE_CENSO = 'fuera del censo';

// ── Materializar ──────────────────────────────────────────────────────────────

export interface ResultadoSync {
  creadasPago: number;
  creadasBanco: number;
  descartadas: number;
  recuperadas: number;
}

/**
 * Pone `lic_licencias` al día con la realidad: una fila por línea de pedido (pago) y una por
 * cada libro del banco que le toca a cada alumno del banco. Se puede llamar las veces que haga
 * falta; los índices únicos hacen el resto.
 */
export async function sincronizarLicencias(campaignId: string): Promise<ResultadoSync> {
  const [itemsPago, censo, existentes] = await Promise.all([
    db
      .select({
        itemId: licOrderItems.id,
        bookCod: licOrderItems.bookCod,
        orderCurso: licOrders.curso,
        studentId: licOrders.studentId,
        studentCurso: licStudents.curso,
      })
      .from(licOrderItems)
      .innerJoin(licOrders, eq(licOrderItems.orderId, licOrders.id))
      .innerJoin(licStudents, eq(licOrders.studentId, licStudents.id))
      .where(and(eq(licOrders.campaignId, campaignId), eq(licOrders.archived, false))),
    getBancoLibrosCenso(campaignId),
    db
      .select({
        id: licLicencias.id,
        tipo: licLicencias.tipo,
        studentId: licLicencias.studentId,
        curso: licLicencias.curso,
        cod: licLicencias.cod,
        codigo: licLicencias.codigo,
        estado: licLicencias.estado,
        descartadoAt: licLicencias.descartadoAt,
        descartadoMotivo: licLicencias.descartadoMotivo,
      })
      .from(licLicencias)
      .where(and(eq(licLicencias.campaignId, campaignId), eq(licLicencias.tipo, 'banco'))),
  ]);

  const filasPago = itemsPago.map((i) => ({
    campaignId,
    tipo: 'pago',
    curso: i.orderCurso ?? i.studentCurso,
    cod: i.bookCod,
    studentId: i.studentId,
    orderItemId: i.itemId,
  }));
  const filasBanco = censo.map(({ student, book, curso }) => ({
    campaignId,
    tipo: 'banco',
    curso,
    cod: book.cod,
    studentId: student.id,
  }));

  const creadasPago = await insertarEnTandas(filasPago);
  const creadasBanco = await insertarEnTandas(filasBanco);

  // Lo que ya no está en el censo (alumno de baja, libro retirado del Excel) se descarta, no se
  // borra: si tenía código o ya se envió, se queda tal cual porque es una licencia real.
  const enCenso = new Set(filasBanco.map((f) => `${f.studentId}|${f.curso}|${f.cod}`));
  const aDescartar = existentes
    .filter(
      (e) =>
        e.studentId &&
        !e.descartadoAt &&
        !e.codigo &&
        e.estado === 'pendiente' &&
        !enCenso.has(`${e.studentId}|${e.curso}|${e.cod}`),
    )
    .map((e) => e.id);
  // Y al revés: si vuelve a estar (el alumno reaparece), se le quita el descarte automático.
  // El descarte a mano ("esta optativa no la cursa") no se toca: lo puso una persona.
  const aRecuperar = existentes
    .filter(
      (e) =>
        e.studentId &&
        e.descartadoAt &&
        e.descartadoMotivo === MOTIVO_FUERA_DE_CENSO &&
        enCenso.has(`${e.studentId}|${e.curso}|${e.cod}`),
    )
    .map((e) => e.id);

  await Promise.all([
    aDescartar.length
      ? db
          .update(licLicencias)
          .set({ descartadoAt: new Date(), descartadoMotivo: MOTIVO_FUERA_DE_CENSO, updatedAt: new Date() })
          .where(inArray(licLicencias.id, aDescartar))
      : Promise.resolve(),
    aRecuperar.length
      ? db
          .update(licLicencias)
          .set({ descartadoAt: null, descartadoMotivo: null, updatedAt: new Date() })
          .where(inArray(licLicencias.id, aRecuperar))
      : Promise.resolve(),
  ]);

  return { creadasPago, creadasBanco, descartadas: aDescartar.length, recuperadas: aRecuperar.length };
}

/**
 * Inserta en tandas ignorando lo que ya existe. El censo del banco son ~1.600 filas.
 * `onConflictDoNothing()` sin target a propósito: los índices que protegen esto son parciales
 * (`WHERE order_item_id IS NOT NULL`, `WHERE tipo = 'banco'…`) y aquí da igual cuál de ellos
 * salte — si la fila ya existe, no se toca.
 */
async function insertarEnTandas(
  filas: { campaignId: string; tipo: string; curso: string; cod: string; studentId: string; orderItemId?: string }[],
): Promise<number> {
  let creadas = 0;
  for (let i = 0; i < filas.length; i += 500) {
    const insertadas = await db
      .insert(licLicencias)
      .values(filas.slice(i, i + 500))
      .onConflictDoNothing()
      .returning({ id: licLicencias.id });
    creadas += insertadas.length;
  }
  return creadas;
}

// ── Leer ──────────────────────────────────────────────────────────────────────

async function cargarContexto(campaignId: string) {
  const [licencias, alumnos, libros, pedidos] = await Promise.all([
    db.select().from(licLicencias).where(eq(licLicencias.campaignId, campaignId)),
    db
      .select({
        id: licStudents.id,
        nombre: licStudents.nombre,
        apellidos: licStudents.apellidos,
        curso: licStudents.curso,
        letra: licStudents.letra,
        email: licStudents.email,
        emailGoogle: eduStudents.emailGoogle,
      })
      .from(licStudents)
      .leftJoin(eduStudents, eq(licStudents.eduStudentId, eduStudents.id))
      .where(eq(licStudents.campaignId, campaignId)),
    db
      .select({
        cod: licBooks.cod,
        curso: licBooks.curso,
        asignatura: licBooks.asignatura,
        nombreLibro: licBooks.nombreLibro,
        editorial: licBooks.editorial,
        plataforma: licBooks.plataforma,
        isbn: licBooks.isbn,
      })
      .from(licBooks)
      .where(eq(licBooks.campaignId, campaignId)),
    db
      .select({ studentId: licOrders.studentId, email: licOrders.email })
      .from(licOrders)
      .where(and(eq(licOrders.campaignId, campaignId), eq(licOrders.archived, false))),
  ]);
  return {
    licencias,
    alumnoPorId: new Map(alumnos.map((a) => [a.id, a])),
    libroEn: indexarLibros(libros),
    correoFamiliaPorAlumno: new Map(pedidos.map((p) => [p.studentId, p.email])),
  };
}

/**
 * El correo del alumno es su cuenta del colegio (la del iPad), que es a donde iban los envíos
 * de siempre. `lic_students.email` viene de Educamos y puede ser el de casa, así que la cuenta
 * Google de la central manda cuando existe.
 */
export function correoAlumnoDe(a: { emailGoogle: string | null; email: string | null } | undefined): string | null {
  return a?.emailGoogle?.trim() || a?.email?.trim() || null;
}

export async function listarLicencias(
  campaignId: string,
  destino: Destino = 'alumno',
): Promise<{ filas: LicenciaFila[]; resumen: Record<TipoLicencia, ResumenLicencias> }> {
  const { licencias, alumnoPorId, libroEn, correoFamiliaPorAlumno } = await cargarContexto(campaignId);
  const filas: LicenciaFila[] = licencias.map((l) => {
    const a = l.studentId ? alumnoPorId.get(l.studentId) : undefined;
    const b = libroEn(l.curso, l.cod);
    const correoAlumno = correoAlumnoDe(a);
    const correoFamilia = (l.studentId ? correoFamiliaPorAlumno.get(l.studentId) : null) ?? null;
    return {
      id: l.id,
      tipo: l.tipo as TipoLicencia,
      curso: l.curso,
      cod: l.cod,
      studentId: l.studentId,
      alumno: a ? `${a.apellidos}, ${a.nombre}` : '',
      apellidos: a?.apellidos ?? '',
      nombre: a?.nombre ?? '',
      letra: a?.letra ?? null,
      asignatura: b?.asignatura ?? l.cod,
      libro: b?.nombreLibro ?? '',
      editorial: b?.editorial ?? '',
      plataforma: b?.plataforma ?? '',
      isbn: b?.isbn ?? '',
      codigo: l.codigo,
      estado: l.estado,
      enviadoAt: l.enviadoAt?.toISOString() ?? null,
      enviadoA: l.enviadoA,
      descartadoAt: l.descartadoAt?.toISOString() ?? null,
      descartadoMotivo: l.descartadoMotivo,
      error: l.error,
      destinatario: l.studentId ? (destino === 'familia' ? correoFamilia ?? correoAlumno : correoAlumno) : null,
      correoAlumno,
      correoFamilia,
      nota: l.nota,
    };
  });
  return { filas, resumen: { pago: resumir(filas, 'pago'), banco: resumir(filas, 'banco') } };
}

// ── Asignar ───────────────────────────────────────────────────────────────────

export interface AsignacionEntrada {
  campaignId: string;
  tipo: TipoLicencia;
  /** Parejas hueco ← código, EN EL ORDEN QUE SE VE EN PANTALLA (lo manda el cliente). */
  parejas: { licenciaId: string; codigo: string }[];
  /** Códigos que no han encontrado hueco: se guardan como sobrantes de este libro. */
  sobrantes: { curso: string; cod: string; codigo: string }[];
  porEmail: string | null;
}

export interface ResultadoAsignacion {
  asignadas: number;
  sobrantesGuardados: number;
  yaExistian: { codigo: string; alumno: string }[];
  rechazadas: { licenciaId: string; motivo: string }[];
}

/**
 * Guarda los códigos. Solo toca huecos que sigan vacíos: si entre la vista previa y el guardado
 * alguien asignó ese mismo hueco, se rechaza en vez de pisarlo (y se dice cuál).
 */
export async function asignarCodigos(e: AsignacionEntrada): Promise<ResultadoAsignacion> {
  const codigos = [...e.parejas.map((p) => p.codigo), ...e.sobrantes.map((s) => s.codigo)];
  const yaEnUso = codigos.length
    ? await db
        .select({ codigo: licLicencias.codigo, studentId: licLicencias.studentId })
        .from(licLicencias)
        .where(and(eq(licLicencias.campaignId, e.campaignId), inArray(licLicencias.codigo, codigos)))
    : [];
  const usados = new Map(yaEnUso.map((u) => [u.codigo ?? '', u.studentId]));
  const alumnos = usados.size
    ? await db
        .select({ id: licStudents.id, nombre: licStudents.nombre, apellidos: licStudents.apellidos })
        .from(licStudents)
        .where(inArray(licStudents.id, [...usados.values()].filter((v): v is string => Boolean(v))))
    : [];
  const nombrePorId = new Map(alumnos.map((a) => [a.id, `${a.apellidos}, ${a.nombre}`]));
  const yaExistian = [...usados.entries()].map(([codigo, studentId]) => ({
    codigo,
    alumno: studentId ? nombrePorId.get(studentId) ?? '' : '(en sobrantes)',
  }));

  const nuevas = e.parejas.filter((p) => !usados.has(p.codigo));
  const ahora = new Date();
  const rechazadas: { licenciaId: string; motivo: string }[] = [];
  let asignadas = 0;

  // De una en una a propósito: el `WHERE codigo IS NULL` es lo que impide pisar un código ya
  // puesto, y con un solo UPDATE masivo no se sabría cuál se ha quedado fuera.
  for (const p of nuevas) {
    const hechas = await db
      .update(licLicencias)
      .set({ codigo: p.codigo, codigoAt: ahora, codigoPorEmail: e.porEmail, updatedAt: ahora })
      .where(
        and(
          eq(licLicencias.id, p.licenciaId),
          eq(licLicencias.campaignId, e.campaignId),
          isNull(licLicencias.codigo),
        ),
      )
      .returning({ id: licLicencias.id });
    if (hechas.length) asignadas++;
    else rechazadas.push({ licenciaId: p.licenciaId, motivo: 'ya tenía código' });
  }

  const sobrantesNuevos = e.sobrantes.filter((s) => !usados.has(s.codigo));
  if (sobrantesNuevos.length) {
    await db
      .insert(licLicencias)
      .values(
        sobrantesNuevos.map((s) => ({
          campaignId: e.campaignId,
          tipo: e.tipo,
          curso: s.curso,
          cod: s.cod,
          studentId: null,
          codigo: s.codigo,
          codigoAt: ahora,
          codigoPorEmail: e.porEmail,
          nota: 'sobrante del pegado',
        })),
      )
      .onConflictDoNothing();
  }

  return { asignadas, sobrantesGuardados: sobrantesNuevos.length, yaExistian, rechazadas };
}

/** Quita el código de una licencia (se pegó mal). Solo si todavía no se ha enviado. */
export async function quitarCodigo(campaignId: string, licenciaId: string): Promise<boolean> {
  const hechas = await db
    .update(licLicencias)
    // El estado vuelve a cero: si el envío había fallado, dejar `error` puesto haría que la
    // fila siguiera contando como incidencia aunque ya no tenga ni código.
    .set({
      codigo: null,
      codigoAt: null,
      codigoPorEmail: null,
      estado: 'pendiente',
      error: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(licLicencias.id, licenciaId),
        eq(licLicencias.campaignId, campaignId),
        sql`${licLicencias.estado} <> 'enviado'`,
      ),
    )
    .returning({ id: licLicencias.id });
  return hechas.length > 0;
}

/** Marca huecos como "no le toca" (la optativa que no cursa) o lo deshace. */
export async function descartarLicencias(
  campaignId: string,
  ids: string[],
  motivo: string | null,
): Promise<number> {
  if (!ids.length) return 0;
  const hechas = await db
    .update(licLicencias)
    .set(
      motivo === null
        ? { descartadoAt: null, descartadoMotivo: null, updatedAt: new Date() }
        : { descartadoAt: new Date(), descartadoMotivo: motivo, updatedAt: new Date() },
    )
    .where(and(eq(licLicencias.campaignId, campaignId), inArray(licLicencias.id, ids)))
    .returning({ id: licLicencias.id });
  return hechas.length;
}

// ── Sobrantes ─────────────────────────────────────────────────────────────────

/**
 * Coloca un código del almacén en un hueco concreto (llega un alumno nuevo a mitad de curso).
 *
 * El borrado del sobrante y el relleno del hueco van en un **único `db.batch`** (una
 * transacción). Tienen que ir juntos por dos motivos: el índice único de código rechaza el
 * UPDATE mientras el sobrante siga teniendo el código, y si se hicieran sueltos y fallara el
 * segundo, el código habría desaparecido de la campaña sin haber llegado a nadie. Mismo motivo
 * y misma solución que `promocionarTutores` en `tutorias-server.ts`.
 */
export async function colocarSobrante(
  campaignId: string,
  sobranteId: string,
  licenciaId: string,
): Promise<{ ok: boolean; motivo?: string }> {
  const [sobrante] = await db
    .select()
    .from(licLicencias)
    .where(and(eq(licLicencias.id, sobranteId), eq(licLicencias.campaignId, campaignId), isNull(licLicencias.studentId)));
  if (!sobrante?.codigo) return { ok: false, motivo: 'Ese sobrante ya no está disponible' };

  // El hueco se comprueba ANTES: dentro del batch no se puede decidir nada, y si ya tuviera
  // código el UPDATE no haría nada pero el DELETE sí, que es justo perder el código.
  const [hueco] = await db
    .select({ id: licLicencias.id })
    .from(licLicencias)
    .where(
      and(
        eq(licLicencias.id, licenciaId),
        eq(licLicencias.campaignId, campaignId),
        isNotNull(licLicencias.studentId),
        isNull(licLicencias.codigo),
      ),
    );
  if (!hueco) return { ok: false, motivo: 'Ese alumno ya tenía código o no está pendiente' };

  const ahora = new Date();
  await db.batch([
    db.delete(licLicencias).where(eq(licLicencias.id, sobranteId)),
    db
      .update(licLicencias)
      .set({
        codigo: sobrante.codigo,
        codigoAt: ahora,
        codigoPorEmail: sobrante.codigoPorEmail,
        nota: 'colocada desde sobrantes',
        updatedAt: ahora,
      })
      .where(and(eq(licLicencias.id, licenciaId), isNull(licLicencias.codigo))),
  ]);
  return { ok: true };
}

/** Guarda códigos sueltos en el almacén sin pasar por el emparejado (llegaron de más). */
export async function guardarSobrantes(
  campaignId: string,
  tipo: TipoLicencia,
  curso: string,
  cod: string,
  codigos: string[],
  porEmail: string | null,
  nota?: string,
): Promise<number> {
  if (!codigos.length) return 0;
  const insertadas = await db
    .insert(licLicencias)
    .values(
      codigos.map((codigo) => ({
        campaignId,
        tipo,
        curso,
        cod,
        studentId: null,
        codigo,
        codigoAt: new Date(),
        codigoPorEmail: porEmail,
        nota: nota ?? 'guardada a mano',
      })),
    )
    .onConflictDoNothing()
    .returning({ id: licLicencias.id });
  return insertadas.length;
}

/** Tira un sobrante (caducó, la editorial lo anuló). Solo sobrantes: nunca una licencia dada. */
export async function borrarSobrante(campaignId: string, id: string): Promise<boolean> {
  const borradas = await db
    .delete(licLicencias)
    .where(and(eq(licLicencias.id, id), eq(licLicencias.campaignId, campaignId), isNull(licLicencias.studentId)))
    .returning({ id: licLicencias.id });
  return borradas.length > 0;
}

// ── Envíos ────────────────────────────────────────────────────────────────────

export async function marcarEnviadas(
  ids: string[],
  envioId: string,
  para: string,
  ok: boolean,
  error?: string,
): Promise<void> {
  if (!ids.length) return;
  await db
    .update(licLicencias)
    .set({
      estado: ok ? 'enviado' : 'error',
      enviadoAt: ok ? new Date() : null,
      enviadoA: ok ? para : null,
      envioId,
      error: ok ? null : error ?? 'error de envío',
      updatedAt: new Date(),
    })
    .where(inArray(licLicencias.id, ids));
}

export async function registrarEnvio(fila: {
  campaignId: string;
  tipo: TipoLicencia;
  studentId: string | null;
  para: string;
  asunto: string;
  numLicencias: number;
  ok: boolean;
  error?: string | null;
  porEmail: string | null;
}): Promise<string> {
  const [e] = await db
    .insert(licEnvios)
    .values({
      campaignId: fila.campaignId,
      tipo: fila.tipo,
      studentId: fila.studentId,
      para: fila.para,
      asunto: fila.asunto,
      numLicencias: fila.numLicencias,
      ok: fila.ok,
      error: fila.error ?? null,
      enviadoPorEmail: fila.porEmail,
    })
    .returning({ id: licEnvios.id });
  return e.id;
}

export interface EnvioFila {
  id: string;
  tipo: string;
  para: string;
  asunto: string;
  numLicencias: number;
  ok: boolean;
  error: string | null;
  enviadoAt: string;
  enviadoPorEmail: string | null;
  alumno: string;
}

export async function listarEnvios(campaignId: string, limite = 500): Promise<EnvioFila[]> {
  const filas = await db
    .select({
      id: licEnvios.id,
      tipo: licEnvios.tipo,
      para: licEnvios.para,
      asunto: licEnvios.asunto,
      numLicencias: licEnvios.numLicencias,
      ok: licEnvios.ok,
      error: licEnvios.error,
      enviadoAt: licEnvios.enviadoAt,
      enviadoPorEmail: licEnvios.enviadoPorEmail,
      nombre: licStudents.nombre,
      apellidos: licStudents.apellidos,
    })
    .from(licEnvios)
    .leftJoin(licStudents, eq(licEnvios.studentId, licStudents.id))
    .where(eq(licEnvios.campaignId, campaignId))
    .orderBy(desc(licEnvios.enviadoAt))
    .limit(limite);
  return filas.map((f) => ({
    id: f.id,
    tipo: f.tipo,
    para: f.para,
    asunto: f.asunto,
    numLicencias: f.numLicencias,
    ok: f.ok,
    error: f.error,
    enviadoAt: f.enviadoAt.toISOString(),
    enviadoPorEmail: f.enviadoPorEmail,
    alumno: f.apellidos ? `${f.apellidos}, ${f.nombre}` : '',
  }));
}

/**
 * Cuando todas las licencias DE PAGO de un pedido están enviadas, el pedido pasa el sello 📤
 * ("la familia ya tiene su código"), que es lo que mira la pantalla de Pedidos. Antes lo ponía
 * a mano el botón de las plantillas de FormMule.
 */
export async function sellarPedidosCompletos(campaignId: string, studentIds: string[]): Promise<number> {
  if (!studentIds.length) return 0;
  const pendientes = db
    .select({ studentId: licLicencias.studentId })
    .from(licLicencias)
    .where(
      and(
        eq(licLicencias.campaignId, campaignId),
        eq(licLicencias.tipo, 'pago'),
        inArray(licLicencias.studentId, studentIds),
        isNull(licLicencias.descartadoAt),
        sql`${licLicencias.estado} <> 'enviado'`,
      ),
    );
  const hechos = await db
    .update(licOrders)
    .set({ sentToTemplateAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(licOrders.campaignId, campaignId),
        inArray(licOrders.studentId, studentIds),
        isNull(licOrders.sentToTemplateAt),
        notInArray(licOrders.studentId, pendientes),
      ),
    )
    .returning({ id: licOrders.id });
  return hechos.length;
}

/** Las licencias que entran en un envío, ya validadas (con código, sin enviar y con destino). */
export async function licenciasParaEnviar(campaignId: string, ids: string[]): Promise<LicLicencia[]> {
  if (!ids.length) return [];
  return db
    .select()
    .from(licLicencias)
    .where(
      and(
        eq(licLicencias.campaignId, campaignId),
        inArray(licLicencias.id, ids),
        isNotNull(licLicencias.codigo),
        isNotNull(licLicencias.studentId),
        isNull(licLicencias.descartadoAt),
        sql`${licLicencias.estado} <> 'enviado'`,
      ),
    );
}

/** Curso efectivo de un alumno, para casar su fila con la identidad `(curso, cod)` del libro. */
export function cursoDeAlumno(a: { curso: string; letra: string | null }): string {
  return cursoEfectivo(a.curso, a.letra);
}

export interface LicenciaParaEnviar {
  id: string;
  tipo: TipoLicencia;
  studentId: string;
  alumno: string;
  nombre: string;
  apellidos: string;
  curso: string;
  clase: string;
  asignatura: string;
  libro: string;
  plataforma: string;
  codigo: string;
  destinatario: string | null;
}

/**
 * Los datos de un puñado de licencias concretas, listos para pintar el correo. Acotado a los
 * `ids` que se van a mandar: el envío grande va por tandas y cargar las ~2.000 filas de la
 * campaña en cada tanda sería pagar el viaje veinte veces.
 */
export async function contextoParaEnvio(
  campaignId: string,
  ids: string[],
  destino: Destino,
): Promise<LicenciaParaEnviar[]> {
  const licencias = await licenciasParaEnviar(campaignId, ids);
  if (!licencias.length) return [];
  const studentIds = [...new Set(licencias.map((l) => l.studentId).filter((v): v is string => Boolean(v)))];
  const [alumnos, libros, pedidos] = await Promise.all([
    db
      .select({
        id: licStudents.id,
        nombre: licStudents.nombre,
        apellidos: licStudents.apellidos,
        curso: licStudents.curso,
        letra: licStudents.letra,
        email: licStudents.email,
        emailGoogle: eduStudents.emailGoogle,
      })
      .from(licStudents)
      .leftJoin(eduStudents, eq(licStudents.eduStudentId, eduStudents.id))
      .where(inArray(licStudents.id, studentIds)),
    db
      .select({
        cod: licBooks.cod,
        curso: licBooks.curso,
        asignatura: licBooks.asignatura,
        nombreLibro: licBooks.nombreLibro,
        plataforma: licBooks.plataforma,
      })
      .from(licBooks)
      .where(eq(licBooks.campaignId, campaignId)),
    db
      .select({ studentId: licOrders.studentId, email: licOrders.email })
      .from(licOrders)
      .where(and(eq(licOrders.campaignId, campaignId), inArray(licOrders.studentId, studentIds))),
  ]);
  const alumnoPorId = new Map(alumnos.map((a) => [a.id, a]));
  const libroEn = indexarLibros(libros);
  const correoFamilia = new Map(pedidos.map((p) => [p.studentId, p.email]));

  return licencias.flatMap((l) => {
    const a = l.studentId ? alumnoPorId.get(l.studentId) : undefined;
    if (!a || !l.studentId || !l.codigo) return [];
    const b = libroEn(l.curso, l.cod);
    const delAlumno = correoAlumnoDe(a);
    return [
      {
        id: l.id,
        tipo: l.tipo as TipoLicencia,
        studentId: l.studentId,
        alumno: `${a.apellidos}, ${a.nombre}`,
        nombre: a.nombre,
        apellidos: a.apellidos,
        curso: l.curso,
        clase: `${a.curso}${a.letra ?? ''}`,
        asignatura: b?.asignatura ?? l.cod,
        libro: b?.nombreLibro ?? '',
        plataforma: b?.plataforma ?? '',
        codigo: l.codigo,
        destinatario: destino === 'familia' ? correoFamilia.get(l.studentId) ?? delAlumno : delAlumno,
      },
    ];
  });
}

/**
 * Agrupa lo que va a salir en cada correo. Por defecto **uno por licencia**, que es lo que
 * mejora la trazabilidad de buscarlo después en el buzón; fusionando, un correo por alumno.
 */
export function agruparEnvios(
  licencias: LicenciaParaEnviar[],
  fusionar: boolean,
): { studentId: string; para: string; licencias: LicenciaParaEnviar[] }[] {
  const conCorreo = licencias.filter((l) => l.destinatario);
  if (!fusionar) {
    return conCorreo.map((l) => ({ studentId: l.studentId, para: l.destinatario as string, licencias: [l] }));
  }
  const porAlumno = new Map<string, LicenciaParaEnviar[]>();
  for (const l of conCorreo) {
    const clave = `${l.studentId}|${l.destinatario}`;
    porAlumno.set(clave, [...(porAlumno.get(clave) ?? []), l]);
  }
  return [...porAlumno.values()].map((ls) => ({
    studentId: ls[0].studentId,
    para: ls[0].destinatario as string,
    licencias: ls,
  }));
}
