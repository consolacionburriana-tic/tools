import { describe, expect, it } from 'vitest';
import { claseDeAlumno, normalizaNia, siglasDeAlumno } from '@/lib/abc';

describe('siglasDeAlumno', () => {
  it('compone las iniciales de nombre y apellidos', () => {
    expect(siglasDeAlumno('ROBERTO', 'HERRERO', 'MENDOZA')).toBe('R.H.M.');
  });
  it('aguanta apellidos sueltos', () => {
    expect(siglasDeAlumno('celia', 'herrero', null)).toBe('C.H.');
  });
  it('devuelve un guion si no hay nada', () => {
    expect(siglasDeAlumno(null, '', undefined)).toBe('—');
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
