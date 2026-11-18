import { describe, expect, it } from 'vitest';
import { cuandoEnviar } from '@/lib/sustituciones-server';

// Invierno: Madrid = UTC+1. Hora local → UTC restando 1.
const utc = (iso: string) => new Date(iso);

describe('cuandoEnviar (ventana 08:00–18:00 Madrid, máximo 2 días de antelación)', () => {
  it('dentro de horas y con la sustitución cerca, sale ya', () => {
    const ahora = utc('2026-11-18T10:00:00Z'); // 11:00 Madrid
    expect(cuandoEnviar('2026-11-19', ahora).getTime()).toBe(ahora.getTime());
  });
  it('después de las 18:00 espera a las 08:00 del día siguiente', () => {
    const r = cuandoEnviar('2026-11-20', utc('2026-11-18T18:30:00Z')); // 19:30 Madrid
    expect(r.toISOString()).toBe('2026-11-19T07:00:00.000Z'); // 08:00 Madrid
  });
  it('antes de las 08:00 espera a las 08:00 de hoy', () => {
    const r = cuandoEnviar('2026-11-19', utc('2026-11-18T05:30:00Z')); // 06:30 Madrid
    expect(r.toISOString()).toBe('2026-11-18T07:00:00.000Z');
  });
  it('con la sustitución lejos, no avisa antes de dos días de antelación (a las 08:00)', () => {
    const r = cuandoEnviar('2026-12-10', utc('2026-11-18T10:00:00Z'));
    expect(r.toISOString()).toBe('2026-12-08T07:00:00.000Z');
  });
  it('en verano usa el horario de verano (UTC+2)', () => {
    const r = cuandoEnviar('2027-06-10', utc('2027-05-01T10:00:00Z'));
    expect(r.toISOString()).toBe('2027-06-08T06:00:00.000Z');
  });
});
