// Venta de materiales, dentro de Alumnado: todo lo que toca Neon.
// Ficha: docs/21-alumnado.md (fase 3).
//
// Un material es una COLUMNA de la vista de Alumnado para las clases a las que va (su regla,
// `destinos`), y su estado por alumno es una fila de `mat_estados`. Sin fila = «—», todavía
// no hay información.
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { eduStudents, matEstados, matMateriales } from '@/db/schema';
import { academicYearActual } from '@/lib/constants';
import { aplicaMaterial, estadoVisible, type DestinoMaterial, type EstadoMaterial } from '@/lib/alumnado';

export interface MaterialLista {
  id: string;
  nombre: string;
  /** En euros, ya como número; `null` si no se ha puesto. */
  importe: number | null;
  notas: string | null;
  destinos: DestinoMaterial[];
}

const ESTADOS_VALIDOS = new Set<string>(['pagado', 'no', 'becado', 'no_aplica']);
const comoEstado = (v: string | null): EstadoMaterial | null =>
  v && ESTADOS_VALIDOS.has(v) ? (v as EstadoMaterial) : null;

/** Los materiales vivos del curso, en el orden en que se crearon (que es el de las columnas). */
export async function listaMateriales(academicYear = academicYearActual()): Promise<MaterialLista[]> {
  const filas = await db
    .select({
      id: matMateriales.id,
      nombre: matMateriales.nombre,
      importe: matMateriales.importe,
      notas: matMateriales.notas,
      destinos: matMateriales.destinos,
    })
    .from(matMateriales)
    .where(and(eq(matMateriales.academicYear, academicYear), eq(matMateriales.activo, true)))
    .orderBy(asc(matMateriales.createdAt));
  return filas.map((f) => ({ ...f, importe: f.importe === null ? null : Number(f.importe) }));
}

/**
 * `edu_student_id` → material → estado, de los materiales vivos del curso. Los materiales
 * van como subconsulta: así esto sale en la MISMA tanda que el listado, sin esperar a saber
 * cuáles son (un viaje a Neon son ~127 ms). `veBecas` se aplica aquí, antes de que el dato
 * salga del servidor.
 */
export async function estadosMateriales(
  veBecas: boolean,
  academicYear = academicYearActual(),
): Promise<Map<string, Record<string, EstadoMaterial>>> {
  const vivos = db
    .select({ id: matMateriales.id })
    .from(matMateriales)
    .where(and(eq(matMateriales.academicYear, academicYear), eq(matMateriales.activo, true)));
  const filas = await db
    .select({ materialId: matEstados.materialId, eduStudentId: matEstados.eduStudentId, estado: matEstados.estado })
    .from(matEstados)
    .where(inArray(matEstados.materialId, vivos));

  const mapa = new Map<string, Record<string, EstadoMaterial>>();
  for (const f of filas) {
    const estado = estadoVisible(comoEstado(f.estado), veBecas);
    if (!estado) continue;
    const suyo = mapa.get(f.eduStudentId) ?? {};
    suyo[f.materialId] = estado;
    mapa.set(f.eduStudentId, suyo);
  }
  return mapa;
}

export interface DatosMaterial {
  nombre: string;
  importe: number | null;
  notas: string | null;
  destinos: DestinoMaterial[];
}

export async function crearMaterial(datos: DatosMaterial, porEmail: string): Promise<MaterialLista> {
  const [fila] = await db
    .insert(matMateriales)
    .values({
      academicYear: academicYearActual(),
      nombre: datos.nombre.trim(),
      importe: datos.importe === null ? null : datos.importe.toFixed(2),
      notas: datos.notas?.trim() || null,
      destinos: datos.destinos,
      createdBy: porEmail,
    })
    .returning({ id: matMateriales.id });
  return { id: fila.id, ...datos, nombre: datos.nombre.trim(), notas: datos.notas?.trim() || null };
}

export async function editarMaterial(id: string, datos: DatosMaterial): Promise<boolean> {
  const hecho = await db
    .update(matMateriales)
    .set({
      nombre: datos.nombre.trim(),
      importe: datos.importe === null ? null : datos.importe.toFixed(2),
      notas: datos.notas?.trim() || null,
      destinos: datos.destinos,
      updatedAt: new Date(),
    })
    .where(eq(matMateriales.id, id))
    .returning({ id: matMateriales.id });
  return hecho.length > 0;
}

/**
 * Quitar un material. Si nadie ha marcado nada todavía, se borra de verdad (era un error de
 * creación); si ya tiene estados, se ARCHIVA: esos pagos son historia del curso y no se
 * pierden por limpiar la pantalla (regla de la casa, `04-convenciones-tecnicas.md`).
 */
export async function quitarMaterial(id: string): Promise<'borrado' | 'archivado' | null> {
  const [uso] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(matEstados)
    .where(and(eq(matEstados.materialId, id), sql`${matEstados.estado} is not null`));
  if ((uso?.n ?? 0) === 0) {
    const borrado = await db.delete(matMateriales).where(eq(matMateriales.id, id)).returning({ id: matMateriales.id });
    return borrado.length > 0 ? 'borrado' : null;
  }
  const archivado = await db
    .update(matMateriales)
    .set({ activo: false, updatedAt: new Date() })
    .where(eq(matMateriales.id, id))
    .returning({ id: matMateriales.id });
  return archivado.length > 0 ? 'archivado' : null;
}

/**
 * Marca el estado de un material para uno o muchos alumnos. El alcance no se cree lo que
 * venga en la petición: se leen de la BBDD las clases de esos ids y se descartan los que no
 * le tocan a quien pulsa **o a los que el material no va dirigido**. Devuelve los que de
 * verdad se han tocado, que es lo que la pantalla repinta.
 */
export async function guardarEstadosMaterial(
  materialId: string,
  ids: readonly string[],
  estado: EstadoMaterial | null,
  porEmail: string,
  puedeCon: (alumno: { curso: string | null; letra: string | null }) => boolean,
): Promise<{ ids: string[] } | null> {
  const [[material], alumnos] = await Promise.all([
    db
      .select({ destinos: matMateriales.destinos, activo: matMateriales.activo })
      .from(matMateriales)
      .where(eq(matMateriales.id, materialId))
      .limit(1),
    db
      .select({ id: eduStudents.id, curso: eduStudents.curso, letra: eduStudents.letra })
      .from(eduStudents)
      .where(and(inArray(eduStudents.id, [...ids]), eq(eduStudents.active, true))),
  ]);
  if (!material || !material.activo) return null;

  const permitidos = alumnos.filter((a) => puedeCon(a) && aplicaMaterial(material.destinos, a)).map((a) => a.id);
  if (permitidos.length === 0) return { ids: [] };

  await db
    .insert(matEstados)
    .values(permitidos.map((eduStudentId) => ({ materialId, eduStudentId, estado, updatedBy: porEmail })))
    .onConflictDoUpdate({
      target: [matEstados.materialId, matEstados.eduStudentId],
      set: { estado, updatedBy: porEmail, updatedAt: new Date() },
    });
  return { ids: permitidos };
}
