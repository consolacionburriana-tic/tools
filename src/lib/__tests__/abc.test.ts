import { describe, expect, it } from 'vitest';
import { claseDeAlumno, inicioDeCurso, normalizaNia, periodoValido, rangoDePeriodo, siglasDeAlumno } from '@/lib/abc';

describe('siglasDeAlumno', () => {
  it('son dos iniciales: nombre y primer apellido', () => {
    expect(siglasDeAlumno('ROBERTO', 'HERRERO')).toBe('R.H.');
  });
  it('no cuela el segundo apellido aunque venga en el nombre', () => {
    expect(siglasDeAlumno('celia', 'herrero')).toBe('C.H.');
  });
  it('aguanta un alumno sin apellido cargado', () => {
    expect(siglasDeAlumno('Ana', null)).toBe('A.');
  });
  it('devuelve un guion si no hay nada', () => {
    expect(siglasDeAlumno(null, '')).toBe('—');
  });
});

describe('claseDeAlumno', () => {
  it('junta curso y letra', () => {
    expect(claseDeAlumno('2ESO', 'B')).toBe('2ESO B');
  });
  it('no repite la letra en PDC', () => {
    expect(claseDeAlumno('3ºPPDC', 'PDC')).toBe('3ºPPDC');
  });
  it('vacío sin curso', () => {
    expect(claseDeAlumno(null, 'A')).toBe('');
  });
});

describe('normalizaNia', () => {
  it('quita separadores', () => {
    expect(normalizaNia(' 11 358 569 ')).toBe('11358569');
  });
  it('rechaza lo que no parece un NIA', () => {
    expect(normalizaNia('12345')).toBeNull();
    expect(normalizaNia(null)).toBeNull();
  });
});

describe('periodoValido', () => {
  it('sin nada (o con algo raro) abre el curso', () => {
    expect(periodoValido(undefined)).toBe('curso');
    expect(periodoValido('ayer')).toBe('curso');
  });
  it('respeta los periodos conocidos', () => {
    expect(periodoValido('30')).toBe('30');
    expect(periodoValido('all')).toBe('all');
  });
});

describe('inicioDeCurso', () => {
  it('en octubre, el 1 de septiembre de ese año', () => {
    expect(inicioDeCurso(new Date(2026, 9, 26))).toEqual(new Date(2026, 8, 1));
  });
  it('en marzo, el 1 de septiembre del año anterior', () => {
    expect(inicioDeCurso(new Date(2027, 2, 3))).toEqual(new Date(2026, 8, 1));
  });
});

describe('rangoDePeriodo', () => {
  const hoy = new Date(2026, 9, 26, 12, 0);
  it('«todo» no tiene límites', () => {
    expect(rangoDePeriodo('all', hoy)).toBeNull();
  });
  it('«este curso» va del 1 de septiembre a hoy', () => {
    const r = rangoDePeriodo('curso', hoy);
    expect(r?.from).toEqual(new Date(2026, 8, 1));
    expect(r?.to.getDate()).toBe(26);
  });
  it('«7 días» cuenta hoy: empieza hace 6 días', () => {
    expect(rangoDePeriodo('7', hoy)?.from).toEqual(new Date(2026, 9, 20));
  });
});
