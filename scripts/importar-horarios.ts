/**
 * Importa un fichero de horarios de Educamos (.docx o .xlsx) a Neon.
 * Ficha: docs/07-horarios.md
 *
 *   pnpm horarios:importar <fichero> [--year 2026-27] [--periodo Ordinario]
 *                                    [--desde 2026-09-01] [--hasta 2027-05-31]
 *                                    [--prioridad 0] [--ordinario] [--dry]
 *
 * `--dry` lee y normaliza sin escribir nada: es la vista previa, y es lo que conviene
 * mirar SIEMPRE antes de volcar sobre un horario que ya esté en uso.
 *
 * Los ficheros de horarios llevan nombres del profesorado: no se commitean (ver
 * docs/04-convenciones-tecnicas.md).
 */
import { readFileSync } from 'node:fs';

import 'dotenv/config';

import { normalizarBloqueClase, type ResultadoBloque } from '../src/lib/horarios-import';
import { leerHorarios } from '../src/lib/horarios-lectores';
import { importarBloques } from '../src/lib/horarios-server';

function arg(nombre: string, defecto: string): string {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : defecto;
}
const flag = (n: string) => process.argv.includes(`--${n}`);

async function main() {
  const fichero = process.argv[2];
  if (!fichero || fichero.startsWith('--')) {
    console.error('Uso: pnpm horarios:importar <fichero.docx|.xlsx> [--dry] [--year 2026-27] …');
    process.exit(1);
  }

  const bloques = leerHorarios(readFileSync(fichero), fichero);
  const deClase = bloques.filter((b) => b.tipo === 'clase');
  console.log(`Leídos ${bloques.length} bloques (${deClase.length} de clase, ${bloques.length - deClase.length} de profesor).`);
  console.log('Solo se importan los de CLASE: los de profesor son la misma información vista del revés.\n');

  const normalizados: ResultadoBloque[] = [];
  for (const b of deClase) {
    const r = normalizarBloqueClase(b.filas);
    normalizados.push(r);
    const cod = r.clase?.codigo ?? `?? (${b.titulo})`;
    console.log(
      `  ${cod.padEnd(7)} ${String(r.sesiones.length).padStart(3)} sesiones · ${r.tramos.length} tramos` +
        ` · ${r.sesiones.filter((s) => s.aulaCodigo).length} con aula` +
        ` · ${r.sesiones.filter((s) => s.actividadCodigo !== 'clase').length} apoyos` +
        (r.incidencias.length ? ` · ⚠ ${r.incidencias.length} incidencias` : ''),
    );
  }

  const incidencias = normalizados.flatMap((r) => r.incidencias);
  if (incidencias.length) {
    console.log('\nIncidencias (agrupadas):');
    const m = new Map<string, number>();
    for (const i of incidencias) {
      const k = `${i.tipo} · ${i.crudo ?? i.detalle}`;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    [...m.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${String(n).padStart(4)} × ${k}`));
  }

  const notas = [...new Set(normalizados.flatMap((r) => r.notas))];
  if (notas.length) {
    console.log('\nNotas del fichero que no caben en la cuadrícula (se guardan, no se interpretan):');
    notas.forEach((n) => console.log(`  · ${n}`));
  }

  if (flag('dry')) {
    console.log('\n--dry: no se ha escrito nada.');
    return;
  }

  const resumen = await importarBloques(normalizados, {
    academicYear: arg('year', '2026-27'),
    periodoNombre: arg('periodo', 'Ordinario'),
    fechaInicio: arg('desde', '2026-09-01'),
    fechaFin: arg('hasta', '2027-05-31'),
    prioridad: Number(arg('prioridad', '0')),
    esOrdinario: flag('ordinario'),
  });

  console.log('\n== Importado ==');
  console.log(`  periodo        ${resumen.periodo}`);
  console.log(`  rejillas       ${resumen.rejillas} (${resumen.tramos} tramos)`);
  console.log(`  materias       ${resumen.materias}`);
  console.log(`  espacios       ${resumen.espacios}`);
  console.log(`  asignaciones   ${resumen.asignaciones}`);
  console.log(`  sesiones       ${resumen.sesiones}`);
  console.log(`  profes atados  ${resumen.profesVinculados}`);
  if (resumen.profesNoEncontrados.length) {
    console.log(`  ⚠ sin casar en edu_teachers: ${resumen.profesNoEncontrados.join(', ')}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
