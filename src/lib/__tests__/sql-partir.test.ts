import { describe, expect, it } from 'vitest';
import { partirSql } from '@/lib/sql-partir';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Esto decide qué se ejecuta en Neon cuando alguien lanza `pnpm db:sql`, así que conviene
// que esté bien: un `;` dentro de una cadena o de una función partiría la sentencia por la
// mitad y la mandaría a medias.

describe('partirSql', () => {
  it('separa por punto y coma y se come el sobrante', () => {
    expect(partirSql('SELECT 1; SELECT 2;\n\n')).toEqual(['SELECT 1', 'SELECT 2']);
    expect(partirSql('   ;;  ')).toEqual([]);
  });

  it('quita los comentarios de línea y de bloque', () => {
    const sql = `-- un comentario con ; dentro
      ALTER TABLE t ADD COLUMN c text; /* otro ; comentario */
      SELECT 1;`;
    expect(partirSql(sql)).toEqual(['ALTER TABLE t ADD COLUMN c text', 'SELECT 1']);
  });

  it('no parte por un punto y coma dentro de una cadena o de un identificador', () => {
    expect(partirSql("INSERT INTO t (c) VALUES ('a;b'); SELECT 1;")).toEqual([
      "INSERT INTO t (c) VALUES ('a;b')",
      'SELECT 1',
    ]);
    expect(partirSql('SELECT "col;raro" FROM t;')).toEqual(['SELECT "col;raro" FROM t']);
  });

  it('respeta el dollar-quoting de las funciones, que llevan ; dentro', () => {
    const sql = `CREATE FUNCTION f() RETURNS int AS $$ BEGIN; RETURN 1; END; $$ LANGUAGE plpgsql;
      SELECT f();`;
    const partes = partirSql(sql);
    expect(partes).toHaveLength(2);
    expect(partes[0]).toContain('BEGIN; RETURN 1; END;');
    expect(partes[1]).toBe('SELECT f()');
  });

  it('los ficheros de verdad del repo salen en sentencias completas', () => {
    const dir = join(process.cwd(), 'src', 'db', 'sql');
    const ficheros = readdirSync(dir).filter((f) => f.endsWith('.sql'));
    expect(ficheros.length).toBeGreaterThan(0);
    for (const fichero of ficheros) {
      const sentencias = partirSql(readFileSync(join(dir, fichero), 'utf8'));
      expect(sentencias.length, fichero).toBeGreaterThan(0);
      for (const sentencia of sentencias) {
        // Ninguna sentencia empieza por un comentario ni se queda a medias de un $$.
        expect(sentencia.startsWith('--'), `${fichero}: ${sentencia.slice(0, 40)}`).toBe(false);
        expect((sentencia.match(/\$\$/g) ?? []).length % 2, `${fichero}: $$ impares`).toBe(0);
      }
    }
  });
});
