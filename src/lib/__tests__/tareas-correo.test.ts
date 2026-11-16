import { describe, expect, it } from 'vitest';
import { direccionTareas, enlaceCorreo, limpiarAsunto, remitente, textoDelCorreo } from '../tareas-correo';

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

describe('tareas por correo', () => {
  it('limpia el asunto de reenvíos', () => {
    expect(limpiarAsunto('Fwd: RV: Proyector 3ºB @amparo !alta')).toBe('Proyector 3ºB @amparo !alta');
    expect(limpiarAsunto('Reenviado: Re: hola')).toBe('hola');
    expect(limpiarAsunto('Revisar wifi')).toBe('Revisar wifi');
  });
  it('lee el remitente', () => {
    expect(remitente('"Ana Gil" <Ana@X.com>')).toEqual({ nombre: 'Ana Gil', email: 'ana@x.com' });
    expect(remitente('ana@x.com')).toEqual({ nombre: null, email: 'ana@x.com' });
    expect(remitente('nadie')).toBeNull();
  });
  it('saca el texto plano, o el HTML sin etiquetas', () => {
    expect(textoDelCorreo({ mimeType: 'multipart/alternative', parts: [{ mimeType: 'text/plain', body: { data: b64('Hola\r\n\r\n\r\n\r\nqué tal  ') } }] })).toBe('Hola\n\nqué tal');
    expect(textoDelCorreo({ mimeType: 'text/html', body: { data: b64('<p>Uno</p><p>Dos &amp; tres</p>') } })).toBe('Uno\nDos & tres');
    expect(textoDelCorreo(null)).toBe('');
  });
  it('enlaza el correo por su Message-ID y arma la dirección', () => {
    expect(enlaceCorreo('<abc@mail.gmail.com>')).toBe('https://mail.google.com/mail/u/0/#search/rfc822msgid%3Aabc%40mail.gmail.com');
    expect(direccionTareas('tic@consolacionburriana.com')).toBe('tic+tarea@consolacionburriana.com');
  });
});
