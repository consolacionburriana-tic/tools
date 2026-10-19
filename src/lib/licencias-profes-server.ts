// Licencias del profesorado (Fase 5b de docs/11-licencias-v2.md): las consultas.
//
// Es una anotación, no un censo: nada se sincroniza ni se calcula. Se pegan los códigos, se les
// pone profe y, si se quiere, se le manda por correo. Lo único con cuidado es **no pisar**: un
// código que ya está en la campaña (de un alumno, en el almacén o ya anotado a otro profe) no
// se vuelve a guardar, y se dice dónde está.
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { eduTeachers, licLicencias, licLicenciasProfes, licStudents } from '@/db/schema';
import { enviarCorreoLicencia, htmlLicencia } from '@/lib/licencias-email';
import { cursoLabel } from '@/lib/licencias';
import { nombreProfe, pilaProfe } from '@/lib/profes';
import {
  asuntoLicenciaProfe,
  cuerpoLicenciaProfe,
  normalizarBusqueda,
  separarConflictos,
  type ConflictoCodigo,
  type LicenciaProfeFila,
  type ProfeOpcion,
} from '@/lib/licencias-profes';

const COLUMNAS_PROFE = {
  id: eduTeachers.id,
  nombre: eduTeachers.nombre,
  apellido1: eduTeachers.apellido1,
  apellido2: eduTeachers.apellido2,
  nombreMostrado: eduTeachers.nombreMostrado,
  email: eduTeachers.email,
};

/** Profes activos para el selector, por orden alfabético del nombre visible. */
export async function profesParaLicencias(): Promise<ProfeOpcion[]> {
  // Solo las columnas del nombre: el `extra` del export pesa (04-convenciones).
  const filas = await db.select(COLUMNAS_PROFE).from(eduTeachers).where(eq(eduTeachers.active, true));
  return filas
    .map((p) => {
      const nombre = nombreProfe(p);
      return { id: p.id, nombre, email: p.email, busca: normalizarBusqueda(`${nombre} ${p.email ?? ''}`) };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export async function listarLicenciasProfes(campaignId: string): Promise<LicenciaProfeFila[]> {
  const filas = await db
    .select({
      l: licLicenciasProfes,
      nombre: eduTeachers.nombre,
      apellido1: eduTeachers.apellido1,
      apellido2: eduTeachers.apellido2,
      nombreMostrado: eduTeachers.nombreMostrado,
      email: eduTeachers.email,
    })
    .from(licLicenciasProfes)
    .leftJoin(eduTeachers, eq(eduTeachers.id, licLicenciasProfes.eduTeacherId))
    .where(eq(licLicenciasProfes.campaignId, campaignId))
    .orderBy(desc(licLicenciasProfes.createdAt), licLicenciasProfes.codigo);
  return filas.map(({ l, ...p }) => ({
    id: l.id,
    eduTeacherId: l.eduTeacherId,
    profe: l.eduTeacherId ? nombreProfe(p) : '',
    email: l.eduTeacherId ? p.email : null,
    libro: l.libro ?? '',
    codigo: l.codigo,
    nota: l.nota,
    enviadoAt: l.enviadoAt?.toISOString() ?? null,
    enviadoA: l.enviadoA,
    createdAt: l.createdAt.toISOString(),
  }));
}

/** Dónde está ya cada uno de estos códigos en la campaña, en palabras. Dos consultas a la vez. */
async function dondeEstan(campaignId: string, codigos: string[]): Promise<Map<string, string>> {
  if (codigos.length === 0) return new Map();
  const [deAlumnado, deProfes] = await Promise.all([
    db
      .select({
        codigo: licLicencias.codigo,
        nombre: licStudents.nombre,
        apellidos: licStudents.apellidos,
        curso: licStudents.curso,
      })
      .from(licLicencias)
      .leftJoin(licStudents, eq(licStudents.id, licLicencias.studentId))
      .where(and(eq(licLicencias.campaignId, campaignId), inArray(licLicencias.codigo, codigos))),
    db
      .select({ codigo: licLicenciasProfes.codigo, ...COLUMNAS_PROFE })
      .from(licLicenciasProfes)
      .leftJoin(eduTeachers, eq(eduTeachers.id, licLicenciasProfes.eduTeacherId))
      .where(and(eq(licLicenciasProfes.campaignId, campaignId), inArray(licLicenciasProfes.codigo, codigos))),
  ]);
  const mapa = new Map<string, string>();
  for (const a of deAlumnado) {
    if (!a.codigo) continue;
    mapa.set(
      a.codigo,
      a.nombre ? `es de ${a.nombre} ${a.apellidos} (${cursoLabel(a.curso ?? '')})` : 'está en el almacén de sobrantes',
    );
  }
  for (const p of deProfes) {
    mapa.set(p.codigo, p.id ? `ya está anotado a ${nombreProfe(p)}` : 'ya está anotado (sin profe)');
  }
  return mapa;
}

/**
 * Guarda los códigos pegados, cada uno con su profe (o sin él). Devuelve cuántos se han creado
 * y los que no, con dónde estaban. El `onConflictDoNothing` cubre la carrera de dos personas
 * pegando el mismo código a la vez; el índice único es el último cortafuegos.
 */
export async function guardarLicenciasProfes(opciones: {
  campaignId: string;
  items: { codigo: string; eduTeacherId: string | null }[];
  libro: string | null;
  nota: string | null;
  porEmail: string | null;
}): Promise<{ creadas: number; conflictos: ConflictoCodigo[] }> {
  const { campaignId, items } = opciones;
  const codigos = [...new Set(items.map((i) => i.codigo))];
  const { nuevos, conflictos } = separarConflictos(codigos, await dondeEstan(campaignId, codigos));
  if (nuevos.length === 0) return { creadas: 0, conflictos };
  const profeDe = new Map(items.map((i) => [i.codigo, i.eduTeacherId]));
  const insertadas = await db
    .insert(licLicenciasProfes)
    .values(
      nuevos.map((codigo) => ({
        campaignId,
        codigo,
        eduTeacherId: profeDe.get(codigo) ?? null,
        libro: opciones.libro,
        nota: opciones.nota,
        createdPorEmail: opciones.porEmail,
      })),
    )
    .onConflictDoNothing()
    .returning({ codigo: licLicenciasProfes.codigo });
  const hechos = new Set(insertadas.map((i) => i.codigo));
  for (const codigo of nuevos) {
    if (!hechos.has(codigo)) conflictos.push({ codigo, donde: 'lo acaba de anotar otra persona' });
  }
  return { creadas: insertadas.length, conflictos };
}

/** Cambia el profe (o el libro) de una anotación. Cambiar de profe no la «des-envía». */
export async function editarLicenciaProfe(
  campaignId: string,
  id: string,
  cambios: { eduTeacherId?: string | null; libro?: string | null },
): Promise<boolean> {
  const editadas = await db
    .update(licLicenciasProfes)
    .set({ ...cambios, updatedAt: new Date() })
    .where(and(eq(licLicenciasProfes.id, id), eq(licLicenciasProfes.campaignId, campaignId)))
    .returning({ id: licLicenciasProfes.id });
  return editadas.length > 0;
}

/** Borrado de verdad: es una anotación, no un dato con historia. */
export async function borrarLicenciasProfes(campaignId: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const borradas = await db
    .delete(licLicenciasProfes)
    .where(and(inArray(licLicenciasProfes.id, ids), eq(licLicenciasProfes.campaignId, campaignId)))
    .returning({ id: licLicenciasProfes.id });
  return borradas.length;
}

/**
 * Manda el código al profe por el perfil de Licencias, con la misma caja que las del alumnado.
 * Se marca enviada **después** de que el correo salga, igual que en el envío al alumnado.
 */
export async function enviarLicenciaProfe(
  campaignId: string,
  id: string,
): Promise<{ ok: true; para: string } | { ok: false; motivo: string }> {
  const [fila] = await db
    .select({ l: licLicenciasProfes, ...COLUMNAS_PROFE })
    .from(licLicenciasProfes)
    .leftJoin(eduTeachers, eq(eduTeachers.id, licLicenciasProfes.eduTeacherId))
    .where(and(eq(licLicenciasProfes.id, id), eq(licLicenciasProfes.campaignId, campaignId)));
  if (!fila) return { ok: false, motivo: 'Esa licencia ya no está anotada' };
  if (!fila.l.eduTeacherId || !fila.id) return { ok: false, motivo: 'Primero hay que decir de qué profe es' };
  if (!fila.email) return { ok: false, motivo: `${nombreProfe(fila)} no tiene correo en la BBDD central` };

  const libro = fila.l.libro ?? '';
  const html = htmlLicencia(cuerpoLicenciaProfe(pilaProfe(fila), libro), {
    alumno: '',
    nombre: pilaProfe(fila),
    apellidos: '',
    curso: '',
    clase: '',
    academicYear: '',
    licencias: [{ asignatura: libro, libro, plataforma: '', codigo: fila.l.codigo }],
  });
  await enviarCorreoLicencia(fila.email, asuntoLicenciaProfe(libro), html);
  await db
    .update(licLicenciasProfes)
    .set({ enviadoAt: new Date(), enviadoA: fila.email, updatedAt: new Date() })
    .where(eq(licLicenciasProfes.id, id));
  return { ok: true, para: fila.email };
}
