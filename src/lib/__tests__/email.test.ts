import { describe, expect, it } from 'vitest';
import { parseRemitente } from '@/lib/email';
import { construirMime, direccion, encabezado } from '@/lib/email-gmail';

describe('parseRemitente', () => {
  it('separa nombre y correo', () => {
    expect(parseRemitente('Licencias · Colegio Consolación <licencias@consolacionburriana.com>')).toEqual({
      nombre: 'Licencias · Colegio Consolación',
      email: 'licencias@consolacionburriana.com',
    });
  });
  it('acepta un correo suelto', () => {
    expect(parseRemitente('  licencias@consolacionburriana.com ')).toEqual({
      nombre: '',
      email: 'licencias@consolacionburriana.com',
    });
  });
  it('quita las comillas del nombre', () => {
    expect(parseRemitente('"Colegio Consolación" <a@b.com>')?.nombre).toBe('Colegio Consolación');
  });
  it('devuelve null si no hay correo', () => {
    expect(parseRemitente('Colegio Consolación')).toBeNull();
  });
});

describe('cabeceras MIME', () => {
  it('deja el ASCII tal cual y codifica el resto en RFC 2047', () => {
    expect(encabezado('Justificante recibido')).toBe('Justificante recibido');
    expect(encabezado('Confirmación')).toBe(`=?UTF-8?B?${Buffer.from('Confirmación', 'utf8').toString('base64')}?=`);
  });
  it('formatea el remitente', () => {
    expect(direccion('', 'a@b.com')).toBe('a@b.com');
    expect(direccion('Salidas', 'a@b.com')).toBe('Salidas <a@b.com>');
  });
});

describe('construirMime', () => {
  const mime = construirMime({
    from: 'Salidas <no-responder@consolacionburriana.com>',
    to: ['uno@b.com', 'dos@b.com'],
    subject: 'Recordatorio de pago',
    html: '<p>Hola ñ</p>',
    replyTo: 'tutor@consolacionburriana.com',
  });
  it('lleva las cabeceras obligatorias con CRLF', () => {
    expect(mime).toContain('From: Salidas <no-responder@consolacionburriana.com>\r\n');
    expect(mime).toContain('To: uno@b.com, dos@b.com\r\n');
    expect(mime).toContain('Reply-To: tutor@consolacionburriana.com\r\n');
    expect(mime).toContain('Content-Type: text/html; charset=UTF-8\r\n');
  });
  it('manda el cuerpo en base64 recuperable', () => {
    const cuerpo = mime.split('\r\n\r\n')[1];
    expect(Buffer.from(cuerpo, 'base64').toString('utf8')).toBe('<p>Hola ñ</p>');
  });
  it('omite el Reply-To si no hay', () => {
    const sinReply = construirMime({ from: 'a@b.com', to: ['c@d.com'], subject: 'x', html: 'y' });
    expect(sinReply).not.toContain('Reply-To');
  });
});
