/**
 * Corrige los profes de las sesiones de Oratorios / Godly Play / Talleres FUTURAS (borrador o
 * confirmadas): añade los que el horario da a esa hora y la sesión no tenía. Antes del 18-nov-2026
 * solo entraba el titular de la hora, así que la segunda profe de una clase no recibía invitación
 * ni aviso. Ficha: docs/26-oratorios.md (decisión 27).
 *
 *   pnpm oratorios:profes [--dry] [--avisar]
 *
 * - Solo AÑADE profes (y marca a los de apoyo PT/AL como «sin molestia»); no quita a nadie.
 * - Con las sesiones confirmadas, actualiza el evento de Calendar: el profe nuevo recibe la invitación.
 * - `--avisar`: si la sesión YA estaba avisada, manda el correo solo al profe añadido. Si el aviso aún
 *   no ha salido (pendiente/programado), saldrá con todos como siempre y no hace falta.
 * - `--dry` cuenta lo que haría sin escribir ni mandar nada. Idempotente: lanzarlo dos veces no
 *   repite nada.
 */
import 'dotenv/config';

import { corregirProfesFuturos } from '../src/lib/oratorios-server';

async function main() {
  const dry = process.argv.includes('--dry');
  const avisar = process.argv.includes('--avisar');
  const filas = await corregirProfesFuturos({ aplicar: !dry, avisar });

  const tocadas = filas.filter((f) => !f.omitida);
  const omitidas = filas.filter((f) => f.omitida);
  for (const f of tocadas) {
    console.log(`${f.fecha} ${f.horaInicio} · ${f.clase} · ${f.estado}/aviso ${f.avisoEstado}`);
    console.log(`    tenía: ${f.antes.join(', ') || '—'}`);
    if (f.anadidos.length) console.log(`    añade: ${f.anadidos.join(', ')}`);
    if (f.sinMolestia.length) console.log(`    PT/AL (avisa, no cuenta): ${f.sinMolestia.join(', ')}`);
    if (f.sobran.length) console.log(`    ⚠ el horario ya no da esa hora a: ${f.sobran.join(', ')} (no se quita)`);
    if (f.calendario) console.log(`    calendario: ${f.calendario}`);
    if (f.correoAlAnadido) console.log(`    correo al añadido: ${f.correoAlAnadido}`);
  }
  if (omitidas.length) {
    console.log(`\nNo se han podido mirar ${omitidas.length} (sin horario):`);
    for (const f of omitidas) console.log(`    ${f.fecha} ${f.horaInicio} · ${f.clase}: ${f.omitida}`);
  }
  console.log(`\n${tocadas.length} sesiones con cambios.`);
  console.log(dry ? '--dry: no se ha escrito nada.' : 'Aplicado.');
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
