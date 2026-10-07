import { describe, expect, it } from 'vitest';
import { applyVars, armarMensaje, enlazarUrls, escapar, wrapHtml } from '@/lib/correos';

describe('applyVars', () => {
  it('sustituye variables conocidas, insensible a mayúsculas', () => {
    expect(applyVars('Hola {Nombre}, tu clase es {CURSO}', { nombre: 'Ana', curso: '2ESO' })).toBe(
      'Hola Ana, tu clase es 2ESO',
    );
  });

  it('deja intacta una variable desconocida (para que un {typo} se note)', () => {
    expect(applyVars('Hola {typo}', { nombre: 'Ana' })).toBe('Hola {typo}');
  });

  it('sustituye la misma variable varias veces', () => {
    expect(applyVars('{alumno} y otra vez {alumno}', { alumno: 'Luis' })).toBe('Luis y otra vez Luis');
  });
});

describe('escapar', () => {
  it('escapa &, < y >', () => {
    expect(escapar('<b>Tom & Jerry</b>')).toBe('&lt;b&gt;Tom &amp; Jerry&lt;/b&gt;');
  });

  it('un texto sin caracteres especiales no cambia', () => {
    expect(escapar('texto normal')).toBe('texto normal');
  });
});

describe('enlazarUrls', () => {
  it('convierte una URL en un enlace clicable', () => {
    const out = enlazarUrls('Entra en https://tools.consolacionburriana.com/salidas?t=tok_abc');
    expect(out).toContain('<a href="https://tools.consolacionburriana.com/salidas?t=tok_abc"');
    expect(out).toContain('>https://tools.consolacionburriana.com/salidas?t=tok_abc</a>');
  });

  it('un texto sin URLs no cambia', () => {
    expect(enlazarUrls('sin enlaces aquí')).toBe('sin enlaces aquí');
  });
});

describe('wrapHtml', () => {
  it('escapa HTML del cuerpo y convierte saltos de línea en <br>', () => {
    const html = wrapHtml('Hola <b>familia</b>\nSegunda línea');
    expect(html).toContain('Hola &lt;b&gt;familia&lt;/b&gt;');
    expect(html).toContain('<br>Segunda línea');
  });

  it('una URL en el cuerpo queda clicable aunque el resto se escape', () => {
    const html = wrapHtml('Enlace: https://tools.consolacionburriana.com/salidas');
    expect(html).toContain('<a href="https://tools.consolacionburriana.com/salidas"');
  });

  it('con cta añade un botón; sin cta, solo la firma', () => {
    const conBoton = wrapHtml('cuerpo', { url: 'https://x.test', label: 'Entrar' });
    expect(conBoton).toContain('Entrar');
    expect(conBoton).toContain('https://x.test');

    const sinBoton = wrapHtml('cuerpo');
    expect(sinBoton).not.toContain('<a href="https://x.test"');
  });
});

describe('armarMensaje', () => {
  it('sustituye las variables en asunto y cuerpo y pone el botón con el enlace', () => {
    const m = armarMensaje(
      { email: 'a@b.com', vars: { nombre: 'Ana', enlace: 'https://x.test/e?a=1' }, cta: { url: 'https://x.test/e?a=1', label: 'Ir' } },
      'Hola {nombre}',
      'Entra en {enlace}',
      { perfil: 'evaluaciones', replyTo: 'tutor@b.com' },
    );
    expect(m.to).toBe('a@b.com');
    expect(m.subject).toBe('Hola Ana');
    expect(m.replyTo).toBe('tutor@b.com');
    expect(m.html).toContain('Entra en');
    expect(m.html).toContain('href="https://x.test/e?a=1"');
    expect(m.html).toContain('Evaluaciones');
  });
});
