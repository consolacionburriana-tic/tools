import { describe, expect, it } from 'vitest';
import { cursoSiguiente } from '@/lib/cursos';
import { type ClaseTutores, planPromocion, resumenPlan } from '@/lib/tutorias';

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
