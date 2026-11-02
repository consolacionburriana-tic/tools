import { describe, expect, it } from 'vitest';
import { BIENVENIDA_ID, cookieBienvenida, debeBienvenida, fraseBienvenida } from '@/lib/bienvenida';
import { huella } from '@/lib/huella';
import { correoSolicitudAcceso, cookieSolicitud, esSolicitable, TEXTO_SOLICITAR } from '@/lib/solicitud-acceso';

describe('bienvenida del escritorio', () => {
  it('se enseña la primera vez y no se repite con la cookie puesta', () => {
    expect(debeBienvenida(undefined, false)).toBe(true);
    expect(debeBienvenida(BIENVENIDA_ID, false)).toBe(false);
  });

  it('un estreno nuevo la vuelve a enseñar, y ?bienvenida=1 la fuerza', () => {
    expect(debeBienvenida('2020-01-01', false)).toBe(true);
    expect(debeBienvenida(BIENVENIDA_ID, true)).toBe(true);
  });

  it('la cookie es por persona (iPads compartidos) y no lleva el correo escrito', () => {
    const a = cookieBienvenida('ana@colegio.test');
    expect(a).not.toBe(cookieBienvenida('luis@colegio.test'));
    expect(a).toBe(cookieBienvenida('ANA@colegio.test'));
    expect(a).not.toContain('ana');
  });

  it('la frase es siempre la misma para la misma persona', () => {
    expect(fraseBienvenida('ana@colegio.test')).toBe(fraseBienvenida('Ana@colegio.test'));
    expect(fraseBienvenida('ana@colegio.test').length).toBeGreaterThan(10);
  });

  it('la huella es estable y de 8 caracteres', () => {
    expect(huella('hola')).toBe(huella('hola'));
    expect(huella('hola')).toMatch(/^[0-9a-f]{8}$/);
    expect(huella('hola')).not.toBe(huella('hola!'));
  });
});

describe('solicitar acceso', () => {
  it('solo Evaluaciones se pide así', () => {
    expect(esSolicitable('evaluaciones')).toBe(true);
    expect(esSolicitable('usuarios')).toBe(false);
    expect(TEXTO_SOLICITAR.evaluaciones).toContain('solicitar el acceso a este módulo');
  });

  it('la cookie de «ya pedida» es por persona y por módulo', () => {
    expect(cookieSolicitud('ana@colegio.test', 'evaluaciones')).not.toBe(cookieSolicitud('luis@colegio.test', 'evaluaciones'));
  });

  it('el correo dice quién, qué módulo y escapa lo que escribe la gente', () => {
    const c = correoSolicitudAcceso({
      nombre: 'Ana <b>Prueba</b>',
      email: 'ana@colegio.test',
      rol: 'Profe',
      modulo: 'Evaluaciones',
      url: 'https://tools.test/gestion/usuarios',
    });
    expect(c.asunto).toContain('Evaluaciones');
    expect(c.html).toContain('ana@colegio.test');
    expect(c.html).not.toContain('<b>Prueba</b>');
    expect(c.html).toContain('https://tools.test/gestion/usuarios');
  });
});
