import { describe, expect, it } from 'vitest';
import { cursoSiguiente } from '@/lib/cursos';
import {
  aplicarCorte,
  type ClaseTutores,
  completarHuecos,
  cortesDeReparto,
  invertirReparto,
  planPromocion,
  type Reparto,
  repartoPorMitades,
  repartoPorTutor,
  resumenPlan,
  sinTutorPersonal,
} from '@/lib/tutorias';

describe('cursoSiguiente', () => {
  it('Infantil rota el ciclo 3-4-5', () => {
    expect(cursoSiguiente('3INF')).toBe('4INF');
    expect(cursoSiguiente('4INF')).toBe('5INF');
    expect(cursoSiguiente('5INF')).toBe('3INF');
  });

  it('Primaria rota dentro de cada ciclo de dos años', () => {
    expect(cursoSiguiente('1PRI')).toBe('2PRI');
    expect(cursoSiguiente('2PRI')).toBe('1PRI');
    expect(cursoSiguiente('3PRI')).toBe('4PRI');
    expect(cursoSiguiente('4PRI')).toBe('3PRI');
    expect(cursoSiguiente('5PRI')).toBe('6PRI');
    expect(cursoSiguiente('6PRI')).toBe('5PRI');
  });

  it('ESO sube de verdad y 4º egresa', () => {
    expect(cursoSiguiente('1ESO')).toBe('2ESO');
    expect(cursoSiguiente('3ESO')).toBe('4ESO');
    expect(cursoSiguiente('4ESO')).toBeNull();
  });

  it('los PDC conservan su formato raro', () => {
    expect(cursoSiguiente('3ºPPDC')).toBe('4ºPPDC');
    expect(cursoSiguiente('4ºPPDC')).toBeNull();
  });

  it('devuelve null con cursos desconocidos o fuera de rango', () => {
    expect(cursoSiguiente(null)).toBeNull();
    expect(cursoSiguiente('')).toBeNull();
    expect(cursoSiguiente('BACH1')).toBeNull();
    expect(cursoSiguiente('9ESO')).toBeNull();
  });
});

const clase = (curso: string, letra: string | null, tutores: string[] = []): ClaseTutores => ({
  curso,
  letra,
  tutores: tutores.map((n, i) => ({ id: `${curso}-${letra}-${i}`, teacherId: `t-${n}`, nombre: n })),
});

describe('planPromocion', () => {
  const clases = [
    clase('5INF', 'A', ['Vidal']),
    clase('4INF', 'A'),
    clase('3INF', 'A', ['Bort']),
    clase('1PRI', 'A', ['Peña']),
    clase('2PRI', 'A', ['Compañ']),
    clase('3ESO', 'A', ['Soler']),
    clase('4ESO', 'A', ['García']),
    clase('4ESO', 'B', []),
  ];

  it('mueve cada tutoría a su clase destino', () => {
    const plan = planPromocion(clases);
    const de = (n: string) => plan.find((c) => c.nombre === n)!;
    expect(de('Bort').hasta).toEqual({ curso: '4INF', letra: 'A' });
    expect(de('Vidal').hasta).toEqual({ curso: '3INF', letra: 'A' });
    expect(de('Peña').hasta).toEqual({ curso: '2PRI', letra: 'A' });
    expect(de('Compañ').hasta).toEqual({ curso: '1PRI', letra: 'A' });
    expect(de('Soler').hasta).toEqual({ curso: '4ESO', letra: 'A' });
  });

  it('libera a quien egresa (4º ESO)', () => {
    const garcia = planPromocion(clases).find((c) => c.nombre === 'García')!;
    expect(garcia.hasta).toBeNull();
    expect(garcia.motivo).toBe('egresa');
  });

  it('libera si la clase destino no existe, en vez de inventarla', () => {
    // 1PRI B existe, pero 2PRI B no: su tutora se queda sin destino.
    const plan = planPromocion([clase('1PRI', 'B', ['Sebastia']), clase('2PRI', 'A', [])]);
    expect(plan[0].hasta).toBeNull();
    expect(plan[0].motivo).toBe('sin-clase');
  });

  it('una clase sin tutores no genera cambios', () => {
    expect(planPromocion([clase('4ESO', 'B', [])])).toHaveLength(0);
  });

  it('resume cuántas se mueven y cuántas se liberan', () => {
    expect(resumenPlan(planPromocion(clases))).toEqual({ movidas: 5, liberadas: 1 });
  });
});

// ─── Reparto de alumnos entre los tutores de una clase ────────────────────────

const alumnos = (n: number) => Array.from({ length: n }, (_, i) => `a${String(i + 1).padStart(2, '0')}`);
const ana = 't-ana';
const luis = 't-luis';
const eva = 't-eva';

/** Cómo queda la lista, para leer los tests de un vistazo: 'AAABBB'. */
const dibujo = (ids: string[], reparto: Reparto, tutores: string[]) =>
  ids.map((a) => (reparto[a] ? String.fromCharCode(65 + tutores.indexOf(reparto[a]!)) : '·')).join('');

describe('repartoPorMitades', () => {
  it('parte por la mitad en el orden de la lista', () => {
    const ids = alumnos(6);
    expect(dibujo(ids, repartoPorMitades(ids, [ana, luis]), [ana, luis])).toBe('AAABBB');
  });

  it('con número impar, el primero se queda con uno más', () => {
    const ids = alumnos(31);
    const r = repartoPorMitades(ids, [ana, luis]);
    expect(repartoPorTutor(ids, r, [ana, luis])).toEqual({ [ana]: 16, [luis]: 15 });
  });

  it('reparte en tercios con tres tutores', () => {
    const ids = alumnos(8);
    const r = repartoPorMitades(ids, [ana, luis, eva]);
    expect(dibujo(ids, r, [ana, luis, eva])).toBe('AAABBBCC');
  });

  it('no deja a nadie sin tutor', () => {
    const ids = alumnos(25);
    expect(sinTutorPersonal(ids, repartoPorMitades(ids, [ana, luis]))).toBe(0);
  });
});

describe('aplicarCorte', () => {
  const ids = alumnos(6);

  it('corta por el punto tocado: arriba uno, abajo el otro', () => {
    const r = aplicarCorte(ids, [ana, luis], {}, 2);
    expect(dibujo(ids, r, [ana, luis])).toBe('AABBBB');
  });

  it('mover el corte respeta quién estaba arriba (aunque se haya invertido)', () => {
    const invertido = invertirReparto(repartoPorMitades(ids, [ana, luis]), [ana, luis]);
    expect(dibujo(ids, invertido, [ana, luis])).toBe('BBBAAA');
    expect(dibujo(ids, aplicarCorte(ids, [ana, luis], invertido, 4), [ana, luis])).toBe('BBBBAA');
  });

  it('con tres tutores, el primer corte abre dos bloques y el segundo el tercero', () => {
    const tres = [ana, luis, eva];
    const uno = aplicarCorte(ids, tres, {}, 2);
    expect(dibujo(ids, uno, tres)).toBe('AABBBB');
    const dos = aplicarCorte(ids, tres, uno, 4);
    expect(dibujo(ids, dos, tres)).toBe('AABBCC');
  });

  it('con los cortes ya puestos, mueve el más cercano al punto tocado', () => {
    const tres = [ana, luis, eva];
    const dos = aplicarCorte(ids, tres, aplicarCorte(ids, tres, {}, 2), 4);
    expect(dibujo(ids, aplicarCorte(ids, tres, dos, 5), tres)).toBe('AABBBC');
    expect(dibujo(ids, aplicarCorte(ids, tres, dos, 1), tres)).toBe('ABBBCC');
  });

  it('ignora cortes fuera de la lista o con un solo tutor', () => {
    expect(aplicarCorte(ids, [ana, luis], {}, 0)).toEqual({});
    expect(aplicarCorte(ids, [ana, luis], {}, 6)).toEqual({});
    expect(aplicarCorte(ids, [ana], {}, 3)).toEqual({});
  });

  it('sobre un reparto hecho a mano y a trozos, empieza de cero por el punto tocado', () => {
    const aTrozos: Reparto = { a01: ana, a02: luis, a03: ana, a04: luis, a05: ana, a06: luis };
    expect(dibujo(ids, aplicarCorte(ids, [ana, luis], aTrozos, 3), [ana, luis])).toBe('AAABBB');
  });
});

describe('invertirReparto', () => {
  it('intercambia los dos tutores y deja los huecos como estaban', () => {
    const r: Reparto = { a01: ana, a02: luis, a03: null };
    expect(invertirReparto(r, [ana, luis])).toEqual({ a01: luis, a02: ana, a03: null });
  });

  it('con tres tutores, el del medio se queda donde está', () => {
    const r: Reparto = { a01: ana, a02: luis, a03: eva };
    expect(invertirReparto(r, [ana, luis, eva])).toEqual({ a01: eva, a02: luis, a03: ana });
  });
});

describe('completarHuecos', () => {
  it('mete al alumno nuevo donde le toca por orden de lista', () => {
    const ids = alumnos(6);
    // a03 llega a mitad de curso: su sitio alfabético cae en el bloque de Ana.
    const r: Reparto = { a01: ana, a02: ana, a03: null, a04: luis, a05: luis, a06: luis };
    expect(dibujo(ids, completarHuecos(ids, r), [ana, luis])).toBe('AAABBB');
  });

  it('si el hueco está al principio, hereda del siguiente', () => {
    const ids = alumnos(3);
    expect(completarHuecos(ids, { a01: null, a02: luis, a03: luis })).toEqual({ a01: luis, a02: luis, a03: luis });
  });

  it('varios huecos seguidos en la frontera se completan hacia arriba', () => {
    const ids = alumnos(5);
    const r: Reparto = { a01: ana, a02: null, a03: null, a04: luis, a05: luis };
    expect(dibujo(ids, completarHuecos(ids, r), [ana, luis])).toBe('AAABB');
  });

  it('sin nadie asignado no inventa nada', () => {
    const ids = alumnos(3);
    expect(sinTutorPersonal(ids, completarHuecos(ids, {}))).toBe(3);
  });
});

describe('cortesDeReparto', () => {
  it('marca dónde cambia de tutor, y los huecos no cortan', () => {
    const ids = alumnos(6);
    expect(cortesDeReparto(ids, { a01: ana, a02: ana, a03: null, a04: luis, a05: luis, a06: luis })).toEqual([3]);
  });

  it('sin reparto no hay cortes', () => {
    expect(cortesDeReparto(alumnos(4), {})).toEqual([]);
  });
});

describe('repartoPorTutor', () => {
  it('cuenta a cero los tutores que no llevan a nadie', () => {
    expect(repartoPorTutor(alumnos(2), { a01: ana, a02: ana }, [ana, luis])).toEqual({ [ana]: 2, [luis]: 0 });
  });
});
