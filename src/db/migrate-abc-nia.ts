/**
 * Migración puntual (2026-08-31): el Registro ABC pasa a colgar de la BBDD central.
 *
 * 1. Añade a `abc_students` las columnas del vínculo (`nia`, `siglas`, `por_defecto`) y relaja
 *    el NOT NULL de las columnas legadas de nombre, que ya no se escriben.
 * 2. Enlaza por NIA cada fila existente con su alumno de `edu_students`, rellena las siglas
 *    y limpia el nombre guardado en el módulo (el nombre vive solo en la BBDD central).
 * 3. Reescribe las siglas de TODAS las filas enlazadas a dos iniciales ("R.H."), que es lo
 *    que se pinta desde el 2026-08-31.
 *
 * Idempotente: se puede lanzar las veces que haga falta.
 *   npx dotenv-cli -e .env.local tsx src/db/migrate-abc-nia.ts
 */
import { neon } from '@neondatabase/serverless';
import { siglasDeAlumno } from '../lib/abc';

// Filas anteriores al vínculo, con el NIA que David ha confirmado para cada una.
const VINCULOS: { fullName: string; nia: string }[] = [
  { fullName: 'R. Herreros', nia: '11358569' }, // Roberto Herrero Mendoza · 3ºPPDC
];

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL');
  const sql = neon(process.env.DATABASE_URL);

  // ── 1. Esquema ──────────────────────────────────────────────────────────────
  await sql`ALTER TABLE abc_students ADD COLUMN IF NOT EXISTS nia text`;
  await sql`ALTER TABLE abc_students ADD COLUMN IF NOT EXISTS siglas text`;
  await sql`ALTER TABLE abc_students ADD COLUMN IF NOT EXISTS por_defecto boolean NOT NULL DEFAULT false`;
  await sql`ALTER TABLE abc_students ALTER COLUMN full_name DROP NOT NULL`;
  await sql`ALTER TABLE abc_students ALTER COLUMN display_name DROP NOT NULL`;
  await sql`ALTER TABLE abc_students ALTER COLUMN class_name DROP NOT NULL`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS abc_students_nia_uq ON abc_students (nia)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS abc_students_edu_student_uq ON abc_students (edu_student_id)`;
  console.log('✓ Esquema al día');

  // ── 2. Datos ────────────────────────────────────────────────────────────────
  for (const { fullName, nia } of VINCULOS) {
    const [alumno] = await sql`
      SELECT id, nombre, apellido1, apellido2, curso, letra FROM edu_students WHERE nia = ${nia} LIMIT 1
    `;
    if (!alumno) {
      console.error(`✗ No hay alumno con NIA ${nia} en edu_students — sin tocar "${fullName}"`);
      continue;
    }
    const siglas = siglasDeAlumno(alumno.nombre, alumno.apellido1);
    const filas = await sql`
      UPDATE abc_students
         SET edu_student_id = ${alumno.id},
             nia = ${nia},
             siglas = ${siglas},
             full_name = NULL,
             display_name = NULL,
             class_name = NULL
       WHERE full_name = ${fullName} OR edu_student_id = ${alumno.id} OR nia = ${nia}
       RETURNING id
    `;
    console.log(`✓ ${filas.length} fila(s) enlazadas a NIA ${nia} → ${siglas}`);
  }

  // ── 3. Siglas a dos iniciales en todo lo ya enlazado ────────────────────────
  const enlazados = await sql`
    SELECT a.id, a.siglas, e.nombre, e.apellido1
      FROM abc_students a JOIN edu_students e ON e.id = a.edu_student_id
  `;
  for (const fila of enlazados) {
    const siglas = siglasDeAlumno(fila.nombre, fila.apellido1);
    if (fila.siglas === siglas) continue;
    await sql`UPDATE abc_students SET siglas = ${siglas} WHERE id = ${fila.id}`;
    console.log(`✓ siglas ${fila.siglas} → ${siglas}`);
  }

  const pendientes = await sql`SELECT count(*)::int AS n FROM abc_students WHERE edu_student_id IS NULL`;
  console.log(`Filas aún sin enlazar: ${pendientes[0].n}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
