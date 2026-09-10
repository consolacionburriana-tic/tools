import { describe, expect, it } from 'vitest';
import { cursoDeSalida, DIAS_GRACIA_ARCHIVO, tripArchivada } from '@/lib/salidas';

describe('tripArchivada', () => {
  it('sin fecha nunca se archiva', () => {
    expect(tripArchivada(null, new Date('2026-09-10'))).toBe(false);
  });

  it('el mismo día no está archivada', () => {
    expect(tripArchivada('2026-09-10', new Date('2026-09-10T12:00:00'))).toBe(false);
  });

  it(`dentro del margen de ${DIAS_GRACIA_ARCHIVO} días no está archivada`, () => {
    expect(tripArchivada('2026-09-10', new Date('2026-09-13T23:00:00'))).toBe(false);
  });

  it('pasado el margen sí está archivada', () => {
    expect(tripArchivada('2026-09-10', new Date('2026-09-14T00:00:00'))).toBe(true);
  });
});

describe('cursoDeSalida', () => {
  it('usa la fecha de la salida si la tiene', () => {
    expect(cursoDeSalida('2026-09-15', new Date('2020-01-01'))).toBe('2026-27');
    expect(cursoDeSalida('2026-05-15', new Date('2020-01-01'))).toBe('2025-26');
  });

  it('sin fecha, cae al curso de cuándo se creó', () => {
    expect(cursoDeSalida(null, new Date('2026-10-01'))).toBe('2026-27');
  });
});
