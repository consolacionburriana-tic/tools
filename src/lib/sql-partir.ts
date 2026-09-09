// Partir un fichero SQL en sentencias. Lo usa `scripts/aplicar-sql.ts` (`pnpm db:sql`)
// para aplicar los ficheros de `src/db/sql/` en Neon: el driver HTTP manda una sentencia
// por llamada, así que hay que separarlas bien.
//
// Puro y testeado, que es lo suyo para algo que decide qué se ejecuta en producción.

/**
 * Parte un fichero SQL en sentencias. Hay que respetar lo que puede contener un `;` que
 * no separa nada: los comentarios (`--`, `/* *\/`), las cadenas, los identificadores
 * entrecomillados y el dollar-quoting de las funciones (`$$ … $$`), que sí se usa aquí.
 */
export function partirSql(sql: string): string[] {
  const sentencias: string[] = [];
  let actual = '';
  let i = 0;
  while (i < sql.length) {
    const dos = sql.slice(i, i + 2);
    if (dos === '--') {
      const fin = sql.indexOf('\n', i);
      i = fin === -1 ? sql.length : fin + 1;
      continue;
    }
    if (dos === '/*') {
      const fin = sql.indexOf('*/', i + 2);
      i = fin === -1 ? sql.length : fin + 2;
      continue;
    }
    const c = sql[i];
    if (c === "'" || c === '"') {
      const cierre = sql.indexOf(c, i + 1);
      const hasta = cierre === -1 ? sql.length : cierre + 1;
      actual += sql.slice(i, hasta);
      i = hasta;
      continue;
    }
    if (c === '$') {
      const etiqueta = /^\$[A-Za-z_]*\$/.exec(sql.slice(i));
      if (etiqueta) {
        const marca = etiqueta[0];
        const cierre = sql.indexOf(marca, i + marca.length);
        const hasta = cierre === -1 ? sql.length : cierre + marca.length;
        actual += sql.slice(i, hasta);
        i = hasta;
        continue;
      }
    }
    if (c === ';') {
      if (actual.trim() !== '') sentencias.push(actual.trim());
      actual = '';
      i++;
      continue;
    }
    actual += c;
    i++;
  }
  if (actual.trim() !== '') sentencias.push(actual.trim());
  return sentencias;
}
