#!/usr/bin/env tsx
// Aplica en Neon los ficheros SQL de `src/db/sql/`.
//
// Por qué existe: en este repo los cambios de schema se aplican con SQL aditivo y no con
// `pnpm db:push` (push borra lo que no esté en `schema.ts`, y ya se llevó por delante las
// tablas `hor_*` de otra sesión — ver docs/04-convenciones-tecnicas.md). Hasta ahora esos
// ficheros se pegaban a mano en la consola de Neon, así que quedaban pendientes durante
// semanas y nadie sabía cuáles faltaban. Esto lo convierte en un comando.
//
//   pnpm db:sql --pendientes          # los que dice src/db/sql/pendientes.txt (lo normal)
//   pnpm db:sql cuaderno-tutor        # uno o varios, por nombre (con o sin .sql)
//   pnpm db:sql --pendientes --dry    # enseña qué haría, sin tocar nada
//   pnpm db:sql --lista               # qué ficheros hay
//
// El DATABASE_URL sale de `.env.local` si existe y, si no, del entorno (así funciona igual
// en el portátil y en un contenedor con la variable ya puesta).
//
// TODOS los ficheros de `src/db/sql/` tienen que ser idempotentes (`IF NOT EXISTS`,
// `ON CONFLICT DO NOTHING`): esto se puede volver a ejecutar sin miedo. Si escribes uno
// que no lo sea, no lo pongas en `pendientes.txt`.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { partirSql } from '../src/lib/sql-partir';

config({ path: '.env.local' });
config();

const DIR = join(process.cwd(), 'src', 'db', 'sql');
const MANIFIESTO = join(DIR, 'pendientes.txt');

function ficherosDisponibles(): string[] {
  return readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
}

/** La lista de lo que falta por aplicar, en orden. Líneas con `#` = comentarios. */
function pendientes(): string[] {
  if (!existsSync(MANIFIESTO)) return [];
  return readFileSync(MANIFIESTO, 'utf8')
    .split('\n')
    .map((l) => l.replace(/#.*$/, '').trim())
    .filter((l) => l !== '');
}

function resolver(nombre: string): string {
  const fichero = nombre.endsWith('.sql') ? nombre : `${nombre}.sql`;
  const ruta = join(DIR, basename(fichero));
  if (!existsSync(ruta)) {
    console.error(`✗ No existe src/db/sql/${basename(fichero)}. Los que hay:\n   ${ficherosDisponibles().join('\n   ')}`);
    process.exit(1);
  }
  return ruta;
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const nombres = args.filter((a) => !a.startsWith('--'));

  if (args.includes('--lista') || (args.length === 0 && nombres.length === 0)) {
    console.log('Ficheros en src/db/sql/:');
    for (const f of ficherosDisponibles()) console.log(`   ${f}`);
    const p = pendientes();
    console.log(p.length ? `\nPendientes de aplicar (src/db/sql/pendientes.txt):\n   ${p.join('\n   ')}` : '\nNo hay nada pendiente.');
    console.log('\nUso: pnpm db:sql --pendientes [--dry]  ·  pnpm db:sql <fichero…>');
    return;
  }

  const lista = args.includes('--pendientes') ? pendientes() : nombres;
  if (lista.length === 0) {
    console.log('Nada que aplicar: `pendientes.txt` está vacío. 🎉');
    return;
  }

  const url = process.env.DATABASE_URL;
  if (!url && !dry) {
    console.error(
      '✗ Falta DATABASE_URL.\n' +
        '  En local: copia .env.local.example a .env.local y pon el connection string de Neon.\n' +
        '  Con la variable ya en el entorno, este comando la coge sola.\n' +
        '  Para ver qué haría sin conectarse: pnpm db:sql --pendientes --dry',
    );
    process.exit(1);
  }
  const sql = url ? neon(url) : null;

  for (const nombre of lista) {
    const ruta = resolver(nombre);
    const sentencias = partirSql(readFileSync(ruta, 'utf8'));
    console.log(`\n── ${basename(ruta)} · ${sentencias.length} sentencias${dry ? ' (dry-run)' : ''}`);
    for (const [n, sentencia] of sentencias.entries()) {
      const resumen = sentencia.replace(/\s+/g, ' ').slice(0, 110);
      if (dry || !sql) {
        console.log(`   ${n + 1}. ${resumen}`);
        continue;
      }
      try {
        await sql.query(sentencia);
        console.log(`   ✓ ${n + 1}. ${resumen}`);
      } catch (error) {
        console.error(`   ✗ ${n + 1}. ${resumen}\n     ${error instanceof Error ? error.message : String(error)}`);
        console.error('\nParo aquí: los ficheros son idempotentes, así que arregla eso y vuelve a lanzarlo.');
        process.exit(1);
      }
    }
  }

  if (!dry) {
    console.log(
      '\nListo. Ahora, en el mismo commit:\n' +
        '  1. quita de src/db/sql/pendientes.txt lo que se acaba de aplicar;\n' +
        '  2. marca las casillas `[~]` como `[x]` en la ficha del módulo (docs/), y\n' +
        '  3. quita la nota de "SQL pendiente" de docs/plataforma.md si ya no queda nada.',
    );
  }
}

void main();
