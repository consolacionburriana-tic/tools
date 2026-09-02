import { describe, expect, it } from 'vitest';
import {
  detectarIdentificador,
  maskAlumno,
  maskEmail,
  normalizarCorreo,
  normalizarDni,
  nuevoTokenFamilia,
} from '@/lib/familias';

describe('normalizarDni', () => {
  it('pasa a mayúsculas y quita espacios, guiones y puntos', () => {
    expect(normalizarDni(' 12.345-678z ')).toBe('12345678Z');
  });

  it('deja intacto un valor ya normalizado', () => {
    expect(normalizarDni('12345678Z')).toBe('12345678Z');
  });
});

describe('detectarIdentificador', () => {
  it('reconoce un token de acceso y lo pasa a minúsculas', () => {
    expect(detectarIdentificador('tok_abc123')).toEqual({ tipo: 'token', valor: 'tok_abc123' });
    expect(detectarIdentificador('Tok_ABC123')).toEqual({ tipo: 'token', valor: 'tok_abc123' });
  });

  it('reconoce un NIA (solo dígitos, 5-12 caracteres)', () => {
    expect(detectarIdentificador('12345678')).toEqual({ tipo: 'nia', valor: '12345678' });
  });

  it('reconoce un DNI/NIE de tutor (alfanumérico con letras)', () => {
    expect(detectarIdentificador('12345678Z')).toEqual({ tipo: 'dni', valor: '12345678Z' });
    expect(detectarIdentificador('X1234567L')).toEqual({ tipo: 'dni', valor: 'X1234567L' });
  });

  it('rechaza entradas demasiado cortas', () => {
    expect(detectarIdentificador('abc')).toBeNull();
    expect(detectarIdentificador('1234')).toBeNull();
  });

  it('rechaza la entrada vacía', () => {
    expect(detectarIdentificador('')).toBeNull();
    expect(detectarIdentificador('   ')).toBeNull();
  });
});

describe('maskAlumno', () => {
  it('enmascara nombre y dos apellidos completos', () => {
    expect(maskAlumno('Francisco', 'Martínez', 'Lucencio')).toBe('Fra. M. Luc.');
  });

  it('omite el segundo apellido si no existe', () => {
    expect(maskAlumno('Francisco', 'Martínez', null)).toBe('Fra. M.');
  });

  it('un nombre más corto que el fragmento se usa entero', () => {
    expect(maskAlumno('Al', 'Ba', 'Ce')).toBe('Al. B. Ce.');
  });

  it('sin ningún dato devuelve el marcador genérico', () => {
    expect(maskAlumno(null, null, null)).toBe('(alumno)');
  });
});

describe('nuevoTokenFamilia', () => {
  it('genera un token con el prefijo, longitud y alfabeto esperados', () => {
    const token = nuevoTokenFamilia();
    expect(token.startsWith('tok_')).toBe(true);
    expect(token).toHaveLength(4 + 24);
    expect(token.slice(4)).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]+$/);
  });

  it('dos tokens generados no coinciden', () => {
    expect(nuevoTokenFamilia()).not.toBe(nuevoTokenFamilia());
  });
});

describe('normalizarCorreo', () => {
  it('limpia espacios y pasa a minúsculas', () => {
    expect(normalizarCorreo('  David.Perez@Gmail.COM ')).toBe('david.perez@gmail.com');
  });

  it('rechaza lo que no es un correo', () => {
    expect(normalizarCorreo('david.perez')).toBeNull();
    expect(normalizarCorreo('david@localhost')).toBeNull();
    expect(normalizarCorreo('  ')).toBeNull();
    expect(normalizarCorreo(null)).toBeNull();
  });
});

describe('maskEmail', () => {
  it('deja ver dos letras y el dominio, para que la familia lo reconozca', () => {
    expect(maskEmail('david.perez@gmail.com')).toBe('da•••@gmail.com');
  });

  it('con una parte local muy corta enseña solo una letra', () => {
    expect(maskEmail('ab@gmail.com')).toBe('a•••@gmail.com');
    expect(maskEmail('a@gmail.com')).toBe('a•••@gmail.com');
  });

  it('nunca deja ver la dirección completa', () => {
    const mascara = maskEmail('david.perez@gmail.com')!;
    expect(mascara).not.toContain('david.perez');
    expect(mascara).not.toContain('perez');
  });

  it('devuelve null si no hay correo válido que enmascarar', () => {
    expect(maskEmail(null)).toBeNull();
    expect(maskEmail('')).toBeNull();
    expect(maskEmail('no-es-un-correo')).toBeNull();
  });
});
