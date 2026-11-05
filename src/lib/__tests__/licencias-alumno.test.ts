import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql as sqlTag } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { alumnoVivo, CURSO_LIC_SQL } from '@/lib/licencias-alumno-server';
import { cursoBaseEso, cursoSiguiente } from '@/lib/cursos';
import { cursoParaCampania, PROMOCION_ALUMNO, siguienteCampania } from '@/lib/licencias';

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
      // Lo único que puede mirar de `lic_students` es `campaign_id`, para saber si la campaña promociona.
      expect(sql, campo).not.toMatch(/"lic_students"\."(?!campaign_id")/);
    }
  });

  it('el curso de Licencias en SQL dice lo mismo que cursoBaseEso() y cursoParaCampania()', () => {
    // El SQL y las funciones de JS tienen que decir lo mismo: si una cambia, esto avisa.
    const sql = render(CURSO_LIC_SQL);
    // La traducción de los PDC: misma expresión regular que `cursoBaseEso`.
    expect(sql).toContain("'^[0-9]+[^0-9]*PDC$'");
    const re = /^[0-9]+[^0-9]*PDC$/i;
    for (const curso of ['3ºPPDC', '4ºPPDC', '3PDC', '1ESO', '2ESO', '6PRI', '3INF', '1BACH']) {
      const esperado = re.test(curso) ? `${curso.match(/^[0-9]+/)![0]}ESO` : curso;
      expect(cursoBaseEso(curso)).toBe(esperado);
    }
    // La promoción: cada pareja `when 'X' then 'Y'` del SQL es exactamente PROMOCION_ALUMNO.
    const enSql = [...sql.matchAll(/when '([0-9A-Z]+)' then '([0-9A-Z]+)'/g)].map((m) => [m[1], m[2]]);
    expect(Object.fromEntries(enSql)).toEqual(PROMOCION_ALUMNO);
    // Y la campaña se consulta con una subconsulta, no hay que unirse a `lic_campaigns`.
    expect(sql).toContain('select c.promociona from lic_campaigns c');
  });
});

describe('cursoParaCampania', () => {
  it('sin promocionar deja el curso como está', () => {
    expect(cursoParaCampania('2ESO', false)).toBe('2ESO');
    expect(cursoParaCampania('4ESO', false)).toBe('4ESO');
  });
  it('promocionando sube un curso: 5º EP→6º EP, 6º EP→1º ESO, 3º ESO→4º ESO', () => {
    expect(cursoParaCampania('5PRI', true)).toBe('6PRI');
    expect(cursoParaCampania('6PRI', true)).toBe('1ESO');
    expect(cursoParaCampania('2ESO', true)).toBe('3ESO');
    expect(cursoParaCampania('3ESO', true)).toBe('4ESO');
  });
  it('4º ESO egresa y lo que no es de Licencias no entra', () => {
    expect(cursoParaCampania('4ESO', true)).toBeNull();
    expect(cursoParaCampania('3INF', true)).toBeNull();
    expect(cursoParaCampania(null, true)).toBeNull();
  });
  it('no es la promoción de los tutores (Primaria no rota por parejas)', () => {
    expect(cursoParaCampania('6PRI', true)).not.toBe(cursoSiguiente('6PRI'));
  });
});

describe('siguienteCampania', () => {
  it('propone el curso y el nombre del año que viene', () => {
    expect(siguienteCampania('2026/2027')).toEqual({ academicYear: '2027/2028', name: 'Licencias 2027/28' });
  });
  it('no inventa nada si el curso no tiene la forma esperada', () => {
    expect(siguienteCampania('curso 26')).toBeNull();
    expect(siguienteCampania(null)).toBeNull();
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
