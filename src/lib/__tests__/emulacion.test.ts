import { describe, expect, it } from 'vitest';
import {
  codificarEmulacion,
  decodificarEmulacion,
  emulacionVigente,
  motivoBloqueoEmulando,
  puedeEmularUsuarios,
  veredictoEmular,
} from '../emulacion';

describe('cookie de emulación', () => {
  it('ida y vuelta, normalizando mayúsculas y espacios', () => {
    const v = codificarEmulacion(' Admin@Cole.es ', 'Profe@cole.es');
    expect(v).toBe('admin@cole.es|profe@cole.es');
    expect(decodificarEmulacion(v)).toEqual({ real: 'admin@cole.es', objetivo: 'profe@cole.es' });
  });

  it('un valor roto o manipulado no se interpreta', () => {
    for (const v of [null, undefined, '', 'solo', 'a@b.es|', '|a@b.es', 'a|b', 'a@b.es|c@d.es|e@f.es']) {
      expect(decodificarEmulacion(v), String(v)).toBeNull();
    }
  });
});

describe('quién puede emular', () => {
  it('solo el SuperTIC', () => {
    expect(puedeEmularUsuarios('supertic')).toBe(true);
    for (const r of ['tic', 'direccion', 'secretaria', 'profe', 'tutor', null, undefined] as const) {
      expect(puedeEmularUsuarios(r), String(r)).toBe(false);
    }
  });

  it('veredicto: no a ti mismo, no a quien no tiene acceso, no si no eres SuperTIC', () => {
    const base = { realRole: 'supertic', realEmail: 'a@cole.es', objetivoEmail: 'b@cole.es', objetivoRole: 'profe' } as const;
    expect(veredictoEmular(base)).toEqual({ ok: true });
    expect(veredictoEmular({ ...base, objetivoEmail: 'A@cole.es' }).ok).toBe(false);
    expect(veredictoEmular({ ...base, objetivoRole: null }).ok).toBe(false);
    expect(veredictoEmular({ ...base, realRole: 'tic' }).ok).toBe(false);
  });
});

describe('vigencia de la emulación', () => {
  const par = { real: 'a@cole.es', objetivo: 'b@cole.es' };
  it('vale para el SuperTIC que la empezó', () => {
    expect(emulacionVigente(par, 'A@cole.es', 'supertic')).toBe(true);
  });
  it('no vale si la presenta otra persona, un rol sin permiso o no hay cookie', () => {
    expect(emulacionVigente(par, 'otra@cole.es', 'supertic')).toBe(false);
    expect(emulacionVigente(par, 'a@cole.es', 'tic')).toBe(false);
    expect(emulacionVigente(par, 'a@cole.es', null)).toBe(false);
    expect(emulacionVigente(null, 'a@cole.es', 'supertic')).toBe(false);
  });
  it('no vale emularse a uno mismo', () => {
    expect(emulacionVigente({ real: 'a@cole.es', objetivo: 'a@cole.es' }, 'a@cole.es', 'supertic')).toBe(false);
  });
});

describe('mensaje de bloqueo', () => {
  it('nombra lo que se intentaba', () => {
    expect(motivoBloqueoEmulando('guardar en Drive')).toContain('guardar en Drive');
  });
});
