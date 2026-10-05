/**
 * Importa un fichero de horarios de Educamos (.docx o .xlsx) a Neon.
 * Ficha: docs/07-horarios.md
 *
 *   pnpm horarios:importar <fichero> [--year 2026-27] [--periodo Ordinario]
 *                                    [--desde 2026-09-01] [--hasta 2027-05-31]
 *                                    [--prioridad 0] [--ordinario] [--dry]
 *                                    [--sin-reunion-etapa]
 *
 * `--dry` lee y normaliza sin escribir nada: es la vista previa, y es lo que conviene
 * mirar SIEMPRE antes de volcar sobre un horario que ya esté en uso.
 *
 * Los ficheros de horarios llevan nombres del profesorado: no se commitean (ver
 * docs/04-convenciones-tecnicas.md).
 */
import { readFileSync } from 'node:fs';

import 'dotenv/config';

import { prepararImportacion } from '../src/lib/horarios-import';
import { leerHorarios } from '../src/lib/horarios-lectores';
import { getProfesParaCasar, importarBloques } from '../src/lib/horarios-server';
import { CONFIGURACION } from '../src/lib/configuracion';

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
  console.log('De las hojas de profesor se importa lo que no está en las de clase: reuniones, atención a familias…\n');

  // El mismo criterio que la pantalla de importación (`prepararImportacion`). El claustro de
  // la BBDD hace falta para casar por nombre las hojas de quien no sale en ninguna leyenda;
  // sin DATABASE_URL (vista previa en local) esas hojas se avisan y no se importan.
  const conocidos = process.env.DATABASE_URL ? await getProfesParaCasar() : [];
  const prep = prepararImportacion(bloques, conocidos);
  const normalizados = prep.clases;

  for (const r of normalizados) {
    const cod = r.clase!.codigo;
    console.log(
      `  ${cod.padEnd(7)} ${String(r.sesiones.length).padStart(3)} sesiones · ${r.tramos.length} tramos` +
        ` · ${r.sesiones.filter((s) => s.aulaCodigo).length} con aula` +
        ` · ${r.sesiones.filter((s) => s.actividadCodigo !== 'clase').length} apoyos` +
        (r.incidencias.length ? ` · ⚠ ${r.incidencias.length} incidencias` : ''),
    );
  }
  console.log(`\nHojas de profesor: ${prep.hojasProfe.length} · horas que no son clase: ${prep.horasProfe.reduce((n, h) => n + h.sesiones.length * h.profeCodigos.length, 0)}`);

  const incidencias = [...normalizados.flatMap((r) => r.incidencias), ...prep.incidencias];
  if (incidencias.length) {
    console.log('\nIncidencias (agrupadas):');
    const m = new Map<string, number>();
    for (const i of incidencias) {
      const k = `${i.tipo} · ${i.detalle}`;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    [...m.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${String(n).padStart(4)} × ${k}`));
  }

  const notas = [...new Set(normalizados.flatMap((r) => r.notas))];
  if (notas.length) {
    console.log('\nNotas del fichero que no caben en la cuadrícula (se guardan, no se interpretan):');
    notas.forEach((n) => console.log(`  · ${n}`));
  }

  if (prep.ajustes.length) {
    console.log('\nArreglado solo (conviene saberlo):');
    prep.ajustes.forEach((a) => console.log(`  · ${a}`));
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
    // La reunión de etapa de la configuración del centro, salvo `--sin-reunion-etapa`.
    reunionesEtapa: flag('sin-reunion-etapa')
      ? []
      : Object.entries(CONFIGURACION.horarios.reunionesEtapa).map(([etapa, r]) => ({ etapa, ...r })),
  }, prep.horasProfe);

  console.log('\n== Importado ==');
  console.log(`  periodo        ${resumen.periodo}`);
  console.log(`  rejillas       ${resumen.rejillas} (${resumen.tramos} tramos)`);
  console.log(`  materias       ${resumen.materias}`);
  console.log(`  espacios       ${resumen.espacios}`);
  console.log(`  asignaciones   ${resumen.asignaciones}`);
  console.log(`  sesiones       ${resumen.sesiones}`);
  console.log(`  profes atados  ${resumen.profesVinculados}`);
  console.log(`  horas de profe ${resumen.horasProfe} (reuniones, atención a familias…)`);
  resumen.notas.forEach((n) => console.log(`  · ${n}`));
  if (resumen.profesNoEncontrados.length) {
    console.log(`  ⚠ sin casar en edu_teachers: ${resumen.profesNoEncontrados.join(', ')}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
