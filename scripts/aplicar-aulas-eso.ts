/**
 * Pone aula a las clases de ESO que ya están importadas, con las normas de Consolación
 * (`CONFIGURACION.horarios.aulasEso`): tecnología, informática, pabellón y aula propia.
 * Ficha: docs/07-horarios.md («Aulas de la ESO»).
 *
 *   pnpm horarios:aulas [--dry] [--year 2026-27] [--periodo Ordinario]
 *
 * El export de Educamos de la ESO no trae aula, y reimportar rehace todo el horario: esto solo
 * rellena el aula de lo importado que no la tiene. No pisa lo que alguien haya puesto a mano ni lo
 * que traiga el fichero, y es idempotente. `--dry` cuenta sin escribir nada.
 */
import 'dotenv/config';

import { and, eq } from 'drizzle-orm';

import { db } from '../src/db';
import { horPeriodos } from '../src/db/schema';
import { aplicarAulasEso } from '../src/lib/horarios-server';

function arg(nombre: string, defecto: string): string {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : defecto;
}

async function main() {
  const dry = process.argv.includes('--dry');
  const periodos = await db
    .select({ id: horPeriodos.id, nombre: horPeriodos.nombre })
    .from(horPeriodos)
    .where(and(eq(horPeriodos.academicYear, arg('year', '2026-27')), eq(horPeriodos.nombre, arg('periodo', 'Ordinario'))));
  if (periodos.length === 0) {
    console.error('No hay ese periodo: ¿se ha importado ya el horario?');
    process.exit(1);
  }

  const r = await aplicarAulasEso(periodos[0].id, !dry);
  console.log(`Asignaciones de ESO sin aula: ${r.miradas}`);
  for (const a of r.porAula) console.log(`  ${String(a.asignaciones).padStart(4)} → ${a.nombre} (${a.codigo})`);
  console.log(`  ${String(r.sinAula).padStart(4)} se quedan sin aula (varios grupos sin norma, o no son clase)`);
  console.log(r.aplicadas ? '\nAplicado.' : '\n--dry: no se ha escrito nada.');
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
