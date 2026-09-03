import { describe, expect, it } from 'vitest';
import { compararClases, compararClasesMayoresPrimero, cursoBaseEso, etapaDeCurso, ordenCurso } from '@/lib/cursos';
import { CURSOS_FORM } from '@/lib/licencias';

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

describe('curso base de un alumno de PDC', () => {
  it('traduce el nombre del programa de Educamos al curso de ESO', () => {
    expect(cursoBaseEso('3ºPPDC')).toBe('3ESO');
    expect(cursoBaseEso('4ºPPDC')).toBe('4ESO');
    expect(cursoBaseEso('3PDC')).toBe('3ESO');
  });

  it('deja el resto de cursos tal cual', () => {
    for (const c of ['3ESO', '4ESO', '6PRI', '1PRI', '3INF']) expect(cursoBaseEso(c)).toBe(c);
  });

  it('no revienta con vacíos', () => {
    expect(cursoBaseEso(null)).toBeNull();
    expect(cursoBaseEso(undefined)).toBeNull();
  });

  // La razón de existir: sin esto los PDC se caen del alcance de Licencias y el sync de
  // alumnado los da de baja en bloque (23 alumnos, 2 con pedido confirmado, 2026-09-03).
  it('mete a los PDC dentro de los cursos del formulario de Licencias', () => {
    const enFormulario = new Set<string>(CURSOS_FORM.map((c) => c.base));
    expect(enFormulario.has(cursoBaseEso('3ºPPDC')!)).toBe(true);
    expect(enFormulario.has(cursoBaseEso('4ºPPDC')!)).toBe(true);
  });
});
