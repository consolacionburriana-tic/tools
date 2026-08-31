import { describe, expect, it } from 'vitest';
import { claseDeAlumno, normalizaNia, siglasDeAlumno } from '@/lib/abc';

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
