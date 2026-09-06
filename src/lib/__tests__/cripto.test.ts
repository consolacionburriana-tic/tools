import { beforeAll, describe, expect, it } from 'vitest';
import { cifrar, descifrar } from '@/lib/cripto';

beforeAll(() => {
  process.env.AUTOASM_CRYPTO_KEY = 'clave-de-prueba-solo-para-el-test';
});

describe('cripto', () => {
  it('ida y vuelta', () => {
    expect(descifrar(cifrar('contraseña del ftp'))).toBe('contraseña del ftp');
  });

  it('dos cifrados del mismo texto no se parecen (IV distinto)', () => {
    expect(cifrar('igual')).not.toBe(cifrar('igual'));
  });

  it('un valor manipulado no se descifra en silencio', () => {
    const valor = cifrar('secreto');
    const partes = valor.split('.');
    partes[3] = Buffer.from('otra cosa').toString('base64url');
    expect(() => descifrar(partes.join('.'))).toThrow();
  });

  it('un formato desconocido también revienta', () => {
    expect(() => descifrar('texto-plano')).toThrow(/formato/);
  });
});
