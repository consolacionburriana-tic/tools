#!/usr/bin/env tsx
// La guardia del diseño (docs/diseno.md, «Lo que no se hace»): cuenta por fichero lo que se
// puede contar —diálogos del navegador, estilos de botón propios, cabeceras propias en
// /gestion, letra de 9-11 px y acciones que solo salen con el ratón— y falla si algún fichero
// tiene más que antes. Lo de antes está en `scripts/guardia-diseno.excepciones.json` y solo
// puede bajar: cuando limpies un módulo, `--rebajar` la reescribe con lo que quede.
//
//   pnpm diseno:guardia             # comprueba (lo normal, y lo que mira el DoD)
//   pnpm diseno:guardia --rebajar   # tras limpiar: baja la lista (nunca la sube)
//   pnpm diseno:guardia --resumen   # cuánto queda por limpiar, por regla y por módulo

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { contar, excesos, rebajar, REGLAS, type Cuentas, type Regla } from '../src/lib/guardia-diseno';

const RAIZ = process.cwd();
const LISTA = join(RAIZ, 'scripts', 'guardia-diseno.excepciones.json');

function ficheros(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return nombre === 'node_modules' ? [] : ficheros(ruta);
    return nombre.endsWith('.tsx') ? [ruta] : [];
  });
}

const actual: Record<string, Cuentas> = {};
for (const ruta of ficheros(join(RAIZ, 'src'))) {
  const rel = relative(RAIZ, ruta).replaceAll('\\', '/');
  const cuentas = contar(rel, readFileSync(ruta, 'utf8'));
  if (Object.keys(cuentas).length > 0) actual[rel] = cuentas;
}

const permitido: Record<string, Cuentas> = JSON.parse(readFileSync(LISTA, 'utf8'));
const args = process.argv.slice(2);

if (args.includes('--rebajar')) {
  const nueva = rebajar(actual, permitido);
  writeFileSync(LISTA, `${JSON.stringify(nueva, null, 2)}\n`);
  console.log(`Lista rebajada: ${Object.keys(permitido).length} → ${Object.keys(nueva).length} ficheros con algo pendiente.`);
}

if (args.includes('--resumen')) {
  const porRegla = new Map<Regla, number>();
  const porModulo = new Map<string, number>();
  for (const [ruta, cuentas] of Object.entries(actual)) {
    const partes = ruta.split('/');
    const modulo = partes.slice(1, partes[1] === 'app' && partes.length > 4 ? 4 : 3).join('/');
    for (const [regla, n] of Object.entries(cuentas) as [Regla, number][]) {
      porRegla.set(regla, (porRegla.get(regla) ?? 0) + n);
      porModulo.set(modulo, (porModulo.get(modulo) ?? 0) + n);
    }
  }
  console.log('Por regla:');
  for (const [regla, n] of porRegla) console.log(`  ${String(n).padStart(4)}  ${REGLAS[regla].explicacion}`);
  console.log('Por carpeta:');
  for (const [m, n] of [...porModulo].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${m}`);
}

const mal = excesos(actual, permitido);
if (mal.length > 0) {
  console.error('La guardia del diseño ha encontrado cosas nuevas (docs/diseno.md, «Lo que no se hace»):');
  for (const e of mal) {
    console.error(`  ${e.ruta}: ${REGLAS[e.regla].explicacion} (${e.antes} → ${e.ahora})`);
  }
  process.exit(1);
}
const quedan = Object.values(actual).reduce((t, c) => t + Object.values(c).reduce((a, b) => a + (b ?? 0), 0), 0);
console.log(`Guardia del diseño en verde. Quedan ${quedan} cosas por limpiar de antes en ${Object.keys(actual).length} ficheros.`);
