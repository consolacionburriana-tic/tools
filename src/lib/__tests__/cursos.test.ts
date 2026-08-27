import { describe, expect, it } from 'vitest';
import { compararClases, compararClasesMayoresPrimero, etapaDeCurso, ordenCurso } from '@/lib/cursos';

describe('orden de clases de mayores a pequeños (Evaluaciones)', () => {
  it('pone secundaria primero e infantil al final', () => {
    const clases = [
      { curso: '3INF', letra: 'A' },
      { curso: '1ESO', letra: 'B' },
      { curso: '5PRI', letra: 'A' },
      { curso: '4ESO', letra: 'A' },
    ];
    expect([...clases].sort(compararClasesMayoresPrimero).map((c) => c.curso)).toEqual([
      '4ESO',
      '1ESO',
      '5PRI',
      '3INF',
    ]);
  });

  it('dentro del mismo curso mantiene la letra en orden natural', () => {
    const clases = [
      { curso: '2ESO', letra: 'B' },
      { curso: '2ESO', letra: 'A' },
    ];
    expect([...clases].sort(compararClasesMayoresPrimero).map((c) => c.letra)).toEqual(['A', 'B']);
  });

  it('es exactamente el inverso del comparador normal (con una clase por curso)', () => {
    const clases = [
      { curso: '1ESO', letra: 'A' },
      { curso: '3PRI', letra: 'A' },
      { curso: '4INF', letra: 'A' },
    ];
    const normal = [...clases].sort(compararClases).map((c) => c.curso);
    const inverso = [...clases].sort(compararClasesMayoresPrimero).map((c) => c.curso);
    expect(inverso).toEqual([...normal].reverse());
  });

  it('coloca PDC junto al resto de secundaria, no al final', () => {
    const clases = [
      { curso: '2PRI', letra: 'A' },
      { curso: '3ºPPDC', letra: 'PDC' },
      { curso: '4ESO', letra: 'A' },
    ];
    expect([...clases].sort(compararClasesMayoresPrimero).map((c) => c.curso)).toEqual([
      '4ESO',
      '3ºPPDC',
      '2PRI',
    ]);
  });

  it('no rompe con cursos desconocidos: van al final', () => {
    const clases = [{ curso: 'LO-QUE-SEA', letra: null }, { curso: '1ESO', letra: 'A' }];
    expect([...clases].sort(compararClasesMayoresPrimero)[0].curso).toBe('LO-QUE-SEA');
    // ordenCurso da 900+ a lo no reconocido, así que en el orden inverso sale primero.
    expect(ordenCurso('LO-QUE-SEA')).toBeGreaterThan(ordenCurso('4ESO'));
  });
});

describe('etapa de un curso', () => {
  it('reconoce las tres etapas y el PDC como secundaria', () => {
    expect(etapaDeCurso('3INF')).toBe('EI');
    expect(etapaDeCurso('5PRI')).toBe('EP');
    expect(etapaDeCurso('1ESO')).toBe('ESO');
    expect(etapaDeCurso('4ºPPDC')).toBe('ESO');
    expect(etapaDeCurso(null)).toBeNull();
  });
});
