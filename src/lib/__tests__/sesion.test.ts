import { describe, expect, it } from 'vitest';
import { sesionCaducada, tieneTopeDeSesion } from '../sesion';

const DIA = 24 * 60 * 60 * 1000;
const hoy = Date.UTC(2026, 10, 2);

describe('tope de sesión del profesorado de etapa', () => {
  it('lo tienen profe y tutor, y nadie más', () => {
    expect(tieneTopeDeSesion('profe')).toBe(true);
    expect(tieneTopeDeSesion('tutor')).toBe(true);
    for (const r of ['direccion', 'secretaria', 'tic', 'supertic', 'jefe', 'orientacion', 'comunicacion', 'evaluaciones', null]) {
      expect(tieneTopeDeSesion(r), String(r)).toBe(false);
    }
  });

  it('caduca pasados 60 días desde el login, no antes', () => {
    expect(sesionCaducada('profe', hoy - 59 * DIA, hoy)).toBe(false);
    expect(sesionCaducada('tutor', hoy - 61 * DIA, hoy)).toBe(true);
  });

  it('el resto de roles no caduca por esto, ni aunque lleven un año', () => {
    expect(sesionCaducada('direccion', hoy - 365 * DIA, hoy)).toBe(false);
    expect(sesionCaducada('comunicacion', hoy - 365 * DIA, hoy)).toBe(false);
  });

  it('una sesión antigua sin fecha de login no se cierra de golpe', () => {
    expect(sesionCaducada('profe', undefined, hoy)).toBe(false);
  });
});
