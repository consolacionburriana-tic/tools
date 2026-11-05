import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql as sqlTag } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { alumnoVivo, CURSO_LIC_SQL } from '@/lib/licencias-alumno-server';
import { cursoBaseEso } from '@/lib/cursos';

// La regla de la fuente única (docs/06-fuente-unica-alumnado.md): Licencias lee al alumno de
// `edu_students` en vivo y NO de las copias que `lic_students` arrastra. Estos tests no pueden
// tocar la base de datos (el repo no hace IO en vitest), así que guardan la regla por fuera:
// miran el SQL que se genera y el código fuente.

const dialect = new PgDialect();
// `sqlTag` envuelve también las columnas sueltas, que no son un `SQL` por sí solas.
const render = (q: unknown) => dialect.sqlToQuery(sqlTag`${q}`).sql;

describe('alumnoVivo', () => {
  it('cada campo sale de edu_students, nunca de lic_students', () => {
    for (const [campo, col] of Object.entries(alumnoVivo)) {
      const sql = render(col);
      expect(sql, campo).toContain('"edu_students"');
      expect(sql, campo).not.toContain('"lic_students"');
    }
  });

  it('el curso PDC se traduce igual que cursoBaseEso()', () => {
    // El SQL y la función de JS tienen que decir lo mismo: si una cambia, esto avisa.
    const sql = render(CURSO_LIC_SQL);
    expect(sql).toContain("'^[0-9]+[^0-9]*PDC$'");
    // Misma expresión regular, evaluada en JS, sobre los cursos reales de la central.
    const re = /^[0-9]+[^0-9]*PDC$/i;
    for (const curso of ['3ºPPDC', '4ºPPDC', '3PDC', '1ESO', '2ESO', '6PRI', '3INF', '1BACH']) {
      const esPdc = re.test(curso);
      const esperado = esPdc ? `${curso.match(/^[0-9]+/)![0]}ESO` : curso;
      expect(cursoBaseEso(curso)).toBe(esperado);
    }
  });
});

describe('nadie lee los duplicados de lic_students', () => {
  const COLUMNAS_COPIA = ['nombre', 'apellidos', 'apellido1', 'apellido2', 'birthYear', 'curso', 'letra', 'email', 'bancoLibros', 'educamosId'];
  const lib = join(process.cwd(), 'src', 'lib');
  // Solo el código que lee al alumno de la campaña. El sync (`licencias-server.ts`, bloque
  // «Vista previa y aplicación») es el único que escribe las copias mientras existan.
  const ficheros = readdirSync(lib).filter((f) => /^licencias.*-server\.ts$|^licencias-exports\.ts$/.test(f));

  it('hay ficheros que mirar', () => {
    expect(ficheros.length).toBeGreaterThan(3);
  });

  for (const f of ficheros) {
    it(`${f} no lee licStudents.<columna duplicada>`, () => {
      let src = readFileSync(join(lib, f), 'utf8');
      // El sync se queda fuera: es quien las mantiene (y las borra en la fase 2).
      const corte = src.indexOf('// ── Vista previa y aplicación de sincronizaciones');
      if (corte >= 0) src = src.slice(0, corte);
      const leidas = COLUMNAS_COPIA.filter((c) => new RegExp(`licStudents\\.${c}\\b`).test(src));
      expect(leidas).toEqual([]);
    });
  }
});
