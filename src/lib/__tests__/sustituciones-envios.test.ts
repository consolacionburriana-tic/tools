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
  it('nunca en fin de semana: lo del sábado o el domingo sale el lunes a las 8 (David, 23-nov-2026)', () => {
    // Viernes 20-nov a las 19:30: tocaría el sábado a las 8 → lunes 23 a las 8.
    expect(cuandoEnviar('2026-11-23', utc('2026-11-20T18:30:00Z')).toISOString()).toBe('2026-11-23T07:00:00.000Z');
    // Sábado por la mañana, sustitución el martes (el domingo abriría la ventana) → lunes a las 8.
    expect(cuandoEnviar('2026-11-24', utc('2026-11-21T10:00:00Z')).toISOString()).toBe('2026-11-23T07:00:00.000Z');
    // Sustitución el lunes 30, apuntada el miércoles: la ventana abre el sábado 28 → lunes 30 a las 8.
    expect(cuandoEnviar('2026-11-30', utc('2026-11-25T10:00:00Z')).toISOString()).toBe('2026-11-30T07:00:00.000Z');
    // Entre semana, nada cambia.
    expect(cuandoEnviar('2026-11-26', utc('2026-11-25T10:00:00Z')).toISOString()).toBe('2026-11-25T10:00:00.000Z');
  });
  it('forzado, sale ya aunque sea domingo por la noche', () => {
    const ahora = utc('2026-11-22T21:00:00Z');
    expect(cuandoEnviar('2026-11-23', ahora, true).getTime()).toBe(ahora.getTime());
  });
});
