import { eq, sql } from 'drizzle-orm';
import { eduStudents, licStudents } from '@/db/schema';

/**
 * El alumno de una campaña de Licencias, **leído en vivo de la BBDD central**.
 *
 * `lic_students` es solo la lista de quién participa en la campaña (más lo que es de la
 * campaña y no del alumno: el idioma de su clase, si se marcó «no pedirá»). Todo lo demás —
 * nombre, curso, letra, correo, banco de libros…— vive en `edu_students` y se lee de allí con un
 * join, así que no hay copia que sincronizar ni que se pueda quedar vieja.
 * Ver `docs/06-fuente-unica-alumnado.md`.
 *
 * Uso: `db.select(alumnoCols).from(licStudents).innerJoin(eduStudents, ON_EDU)`; o, si solo
 * hacen falta unas pocas columnas, `alumnoVivo.curso` etc. en un `select` a medida. Los nombres
 * de los campos son los de siempre, así que quien los lee no cambia.
 *
 * Los nombres de las columnas son los de `edu_students` (el join los cualifica solo).
 */

/** El `ON` del join de toda consulta que use `alumnoVivo`. */
export const ON_EDU = eq(licStudents.eduStudentId, eduStudents.id);

/**
 * Curso tal como lo entiende Licencias, escrito en SQL para poder agrupar y filtrar en la base de
 * datos. Dos cosas, las dos con su gemela en JS (`cursoBaseEso()` y `cursoParaCampania()`;
 * `licencias-alumno.test.ts` las cruza):
 *
 * 1. Los PDC vienen de la central como `3ºPPDC` y aquí son `3ESO` (con letra PDC).
 * 2. Si la campaña es de las que se abren antes de pasar el curso (`lic_campaigns.promociona`),
 *    el alumno se lee un curso por delante: `2ESO` → `3ESO`, `6PRI` → `1ESO`. La campaña se
 *    consulta con una subconsulta, así que ninguna consulta tiene que unirse a `lic_campaigns`.
 */
export const CURSO_BASE_SQL = sql<string>`(case when upper(${eduStudents.curso}) ~ '^[0-9]+[^0-9]*PDC$' then substring(${eduStudents.curso} from '^[0-9]+') || 'ESO' else ${eduStudents.curso} end)`;

const SI_PROMOCIONA = sql`coalesce((select c.promociona from lic_campaigns c where c.id = ${licStudents.campaignId}), false)`;

export const CURSO_LIC_SQL = sql<string>`(case when ${SI_PROMOCIONA} then (case ${CURSO_BASE_SQL} when '5PRI' then '6PRI' when '6PRI' then '1ESO' when '1ESO' then '2ESO' when '2ESO' then '3ESO' when '3ESO' then '4ESO' end) else ${CURSO_BASE_SQL} end)`;

export const alumnoVivo = {
  educamosId: eduStudents.educamosPersonaId,
  apellido1: eduStudents.apellido1,
  apellido2: eduStudents.apellido2,
  apellidos: sql<string>`concat_ws(' ', nullif(${eduStudents.apellido1}, ''), nullif(${eduStudents.apellido2}, ''))`,
  nombre: sql<string>`coalesce(${eduStudents.nombre}, '')`,
  birthYear: sql<number | null>`extract(year from ${eduStudents.fechaNacimiento})::int`,
  curso: CURSO_LIC_SQL,
  letra: eduStudents.letra,
  email: sql<string | null>`coalesce(${eduStudents.email}, ${eduStudents.emailGoogle})`,
  bancoLibros: eduStudents.bancoLibros,
};

/** Lo que es de la campaña: participación, idioma de la clase y el «no pedirá». */
export const alumnoCampana = {
  id: licStudents.id,
  campaignId: licStudents.campaignId,
  studentCode: licStudents.studentCode,
  eduStudentId: licStudents.eduStudentId,
  lenguaBase: licStudents.lenguaBase,
  active: licStudents.active,
  manualCompletedAt: licStudents.manualCompletedAt,
  manualCompletedReason: licStudents.manualCompletedReason,
  createdAt: licStudents.createdAt,
};

/** Fila completa: lo de la campaña + lo vivo de la central. Sustituye al antiguo `select()`. */
export const alumnoCols = { ...alumnoCampana, ...alumnoVivo };

export type LicAlumno = {
  id: string;
  campaignId: string;
  studentCode: string;
  eduStudentId: string | null;
  lenguaBase: string | null;
  active: boolean;
  manualCompletedAt: Date | null;
  manualCompletedReason: string | null;
  createdAt: Date;
  educamosId: string | null;
  apellido1: string | null;
  apellido2: string | null;
  apellidos: string;
  nombre: string;
  birthYear: number | null;
  curso: string;
  letra: string | null;
  email: string | null;
  bancoLibros: boolean;
};
